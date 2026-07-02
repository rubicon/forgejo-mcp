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

## Build

`scripts/build.mjs` runs esbuild to bundle `src/index.ts` into a single
`dist/index.js` (Node ESM, with a `createRequire` banner so the MCP SDK's
transitive CommonJS dependencies resolve at runtime). There is no TypeScript
emit; `tsc` is type-check only (`npm run typecheck`).

## Testing

`scripts/smoke.mjs` spawns the built server, completes an MCP handshake, calls
`tools/list`, and asserts the expected tool count. It requires no token, so it
runs in CI without secrets. When the tool set changes, update the expected count
there.
