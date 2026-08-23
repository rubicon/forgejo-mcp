# Architecture

forgejo-mcp is a single-purpose Model Context Protocol server. It speaks MCP over
stdio and calls the Forgejo/Gitea REST API (v1) with `fetch`. There is no web
framework and no persistent state.

## Layout

- `src/index.ts` — entry point. Constructs the server, registers the
  `tools/list` and `tools/call` handlers, dispatches each call to the tool
  registry, and connects the stdio transport. Tool results are returned as JSON
  text (a PR diff is returned as raw text); handler errors become `isError` tool
  results rather than crashing the server.
- `src/client.ts` — `ForgejoClient`, a typed wrapper over the REST API. Owns URL
  building, path-segment encoding, query/pagination parameters, auth headers, and
  error-body surfacing. An omitted `ref` is left off the request, so the server
  resolves the repository's own default branch instead of assuming `main`.
- `src/tools.ts` — the tool registry. Each entry is a name, description, JSON
  input schema, and a handler that maps validated arguments onto a
  `ForgejoClient` method.
- `src/types.ts` — TypeScript interfaces for the Forgejo API response shapes.

## Two tiers

The default surface is reads plus writes whose damage is visible and cheap to
undo; a tool is placed by blast radius rather than by whether it only adds.
Operations that destroy work or write to a default branch —
`merge_pull_request` and `delete_branch` — live in a separate `elevatedTools`
array that `src/index.ts` concatenates onto the registry **only** when both
`FORGEJO_MCP_ELEVATED=1` and a distinct `FORGEJO_MCP_ELEVATED_TOKEN` are set.
With either missing the surface is byte-identical to the default, and the server
logs why. `ForgejoClient.requestElevated` refuses to fall back to the default
token, so an elevated call cannot run under the read/write credential even by
mistake.

The gate exists because this server hands tools to an agent that reads untrusted
issue and pull request text. `merge_pull_request` additionally requires
`head_commit_id`, so a merge cannot be performed without first reading the pull
request it merges.

## Two things the schema cannot do

A tool's `inputSchema` is advertising, not enforcement: `src/index.ts` calls a
handler with `request.params.arguments` and nothing validates them first. Two
consequences shape the code.

`oneOf` and `maybeOneOf` in `src/tools.ts` sit beside `req()` and take the same
`const` the schema's `enum` is built from, so the declared values and the checked
values cannot drift apart. Anywhere an enum is declared, a handler enforces it.

`ForgejoClient.requestPage` returns `{ total_count, count, page, items }` rather
than a bare array, reading `x-total-count` from the response. Forgejo serves list
endpoints a page at a time and caps the page size regardless of the `limit`
asked for, so a bare array cannot be told apart from the first slice of a longer
list. Every `list_*` tool uses it except `list_directory`, whose endpoint answers
with a single object when the path names a file.

## Build

`scripts/build.mjs` runs esbuild to bundle `src/index.ts` into a single
`dist/index.js` (Node ESM, with a `createRequire` banner so the MCP SDK's
transitive CommonJS dependencies resolve at runtime). There is no TypeScript
emit; `tsc` is type-check only (`npm run typecheck`).

## Testing

`scripts/smoke.mjs` is the only check, and it asserts two different things.

It spawns the built server and completes an MCP handshake across three
environments — no elevated variables, the flag without a token, and both — so the
double gate and its fail-closed behaviour are covered, along with the tool count
and the version advertised in the handshake.

It then binds a `node:http` stub on loopback, points a second server at it with
`FORGEJO_BASE_URL`, drives real `tools/call` requests, and asserts the requests
the stub recorded: method, path, query parameters and JSON body. This half exists
because a schema-only assertion passes while the client silently drops a
parameter — the schema says what the model is told, the recorded request says
what the server would receive. Recorded requests are selected by method and path
rather than by position, so adding a call cannot re-point the assertions after it.

No token is needed for either half, so it runs in CI without secrets.

The check is proved by mutation: break the implementation on purpose and confirm
the check fails. A green suite after a mutation means the assertion is not
testing what you think. Anchor each mutation on a string unique to the function
under test — duplicated strings such as `{ method: 'DELETE' }` silently mutate a
sibling and leave the suite green.
