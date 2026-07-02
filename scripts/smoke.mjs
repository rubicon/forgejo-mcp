// Token-free smoke test: spawn the built server, complete an MCP handshake,
// list tools, and assert the expected count. No Forgejo token required.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_TOOLS = 13;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const server = spawn('node', [join(root, 'dist', 'index.js')], {
  stdio: ['pipe', 'pipe', 'inherit'],
});

const pending = new Map();
let buffer = '';

const timeout = setTimeout(() => fail('timed out waiting for server'), 10_000);

function send(message) {
  server.stdin.write(`${JSON.stringify(message)}\n`);
}

function waitFor(id) {
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function fail(message) {
  clearTimeout(timeout);
  console.error(`SMOKE FAIL: ${message}`);
  server.kill();
  process.exit(1);
}

server.on('error', (error) => fail(error.message));
server.on('exit', (code) => {
  if (code !== null && code !== 0) fail(`server exited early with code ${code}`);
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
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
    }
  }
});

try {
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

  const count = result?.tools?.length ?? 0;
  if (count !== EXPECTED_TOOLS) {
    fail(`expected ${EXPECTED_TOOLS} tools, got ${count}`);
  }

  clearTimeout(timeout);
  console.log(`SMOKE OK: MCP handshake succeeded, ${count} tools listed.`);
  server.kill();
  process.exit(0);
} catch (error) {
  fail(error.message);
}
