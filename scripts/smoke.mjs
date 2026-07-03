// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Dax Davis / Rubicon TechVentures
// Token-free smoke test: spawn the built server, complete an MCP handshake, and
// list tools. Asserts the safe default surface AND that the opt-in elevated tier
// is correctly double-gated across three env states. No Forgejo token required.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 22 (through #35) + 3 branch tools (#38) = 25 base tools; elevated adds 2 more.
const BASE_TOOLS = 25;
const ELEVATED_TOOLS = ['merge_pull_request', 'delete_branch'];
const EXPECTED_NAMES = [
  'create_release',
  'list_releases',
  'get_release',
  'create_tag',
  'list_tags',
  'get_tag',
  'list_directory',
  'create_file',
  'update_file',
  'list_branches',
  'get_branch',
  'create_branch',
];
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const serverPath = join(root, 'dist', 'index.js');

function fail(message) {
  console.error(`SMOKE FAIL: ${message}`);
  process.exit(1);
}

// Spawn the server with the given env, complete the handshake, and resolve with
// the list of registered tool names.
function listTools(env) {
  return new Promise((resolve, reject) => {
    const server = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env, ...env },
    });

    const pending = new Map();
    let buffer = '';
    let settled = false;

    const timeout = setTimeout(() => finish(new Error('timed out waiting for server')), 10_000);

    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      server.kill();
      error ? reject(error) : resolve(value);
    }

    function send(message) {
      server.stdin.write(`${JSON.stringify(message)}\n`);
    }

    function waitFor(id) {
      return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }));
    }

    server.on('error', (error) => finish(error));
    server.on('exit', (code) => {
      if (!settled && code !== null && code !== 0) {
        finish(new Error(`server exited early with code ${code}`));
      }
    });

    server.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        if (message.id !== undefined && pending.has(message.id)) {
          const { resolve: res, reject: rej } = pending.get(message.id);
          pending.delete(message.id);
          message.error ? rej(new Error(JSON.stringify(message.error))) : res(message.result);
        }
      }
    });

    (async () => {
      send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'smoke', version: '0.0.0' },
        },
      });
      await waitFor(1);
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
      const result = await waitFor(2);
      finish(null, (result?.tools ?? []).map((t) => t.name));
    })().catch((error) => finish(error));
  });
}

const has = (names, name) => names.includes(name);
const hasElevated = (names) => ELEVATED_TOOLS.some((name) => has(names, name));

try {
  // (a) No elevated env → safe default surface; elevated tools ABSENT.
  const off = await listTools({
    FORGEJO_MCP_ELEVATED: undefined,
    FORGEJO_MCP_ELEVATED_TOKEN: undefined,
  });
  if (off.length !== BASE_TOOLS) fail(`default: expected ${BASE_TOOLS} tools, got ${off.length}`);
  if (hasElevated(off)) fail('default: elevated tools must be absent with no elevated env');

  // (b) Flag set but no elevated token → fail closed; elevated tools ABSENT.
  const failClosed = await listTools({
    FORGEJO_MCP_ELEVATED: '1',
    FORGEJO_MCP_ELEVATED_TOKEN: undefined,
  });
  if (failClosed.length !== BASE_TOOLS) {
    fail(`fail-closed: expected ${BASE_TOOLS} tools, got ${failClosed.length}`);
  }
  if (hasElevated(failClosed)) fail('fail-closed: elevated tools must be absent without a token');

  // (c) Both flag and distinct token set → elevated tools PRESENT.
  const on = await listTools({
    FORGEJO_MCP_ELEVATED: '1',
    FORGEJO_MCP_ELEVATED_TOKEN: 'smoke-elevated-token',
  });
  const expectedOn = BASE_TOOLS + ELEVATED_TOOLS.length;
  if (on.length !== expectedOn) fail(`elevated: expected ${expectedOn} tools, got ${on.length}`);
  for (const name of ELEVATED_TOOLS) {
    if (!has(on, name)) fail(`elevated: expected tool ${name} to be registered`);
  }

  // Default surface must include the expected additive tools (release/tag, file).
  const missing = EXPECTED_NAMES.filter((name) => !has(off, name));
  if (missing.length) fail(`default: missing expected tools: ${missing.join(', ')}`);

  console.log(
    `SMOKE OK: default=${off.length} tools, fail-closed=${failClosed.length}, ` +
      `elevated=${on.length} (${ELEVATED_TOOLS.join(', ')}). Double gate verified.`,
  );
  process.exit(0);
} catch (error) {
  fail(error.message);
}
