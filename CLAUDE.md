# forgejo-mcp — Project Instructions

An MCP server exposing tools for a Forgejo/Gitea instance (repositories, issues,
comments, files, pull requests, commit status) over the REST API. Independent,
clean-room, Apache-2.0. This is NOT a fork; see `NOTICE` for attribution.

## Process policy (authoritative)

Follows the canonical General Repository Process Policy:

**issue -> `dev/<issue>-<slug>` branch (in a worktree) -> focused, signed,
semantic commits -> PR linking the issue (`Closes #N`) -> checks pass -> merge ->
delete branch.**

- No direct pushes to `main`. No force-pushes to `main`.
- Trivial changes still go through a branch and a PR.
- Semantic commit prefixes only: `feat` `fix` `chore` `docs` `test` `ci`
  `refactor` `build` `perf` `revert` `style`.
- Canonical host: **GitHub** (`rubicon/forgejo-mcp`), per the "GitHub for open
  source" convention for originating repos; Forgejo is a read-only mirror.

## Build and test

```bash
npm install
npm run build      # esbuild -> dist/index.js (single bundled file)
npm run smoke      # build + token-free MCP handshake; must report 19 tools
npm run typecheck  # tsc --noEmit
```

## Architecture

See `ARCHITECTURE.md`. In brief: `src/index.ts` wires MCP over stdio;
`src/client.ts` is the typed Forgejo REST client; `src/tools.ts` holds the 19
tool definitions and handlers; `src/types.ts` has the API response shapes.
esbuild bundles everything to a single `dist/index.js`. `scripts/smoke.mjs` is
the only check.

## Design constraints (do not violate)

- Read tools plus additive writes only: `create_issue`, `create_issue_comment`,
  and `create_pull_request`. There are no merge, delete, or admin tools. This
  keeps the server safe for unattended use and caps the blast radius of the API
  token. Do not add destructive tools without explicit owner sign-off and a
  matching token-scope review.
- The token and base URL are supplied at runtime via `FORGEJO_TOKEN` and
  `FORGEJO_BASE_URL`. Never hardcode a token in the repo, configs, or tests. Use
  a least-privilege token (repository R/W, issue R/W, user Read).
- If you add or remove a tool, update the count asserted in `scripts/smoke.mjs`
  and the tool table in `README.md` in the same change.
