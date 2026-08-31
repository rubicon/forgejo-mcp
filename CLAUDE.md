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
npm run smoke      # build + handshake; asserts BASE_TOOLS in scripts/smoke.mjs (currently 50) + version == package.json
npm run typecheck  # tsc --noEmit
```

The server version is injected at build time: `scripts/build.mjs` reads
`package.json` and passes it to esbuild `define` as `__PKG_VERSION__`, referenced
in `src/index.ts`. Do not hardcode a version literal.

## Architecture

See `ARCHITECTURE.md`. In brief: `src/index.ts` wires MCP over stdio;
`src/client.ts` is the typed Forgejo REST client; `src/tools.ts` holds the tool
definitions and handlers (50 base `tools` + 5 opt-in `elevatedTools`);
`src/types.ts` has the API response shapes.
esbuild bundles everything to a single `dist/index.js`. `scripts/smoke.mjs` is
the only check.

## Design constraints (do not violate)

- **Tools are tiered by blast radius, not by whether a write is additive.**

  - **Default surface** — reads, and writes whose damage is visible and cheap to
    undo. Editing an issue or pull request body belongs here for the same reason
    `update_file` does: the change is recorded and a person can see it.
  - **Elevated tier** — operations whose damage cannot be undone from this
    server: `merge_pull_request` (integrates code into a branch others build on),
    `delete_branch` (may lose unmerged commits), `create_repo` (chooses its own
    visibility, so a public one is somewhere to copy private content to),
    `delete_repo` (no undo by any means), and `delete_label` (strips the label
    from every issue and pull request that carried it, and neither the label nor
    those associations can be restored).

    Note what this boundary is *not*: "writes to the default branch" would pull
    in `create_file` and `update_file`, which target the default branch when no
    branch is given. Those stay in the default surface deliberately — the damage
    is a recorded commit and `git` can revert it.

    `create_release` and `create_tag` also default to the default branch and are
    also in the default surface, but on weaker grounds: they add rather than
    destroy, yet **this server exposes no way to undo them**, because the delete
    endpoints are not implemented. That asymmetry is known and tolerated while
    the surface is additive-only there. If deletion of tags or releases is ever
    added, revisit which tier all four belong to rather than assuming this
    placement still holds.
    Double-gated and fail-closed. All three must hold or the surface is
    byte-identical to the default: `FORGEJO_MCP_ELEVATED=1`, a `FORGEJO_TOKEN`
    that is set, and a `FORGEJO_MCP_ELEVATED_TOKEN` that differs from it. Do not
    widen this tier or relax the gate without explicit owner sign-off and a
    token-scope review. Never blanket-allowlist this server, and never allowlist
    `delete_repo` at all — its `confirm` argument catches a malformed call, not a
    misled one.
  - **Never exposed** — user and organisation administration, permissions,
    secrets, tokens. Not a coverage gap; permanently out of scope however
    complete the rest becomes.

  This replaced an earlier rule reading "read tools plus additive writes only".
  That rule had already eroded: `set_issue_state` closes issues, `remove_label`
  takes labels off, and `update_file` overwrites file content. It was still being
  used to exclude issue and pull request body edits while a blunter operation
  shipped in the same tier, which is not a line that can be defended. Do not
  restore it as a correction.

- **Coverage goal: the issue, pull request and repository workflow surface.**
  The repo-scoped API is roughly 145 paths and 250 operations; this server
  deliberately covers a fraction. The long tail — stopwatches, time tracking,
  reactions, pinning, subscriptions, dependencies — is demand-driven, so
  "complete coverage" means the workflow, not 250 tools.
- The token and base URL are supplied at runtime via `FORGEJO_TOKEN` and
  `FORGEJO_BASE_URL`. Never hardcode a token in the repo, configs, or tests. Use
  a least-privilege token (repository R/W, issue R/W, user Read).
- If you add or remove a tool, update the count asserted in `scripts/smoke.mjs`
  and the tool table in `README.md` in the same change. The count appears in
  four places — `BASE_TOOLS` and `EXPECTED_NAMES` in `scripts/smoke.mjs`, the
  README table, and the two mentions above — so change them together.

## Proving a check actually checks

`scripts/smoke.mjs` is asserted by mutation: break the implementation on purpose
and confirm the check fails. A green suite after a mutation means the assertion
is not testing what you think.

**Anchor every mutation on a string unique to the function under test, and
confirm it landed where you intended.** Two mutations during #88 and #89 silently
edited a different function, because the replaced text was not unique —
`{ method: 'DELETE' }` appears in both `removeLabel` and `deleteBranch`, and
`/branches/${ForgejoClient.seg(branch)}` in both `getBranch` and `deleteBranch`.
Both left the suite green, which is indistinguishable from real coverage. The
missing `delete_branch` coverage in #89 was found only because one misfire was
noticed.
