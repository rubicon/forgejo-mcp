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

// 27 (through #42) + 6 PR reviews/metadata tools (#52) + set_issue_state (#77)
// + get_pull_request_files (#85) + remove_label (#88) = 36 base tools; elevated
// adds 2 more.
const BASE_TOOLS = 36;
const ELEVATED_TOOLS = ['merge_pull_request', 'delete_branch', 'create_repo', 'delete_repo'];
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
  'set_issue_state',
  'get_pull_request_files',
  'remove_label',
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
        // The contents endpoint answers with a single object for a file path.
        res.end(
          req.url.includes('/contents/a-file.md')
            ? JSON.stringify({ type: 'file', name: 'a-file.md' })
            : JSON.stringify([{ id: 1 }, { id: 2 }]),
        );
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

// Tools that only read. Everything else changes something.
const READ_ONLY = [
  'list_repositories', 'get_repository', 'list_issues', 'get_issue', 'list_issue_comments',
  'get_file_content', 'list_directory', 'list_pull_requests', 'get_pull_request',
  'get_pull_request_diff', 'get_pull_request_files', 'get_commit_status', 'list_branches',
  'get_branch', 'list_commits', 'get_commit', 'list_releases', 'get_release', 'list_tags',
  'get_tag', 'list_pull_request_reviews', 'list_labels',
];
// Not additive. The MCP definition of destructiveHint is "performs only additive
// updates" when false, which is narrower than "irreversible": replacing a file,
// removing a label and closing an issue all take something away, even though
// only some of them are hard to undo. Severity lives in the description.
const DESTRUCTIVE = [
  'merge_pull_request', 'delete_branch', 'delete_repo',
  'update_file', 'remove_label', 'set_issue_state',
];
// A repeat with the same arguments has no further effect. Kept to the two where
// the semantics are "set it to this", which the server can reason about without
// a live instance. add_assignees reads and PATCHes a whole replacement list, so
// a repeat can lose a concurrent update; request_pull_request_reviewers POSTs
// and its remote side effects on a repeat are unverified. Advertising retry
// safety that has not been demonstrated is worse than omitting the hint.
const IDEMPOTENT = ['add_labels', 'set_issue_state'];

function checkAnnotations(tools, { elevated }) {
  for (const tool of tools) {
    const a = tool.annotations;
    if (!a) fail(`annotations: ${tool.name} carries none`);
    // Every tool here calls a remote Forgejo instance.
    if (a.openWorldHint !== true) {
      fail(`annotations: ${tool.name} must set openWorldHint, got ${a.openWorldHint}`);
    }
    const shouldRead = READ_ONLY.includes(tool.name);
    if ((a.readOnlyHint === true) !== shouldRead) {
      fail(`annotations: ${tool.name} readOnlyHint=${a.readOnlyHint}, expected ${shouldRead}`);
    }
    if (shouldRead && a.destructiveHint === true) {
      fail(`annotations: ${tool.name} reads but claims destructiveHint`);
    }
    const shouldDestroy = DESTRUCTIVE.includes(tool.name);
    if (!shouldRead && (a.destructiveHint === true) !== shouldDestroy) {
      fail(`annotations: ${tool.name} destructiveHint=${a.destructiveHint}, expected ${shouldDestroy}`);
    }
    // Retry safety: a client may repeat an idempotent call after a timeout.
    const shouldRepeat = IDEMPOTENT.includes(tool.name);
    if (!shouldRead && (a.idempotentHint === true) !== shouldRepeat) {
      fail(`annotations: ${tool.name} idempotentHint=${a.idempotentHint}, expected ${shouldRepeat}`);
    }
  }
  const named = tools.map((t) => t.name);
  for (const name of READ_ONLY) {
    if (!named.includes(name)) fail(`annotations: expected read tool ${name} to be registered`);
  }
  if (elevated) {
    for (const name of DESTRUCTIVE) {
      if (!named.includes(name)) fail(`annotations: expected ${name} in the elevated surface`);
    }
  }
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

  const issueState = schemaOf(tools, 'set_issue_state');
  const state = issueState.properties?.state;
  if (!state) fail('schema: set_issue_state must expose state');
  const states = (state.enum ?? []).slice().sort();
  // Only the two reachable states: PATCH also accepts title and body, which are
  // deliberately out of this tool's reach.
  if (states.join(',') !== 'closed,open') {
    fail(`schema: set_issue_state state enum must be exactly open|closed, got [${state.enum ?? []}]`);
  }
  for (const key of ['title', 'body']) {
    if (issueState.properties?.[key]) {
      fail(`schema: set_issue_state must not expose ${key} — content edits are out of scope`);
    }
  }

  // The two endpoints genuinely differ: IssueLabelsOption takes names or ids,
  // CreateIssueOption.labels is []int64. Mirror that rather than advertising a
  // flexibility the create endpoint does not have.
  const addItems = schemaOf(tools, 'add_labels').properties?.labels?.items ?? {};
  if (!Array.isArray(addItems.type) || !addItems.type.includes('string')) {
    fail(`schema: add_labels.labels must accept names or ids, got ${JSON.stringify(addItems.type)}`);
  }
  const createItems = schemaOf(tools, 'create_issue').properties?.labels?.items ?? {};
  if (createItems.type !== 'number') {
    fail(`schema: create_issue.labels must stay ids-only, got ${JSON.stringify(createItems.type)}`);
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
        [
          'list_issues',
          {
            owner: 'f', repo: 'ilter', q: 'crash', milestones: 'v1,v2', since: '2026-08-01T00:00:00Z',
            before: '2026-08-20T00:00:00Z', created_by: 'dax', assigned_by: 'sam',
            mentioned_by: 'kim', sort: 'nearduedate',
          },
        ],
        [
          'list_pull_requests',
          { owner: 'f', repo: 'prfilter', sort: 'priority', milestone: 4, poster: 'dax', labels: [7, 9] },
        ],
        ['list_repositories', { page: 2, limit: 5 }],
        ['update_file', { owner: 'o', repo: 'r', path: 'docs/a.md', content: 'x', sha: 'abc123' }],
        [
          'create_pull_request_review',
          {
            owner: 'o', repo: 'r', index: 7, event: 'APPROVED', commit_id: 'cafebabe',
            comments: [{ path: 'src/a.ts', body: 'off by one', new_position: 12 }],
          },
        ],
        ['list_pull_request_reviews', { owner: 'o', repo: 'r', index: 7, page: 3, limit: 4 }],
        ['get_pull_request_files', { owner: 'o', repo: 'r', index: 21, page: 2, limit: 7 }],
        // A label name may contain characters that must not corrupt the URL.
        ['remove_label', { owner: 'o', repo: 'r', index: 31, label: 'needs triage/urgent' }],
        // Labels go on the same way they come off: names or ids, the API accepts both.
        ['add_labels', { owner: 'o', repo: 'r', index: 41, labels: ['needs triage/urgent', 7] }],
        ['set_issue_state', { owner: 'o', repo: 'r', index: 12, state: 'closed' }],
      ]) {
        const result = await rpc.request('tools/call', { name, arguments: args });
        if (result?.isError) {
          fail(`contract: ${name} returned an error: ${result.content?.[0]?.text ?? '(no text)'}`);
        }
        payloads.set(name, JSON.parse(result.content[0].text));
      }

      // Every enum in the surface is advertising only — nothing validates tool
      // input before a handler runs — so an out-of-enum value must be refused by
      // the handler and must never reach the API. One case per enum field.
      for (const [name, args, marker] of [
        ['set_issue_state', { owner: 'o', repo: 'r', index: 13, state: 'deleted' }, '/issues/13'],
        ['list_issues', { owner: 'bad', repo: 'enum', type: 'everything' }, '/repos/bad/enum'],
        ['list_issues', { owner: 'bad', repo: 'state', state: 'archived' }, '/repos/bad/state'],
        ['list_pull_requests', { owner: 'bad', repo: 'prstate', state: 'draft' }, '/repos/bad/prstate'],
        // The two endpoints sort by different things; a value valid on one must
        // not be accepted by the other.
        ['list_issues', { owner: 'bad', repo: 'isort', sort: 'priority' }, '/repos/bad/isort'],
        ['list_pull_requests', { owner: 'bad', repo: 'psort', sort: 'relevance' }, '/repos/bad/psort'],
        [
          'create_pull_request_review',
          { owner: 'bad', repo: 'review', index: 14, event: 'LGTM' },
          '/repos/bad/review',
        ],
      ]) {
        const rejected = await rpc.request('tools/call', { name, arguments: args });
        if (!rejected?.isError) {
          fail(`contract: ${name} must reject a value outside its enum (${JSON.stringify(args)})`);
        }
        if (stub.received.some((entry) => entry.url.includes(marker))) {
          fail(`contract: ${name} must not send an out-of-enum value to the API`);
        }
      }

      // A comment with no path anchors to nothing; Forgejo would accept the
      // request and quietly file a degraded review, so refuse it here.
      for (const bad of [
        { path: '', body: 'nowhere' },
        { path: 'src/a.ts', body: '' },
        // The schema says number; nothing enforces a schema, so a numeric string
        // would be forwarded as a string and anchor the comment nowhere.
        { path: 'src/a.ts', body: 'stringly typed', new_position: '12' },
      ]) {
        const rejected = await rpc.request('tools/call', {
          name: 'create_pull_request_review',
          arguments: { owner: 'bad', repo: 'comment', index: 8, event: 'COMMENT', comments: [bad] },
        });
        if (!rejected?.isError) {
          fail(`contract: create_pull_request_review must reject ${JSON.stringify(bad)}`);
        }
        if (stub.received.some((entry) => entry.url.includes('/repos/bad/comment'))) {
          fail('contract: an invalid inline comment must not reach the API');
        }
      }

      // list_directory lists directories. A file path used to return a single
      // object, making the tool's return type unpredictable before the call.
      const dirPage = await rpc.request('tools/call', {
        name: 'list_directory',
        arguments: { owner: 'o', repo: 'r', path: 'src' },
      });
      if (dirPage?.isError) fail(`contract: list_directory errored: ${dirPage.content?.[0]?.text}`);
      const dirBody = JSON.parse(dirPage.content[0].text);
      if (!Array.isArray(dirBody?.items) || dirBody?.page !== 1) {
        fail(`contract: list_directory must return the paginated envelope, got ${JSON.stringify(dirBody)}`);
      }

      // A file path must be refused, not returned as an object.
      const asFile = await rpc.request('tools/call', {
        name: 'list_directory',
        arguments: { owner: 'o', repo: 'r', path: 'a-file.md' },
      });
      if (!asFile?.isError) {
        fail('contract: list_directory must refuse a path that names a file');
      }

      // A page number the server cannot honour must be refused outright rather
      // than sent and then reported back as some other page.
      for (const [name, args] of [
        ['list_repositories', { page: 0 }],
        // Delegating to requestPage is what enforces this; assert it per tool so
        // a hand-rolled fetch cannot quietly opt out.
        ['get_pull_request_files', { owner: 'bad', repo: 'page', index: 22, page: 0 }],
      ]) {
        const badPage = await rpc.request('tools/call', { name, arguments: args });
        if (!badPage?.isError) {
          fail(`contract: ${name} must reject page=0 instead of reporting a different page`);
        }
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

      // An optional enum must stay optional: omitting style falls back to the
      // documented default rather than failing the call.
      const defaultStyle = await elevated.request('tools/call', {
        name: 'merge_pull_request',
        arguments: { owner: 'o', repo: 'r', index: 11, head_commit_id: 'feedface' },
      });
      if (defaultStyle?.isError) {
        fail(
          'contract: merge_pull_request must accept an omitted style: ' +
            (defaultStyle.content?.[0]?.text ?? '(no text)'),
        );
      }
      const defaulted = stub.received.find((entry) => entry.url.includes('/pulls/11/merge'));
      if (defaulted?.body?.Do !== 'merge') {
        fail(`contract: an omitted style must default to merge, sent ${defaulted?.body?.Do}`);
      }

      // The other destructive tool. dev/88-slug is this repo's own branch naming,
      // so an unencoded slash would address a different path entirely.
      const deleted = await elevated.request('tools/call', {
        name: 'delete_branch',
        arguments: { owner: 'o', repo: 'r', branch: 'dev/88-remove-label' },
      });
      if (deleted?.isError) {
        fail(`contract: delete_branch returned an error: ${deleted.content?.[0]?.text ?? '(no text)'}`);
      }
      if (JSON.parse(deleted.content[0].text)?.branch !== 'dev/88-remove-label') {
        fail('contract: delete_branch must report the branch it deleted');
      }

      // A repository is the one thing an agent can create whose visibility it also
      // chooses, so private is the default and public must be asked for.
      // Only a literal boolean false may publish. Schemas are advisory here, so a
      // client sending the string "false" must not be read as a request to publish.
      for (const [args, wantPrivate] of [
        [{ name: 'scratch-repo' }, true],
        [{ name: 'p-string', private: 'false' }, true],
        [{ name: 'p-null', private: null }, true],
        [{ name: 'p-zero', private: 0 }, true],
        [{ name: 'p-false', private: false }, false],
      ]) {
        const made = await elevated.request('tools/call', { name: 'create_repo', arguments: args });
        if (made?.isError) fail(`contract: create_repo errored for ${JSON.stringify(args)}`);
        const sent = stub.received.filter((e) => e.method === 'POST' && e.url === '/api/v1/user/repos').pop();
        if (sent?.body?.private !== wantPrivate) {
          fail(
            `contract: create_repo with ${JSON.stringify(args.private)} must send ` +
              `private=${wantPrivate}, sent ${JSON.stringify(sent?.body?.private)}`,
          );
        }
      }

      // Deleting a repository is the only operation here with no undo, so the
      // caller must name what it is deleting.
      for (const bad of [
        { owner: 'o', repo: 'r' },
        { owner: 'o', repo: 'r', confirm: 'r' },
        { owner: 'o', repo: 'r', confirm: 'o/other' },
      ]) {
        const refused = await elevated.request('tools/call', { name: 'delete_repo', arguments: bad });
        if (!refused?.isError) {
          fail(`contract: delete_repo must refuse ${JSON.stringify(bad)}`);
        }
      }
      const goneRepo = await elevated.request('tools/call', {
        name: 'delete_repo',
        arguments: { owner: 'o', repo: 'doomed', confirm: 'o/doomed' },
      });
      if (goneRepo?.isError) fail(`contract: delete_repo errored: ${goneRepo.content?.[0]?.text}`);

      // The destructive tier must refuse an unrecognised merge style rather than
      // let the API decide what it meant.
      const badStyle = await elevated.request('tools/call', {
        name: 'merge_pull_request',
        arguments: {
          owner: 'bad', repo: 'style', index: 15, style: 'fast-forward', head_commit_id: 'feedface',
        },
      });
      if (!badStyle?.isError) fail('contract: merge_pull_request must reject a style outside its enum');
      if (stub.received.some((entry) => entry.url.includes('/repos/bad/style'))) {
        fail('contract: merge_pull_request must not send an out-of-enum style to the API');
      }
    } finally {
      elevated.close();
    }
  } finally {
    await stub.close();
  }

  const parsed = (entry) => new URL(entry.url, 'http://stub');
  const query = (entry, key) => parsed(entry).searchParams.get(key);

  // Select recorded requests by what they are rather than by position, so
  // adding a call above does not silently re-point the assertions below.
  const matching = (method, path) =>
    stub.received.filter((entry) => entry.method === method && parsed(entry).pathname === path);
  const only = (method, path) => {
    const [first, ...rest] = matching(method, path);
    if (!first) fail(`contract: no ${method} ${path} was requested`);
    if (rest.length) fail(`contract: ${method} ${path} was requested ${rest.length + 1} times`);
    return first;
  };

  const [issuesDefault, issuesAll] = matching('GET', '/api/v1/repos/o/r/issues');
  const repos = only('GET', '/api/v1/user/repos');
  const update = only('PUT', '/api/v1/repos/o/r/contents/docs/a.md');
  const review = only('POST', '/api/v1/repos/o/r/pulls/7/reviews');
  const reviewRequest = only('GET', '/api/v1/repos/o/r/pulls/7/reviews');
  const merge = only('POST', '/api/v1/repos/o/r/pulls/9/merge');

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
  if (review.body?.commit_id !== 'cafebabe') {
    fail(`contract: create_pull_request_review must forward commit_id, sent ${review.body?.commit_id}`);
  }
  const inline = review.body?.comments?.[0];
  if (inline?.path !== 'src/a.ts' || inline?.body !== 'off by one' || inline?.new_position !== 12) {
    fail(`contract: inline comments must be forwarded verbatim, sent ${JSON.stringify(review.body?.comments)}`);
  }
  if (review.body?.event !== 'APPROVED') {
    fail(`contract: create_pull_request_review must forward the event verbatim, sent ${review.body?.event}`);
  }
  only('DELETE', '/api/v1/repos/o/doomed');
  if (stub.received.some((e) => e.method === 'DELETE' && parsed(e).pathname === '/api/v1/repos/o/r')) {
    fail('contract: a refused delete_repo must send no request');
  }

  const branchDelete = only('DELETE', '/api/v1/repos/o/r/branches/dev%2F88-remove-label');
  if (!branchDelete) fail('contract: delete_branch must DELETE the encoded branch path');

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
  // Reporting a page a caller cannot ask for is the same defect in reverse.
  const reviewPage = payloads.get('list_pull_request_reviews');
  if (reviewPage?.page !== 3 || !Array.isArray(reviewPage?.items)) {
    fail(`contract: list_pull_request_reviews must accept and report paging, got page=${reviewPage?.page}`);
  }
  if (query(reviewRequest, 'page') !== '3' || query(reviewRequest, 'limit') !== '4') {
    fail(
      `contract: list_pull_request_reviews must forward paging, sent ` +
        `page=${query(reviewRequest, 'page')} limit=${query(reviewRequest, 'limit')}`,
    );
  }

  const issueState = only('PATCH', '/api/v1/repos/o/r/issues/12');
  if (issueState.body?.state !== 'closed') {
    fail(`contract: set_issue_state must PATCH the state, sent ${JSON.stringify(issueState.body)}`);
  }
  if (Object.keys(issueState.body ?? {}).join(',') !== 'state') {
    fail(
      'contract: set_issue_state must send state and nothing else, sent ' +
        Object.keys(issueState.body ?? {}).join(','),
    );
  }

  const files = only('GET', '/api/v1/repos/o/r/pulls/21/files');
  if (query(files, 'page') !== '2' || query(files, 'limit') !== '7') {
    fail(
      `contract: get_pull_request_files must forward paging, sent page=${query(files, 'page')} ` +
        `limit=${query(files, 'limit')}`,
    );
  }
  const filePage = payloads.get('get_pull_request_files');
  if (!Array.isArray(filePage?.items) || filePage?.page !== 2 || filePage?.total_count !== 51) {
    fail(`contract: get_pull_request_files must return the paginated envelope, got ${JSON.stringify(filePage)}`);
  }

  const added = only('POST', '/api/v1/repos/o/r/issues/41/labels');
  if (JSON.stringify(added.body?.labels) !== JSON.stringify(['needs triage/urgent', 7])) {
    fail(`contract: add_labels must forward names and ids verbatim, sent ${JSON.stringify(added.body?.labels)}`);
  }

  const removed = only('DELETE', '/api/v1/repos/o/r/issues/31/labels/needs%20triage%2Furgent');
  if (!removed) fail('contract: remove_label must DELETE the encoded identifier path');

  const filtered = only('GET', '/api/v1/repos/f/ilter/issues');
  for (const [key, want] of [
    ['q', 'crash'], ['milestones', 'v1,v2'], ['since', '2026-08-01T00:00:00Z'],
    ['before', '2026-08-20T00:00:00Z'], ['created_by', 'dax'], ['assigned_by', 'sam'],
    ['mentioned_by', 'kim'], ['sort', 'nearduedate'],
  ]) {
    if (query(filtered, key) !== want) {
      fail(`contract: list_issues must forward ${key}=${want}, sent ${query(filtered, key)}`);
    }
  }
  const prFiltered = only('GET', '/api/v1/repos/f/prfilter/pulls');
  for (const [key, want] of [['sort', 'priority'], ['milestone', '4'], ['poster', 'dax']]) {
    if (query(prFiltered, key) !== want) {
      fail(`contract: list_pull_requests must forward ${key}=${want}, sent ${query(prFiltered, key)}`);
    }
  }
  // The endpoint declares labels as collectionFormat: multi, so each id is its
  // own parameter. Comma-joining sends one value the server cannot parse as an id.
  const labelIds = parsed(prFiltered).searchParams.getAll('labels');
  if (labelIds.join('|') !== '7|9') {
    fail(`contract: list_pull_requests must repeat labels per id, sent ${JSON.stringify(labelIds)}`);
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

  // (b2) Flag set but the elevated token IS the default token → fail closed.
  // A second token that equals the first is not a second token: the whole point
  // is that the elevated credential is narrow and separately revocable.
  const { names: sameToken } = await listTools({
    FORGEJO_TOKEN: 'smoke-shared-token',
    FORGEJO_MCP_ELEVATED: '1',
    FORGEJO_MCP_ELEVATED_TOKEN: 'smoke-shared-token',
  });
  if (sameToken.length !== BASE_TOOLS) {
    fail(`same-token: expected ${BASE_TOOLS} tools, got ${sameToken.length}`);
  }
  if (hasElevated(sameToken)) {
    fail('same-token: elevated tools must be absent when the elevated token equals FORGEJO_TOKEN');
  }

  // (b3) Elevated token set but no default token → fail closed. Elevation is
  // additive on top of the base surface; without a default token there is no
  // pair, and the destructive tools would be the only ones that worked.
  const { names: noDefault } = await listTools({
    FORGEJO_TOKEN: '',
    FORGEJO_MCP_ELEVATED: '1',
    FORGEJO_MCP_ELEVATED_TOKEN: 'smoke-elevated-token',
  });
  if (noDefault.length !== BASE_TOOLS) {
    fail(`no-default-token: expected ${BASE_TOOLS} tools, got ${noDefault.length}`);
  }
  if (hasElevated(noDefault)) {
    fail('no-default-token: elevated tools must be absent when FORGEJO_TOKEN is unset');
  }

  // (c) Both flag and distinct token set → elevated tools PRESENT.
  const { names: on, tools: elevatedSurface } = await listTools({
    FORGEJO_TOKEN: 'smoke-default-token',
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
  // Over the wire, not just in the definitions: index.ts rebuilds each entry.
  checkAnnotations(defaultTools, { elevated: false });
  checkAnnotations(elevatedSurface, { elevated: true });
  const contractCalls = await checkRequestContract();

  console.log(
    `SMOKE OK: v${handshakeVersion}, default=${off.length} tools, ` +
      `fail-closed=${failClosed.length}, same-token=${sameToken.length}, no-default=${noDefault.length}, elevated=${on.length} (${ELEVATED_TOOLS.join(', ')}). ` +
      `Double gate + version verified; ${contractCalls} tool calls verified against a stub Forgejo.`,
  );
  process.exit(0);
} catch (error) {
  fail(error.message);
}
