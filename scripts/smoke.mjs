// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Dax Davis / Rubicon TechVentures
// Token-free smoke test: spawn the built server, complete an MCP handshake, and
// list tools. Asserts the safe default surface AND that the opt-in elevated tier
// is correctly double-gated across three env states. Then re-spawns the server
// against a local stub Forgejo and drives real tools/call requests, so the
// request the client actually sends — path, query, body — is asserted rather
// than just the schema it advertises. No Forgejo token required.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 27 (through #42) + 6 PR reviews/metadata tools (#52) = 33 base tools; elevated
// adds 2 more.
const BASE_TOOLS = 33;
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
  'list_commits',
  'get_commit',
  'list_pull_request_reviews',
  'create_pull_request_review',
  'request_pull_request_reviewers',
  'list_labels',
  'add_labels',
  'add_assignees',
];
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const serverPath = join(root, 'dist', 'index.js');
// The build inlines this into the handshake; assert the two never drift.
const { version: PKG_VERSION } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function fail(message) {
  console.error(`SMOKE FAIL: ${message}`);
  process.exit(1);
}

// Spawn the built server with the given env and speak JSON-RPC to it over stdio.
// Resolves once the MCP handshake is complete; `close()` stops the server.
function connect(env) {
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: { ...process.env, ...env },
  });

  const pending = new Map();
  let buffer = '';
  let nextId = 1;
  let closed = false;

  function rejectAll(error) {
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  }

  server.on('error', (error) => rejectAll(error));
  server.on('exit', (code) => {
    if (!closed && code !== null && code !== 0) {
      rejectAll(new Error(`server exited early with code ${code}`));
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
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
      }
    }
  });

  function notify(method, params) {
    server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
  }

  function request(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`timed out waiting for ${method}`));
      }, 10_000);
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }

  function close() {
    closed = true;
    server.kill();
  }

  return (async () => {
    const init = await request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'smoke', version: '0.0.0' },
    });
    notify('notifications/initialized');
    return { request, close, version: init?.serverInfo?.version };
  })().catch((error) => {
    close();
    throw error;
  });
}

// Complete a handshake and return the registered tools plus the advertised version.
async function listTools(env) {
  const rpc = await connect(env);
  try {
    const result = await rpc.request('tools/list', {});
    const tools = result?.tools ?? [];
    return { tools, names: tools.map((t) => t.name), version: rpc.version };
  } finally {
    rpc.close();
  }
}

// A stand-in Forgejo that records every request the client makes and answers
// with an empty JSON array, so handlers complete without a real instance.
function startStubForgejo() {
  const received = [];
  const server = createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      received.push({ method: req.method, url: req.url, body: raw ? JSON.parse(raw) : undefined });
      // Reads answer with a short page out of a larger set, so the pagination
      // metadata the list tools report has something to report.
      if (req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json', 'x-total-count': '51' });
        res.end(JSON.stringify([{ id: 1 }, { id: 2 }]));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('[]');
    });
  });

  return new Promise((resolve) => {
    // A sandbox that forbids binding to loopback would otherwise surface as an
    // unhandled error rather than a smoke failure.
    server.on('error', (error) => fail(`stub: could not start the stub Forgejo: ${error.message}`));
    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        received,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

const has = (names, name) => names.includes(name);
const hasElevated = (names) => ELEVATED_TOOLS.some((name) => has(names, name));

// --- Tool contract (see the tool-contract issue) -----------------------------
// Both halves are needed: the schema is what the model is told, the recorded
// request is what the client actually sends. A schema-only check passes while
// the client silently drops a query parameter.

function schemaOf(tools, name) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) fail(`schema: tool ${name} is not registered`);
  return tool.inputSchema ?? {};
}

function checkToolSchemas(tools) {
  const review = schemaOf(tools, 'create_pull_request_review');
  const event = review.properties?.event?.enum ?? [];
  // Forgejo's ReviewStateType is APPROVED; APPROVE falls through its switch and
  // silently files a pending draft review instead of an approval.
  if (!event.includes('APPROVED')) {
    fail(`schema: create_pull_request_review event enum must offer APPROVED, got [${event}]`);
  }
  if (event.includes('APPROVE')) {
    fail('schema: create_pull_request_review event enum must not offer APPROVE (Forgejo ignores it)');
  }

  const issues = schemaOf(tools, 'list_issues');
  const type = issues.properties?.type;
  if (!type) fail('schema: list_issues must expose a type filter (its endpoint also returns PRs)');
  if (type.default !== 'issues') {
    fail(`schema: list_issues type must default to issues, got ${JSON.stringify(type.default)}`);
  }
  for (const value of ['issues', 'pulls', 'all']) {
    if (!(type.enum ?? []).includes(value)) {
      fail(`schema: list_issues type enum must include ${value}, got [${type.enum ?? []}]`);
    }
  }

  const repos = schemaOf(tools, 'list_repositories');
  for (const key of ['page', 'limit']) {
    if (!repos.properties?.[key]) fail(`schema: list_repositories must expose ${key}`);
  }

  const update = schemaOf(tools, 'update_file');
  if (!(update.required ?? []).includes('sha')) {
    fail('schema: update_file must require sha (the API rejects an update without it)');
  }
}

function checkElevatedSchemas(tools) {
  const merge = schemaOf(tools, 'merge_pull_request');
  if (!merge.properties?.head_commit_id) {
    fail('schema: merge_pull_request must expose head_commit_id');
  }
  // Requiring it means an elevated merge cannot run without naming the commit
  // being merged, so a PR pushed to since review fails instead of merging.
  if (!(merge.required ?? []).includes('head_commit_id')) {
    fail('schema: merge_pull_request must require head_commit_id');
  }
}

// Drive real tools/call requests through the built server into a stub Forgejo,
// then assert the requests it made.
async function checkRequestContract() {
  const payloads = new Map();
  const stub = await startStubForgejo();
  try {
    const rpc = await connect({
      FORGEJO_BASE_URL: stub.url,
      FORGEJO_TOKEN: 'smoke-stub-token',
      FORGEJO_MCP_ELEVATED: undefined,
      FORGEJO_MCP_ELEVATED_TOKEN: undefined,
    });
    try {
      for (const [name, args] of [
        ['list_issues', { owner: 'o', repo: 'r' }],
        ['list_issues', { owner: 'o', repo: 'r', type: 'all' }],
        ['list_repositories', { page: 2, limit: 5 }],
        ['update_file', { owner: 'o', repo: 'r', path: 'docs/a.md', content: 'x', sha: 'abc123' }],
        ['create_pull_request_review', { owner: 'o', repo: 'r', index: 7, event: 'APPROVED' }],
      ]) {
        const result = await rpc.request('tools/call', { name, arguments: args });
        if (result?.isError) {
          fail(`contract: ${name} returned an error: ${result.content?.[0]?.text ?? '(no text)'}`);
        }
        payloads.set(name, JSON.parse(result.content[0].text));
      }
    } finally {
      rpc.close();
    }

    // The elevated tier needs its own connection: merge_pull_request is only
    // registered when both gates are satisfied.
    const elevated = await connect({
      FORGEJO_BASE_URL: stub.url,
      FORGEJO_TOKEN: 'smoke-stub-token',
      FORGEJO_MCP_ELEVATED: '1',
      FORGEJO_MCP_ELEVATED_TOKEN: 'smoke-stub-elevated-token',
    });
    try {
      const result = await elevated.request('tools/call', {
        name: 'merge_pull_request',
        arguments: { owner: 'o', repo: 'r', index: 9, style: 'squash', head_commit_id: 'feedface' },
      });
      if (result?.isError) {
        fail(`contract: merge_pull_request returned an error: ${result.content?.[0]?.text ?? '(no text)'}`);
      }
    } finally {
      elevated.close();
    }
  } finally {
    await stub.close();
  }

  const [issuesDefault, issuesAll, repos, update, review, merge] = stub.received;
  const parsed = (entry) => new URL(entry.url, 'http://stub');
  const query = (entry, key) => parsed(entry).searchParams.get(key);

  if (parsed(issuesDefault).pathname !== '/api/v1/repos/o/r/issues') {
    fail(`contract: list_issues hit ${parsed(issuesDefault).pathname}`);
  }
  if (query(issuesDefault, 'type') !== 'issues') {
    fail(`contract: list_issues must send type=issues by default, sent ${query(issuesDefault, 'type')}`);
  }
  if (parsed(issuesAll).searchParams.has('type')) {
    fail('contract: list_issues with type=all must omit the type parameter');
  }
  if (parsed(repos).pathname !== '/api/v1/user/repos') {
    fail(`contract: list_repositories hit ${parsed(repos).pathname}`);
  }
  if (query(repos, 'page') !== '2' || query(repos, 'limit') !== '5') {
    fail(
      `contract: list_repositories must forward paging, sent page=${query(repos, 'page')} ` +
        `limit=${query(repos, 'limit')}`,
    );
  }
  if (update.method !== 'PUT' || update.body?.sha !== 'abc123') {
    fail(`contract: update_file must PUT with the given sha, sent ${update.method} sha=${update.body?.sha}`);
  }
  if (update.body?.content !== Buffer.from('x', 'utf-8').toString('base64')) {
    fail('contract: update_file must base64-encode the content it was given');
  }
  if (review.body?.event !== 'APPROVED') {
    fail(`contract: create_pull_request_review must forward the event verbatim, sent ${review.body?.event}`);
  }
  if (parsed(merge).pathname !== '/api/v1/repos/o/r/pulls/9/merge' || merge.method !== 'POST') {
    fail(`contract: merge_pull_request hit ${merge.method} ${parsed(merge).pathname}`);
  }
  if (merge.body?.Do !== 'squash') {
    fail(`contract: merge_pull_request must forward the style as Do, sent ${merge.body?.Do}`);
  }
  // A list tool must say how much it did not return, or a caller cannot tell a
  // complete answer from the first page of one.
  const repoPage = payloads.get('list_repositories');
  if (!Array.isArray(repoPage?.items)) {
    fail('contract: list_repositories must return { items, ... }, not a bare array');
  }
  if (repoPage.total_count !== 51) {
    fail(`contract: list_repositories must report the server's total, got ${repoPage.total_count}`);
  }
  if (repoPage.count !== 2 || repoPage.items.length !== 2) {
    fail(`contract: list_repositories must report what it returned, got count=${repoPage.count}`);
  }
  if (repoPage.page !== 2) {
    fail(`contract: list_repositories must echo the page it fetched, got ${repoPage.page}`);
  }
  const issuePage = payloads.get('list_issues');
  if (issuePage?.page !== 1 || issuePage?.total_count !== 51) {
    fail(
      `contract: list_issues must report pagination too, got page=${issuePage?.page} ` +
        `total_count=${issuePage?.total_count}`,
    );
  }

  if (merge.body?.head_commit_id !== 'feedface') {
    fail(
      'contract: merge_pull_request must forward head_commit_id so the merge is pinned to the ' +
        `reviewed head, sent ${merge.body?.head_commit_id}`,
    );
  }

  return stub.received.length;
}

try {
  // (a) No elevated env → safe default surface; elevated tools ABSENT.
  const { names: off, tools: defaultTools, version: handshakeVersion } = await listTools({
    FORGEJO_MCP_ELEVATED: undefined,
    FORGEJO_MCP_ELEVATED_TOKEN: undefined,
  });
  if (off.length !== BASE_TOOLS) fail(`default: expected ${BASE_TOOLS} tools, got ${off.length}`);
  if (hasElevated(off)) fail('default: elevated tools must be absent with no elevated env');

  // Handshake must advertise the package.json version (build-time injected).
  if (handshakeVersion !== PKG_VERSION) {
    fail(`version: handshake advertised ${handshakeVersion}, expected ${PKG_VERSION} from package.json`);
  }

  // (b) Flag set but no elevated token → fail closed; elevated tools ABSENT.
  const { names: failClosed } = await listTools({
    FORGEJO_MCP_ELEVATED: '1',
    FORGEJO_MCP_ELEVATED_TOKEN: undefined,
  });
  if (failClosed.length !== BASE_TOOLS) {
    fail(`fail-closed: expected ${BASE_TOOLS} tools, got ${failClosed.length}`);
  }
  if (hasElevated(failClosed)) fail('fail-closed: elevated tools must be absent without a token');

  // (c) Both flag and distinct token set → elevated tools PRESENT.
  const { names: on, tools: elevatedSurface } = await listTools({
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

  // (d) Advertised schemas, then the requests the client actually sends.
  checkToolSchemas(defaultTools);
  checkElevatedSchemas(elevatedSurface);
  const contractCalls = await checkRequestContract();

  console.log(
    `SMOKE OK: v${handshakeVersion}, default=${off.length} tools, ` +
      `fail-closed=${failClosed.length}, elevated=${on.length} (${ELEVATED_TOOLS.join(', ')}). ` +
      `Double gate + version verified; ${contractCalls} tool calls verified against a stub Forgejo.`,
  );
  process.exit(0);
} catch (error) {
  fail(error.message);
}
