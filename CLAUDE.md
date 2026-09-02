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
npm run smoke      # build + handshake; asserts BASE_TOOLS in scripts/smoke.mjs (currently 54) + version == package.json
npm run typecheck  # tsc --noEmit
```

The server version is injected at build time: `scripts/build.mjs` reads
`package.json` and passes it to esbuild `define` as `__PKG_VERSION__`, referenced
in `src/index.ts`. Do not hardcode a version literal.

## Architecture

See `ARCHITECTURE.md`. In brief: `src/index.ts` wires MCP over stdio;
`src/client.ts` is the typed Forgejo REST client; `src/tools.ts` holds the tool
definitions and handlers (54 base `tools` + 6 opt-in `elevatedTools`);
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
    `delete_branch` (may lose unmerged commits),
    `delete_repo` (no undo by any means), `delete_label` (strips the label
    from every issue and pull request that carried it, and neither the label nor
    those associations can be restored), `delete_release` (notes and assets do
    not live in `git`), and `delete_tag` (may orphan commits no branch reaches).

    Note what this boundary is *not*: "writes to the default branch" would pull
    in `create_file` and `update_file`, which target the default branch when no
    branch is given. Those stay in the default surface deliberately — the damage
    is a recorded commit and `git` can revert it.

    `create_release` and `create_tag` also default to the default branch and
    stay in the default surface. They were previously defended on the grounds
    that the release surface was additive-only, which was the same reasoning
    retired everywhere else; that defence is gone, and the placement now rests
    on the same test as everything else. Creating a release or a tag is a
    recorded, visible act that `delete_release` and `delete_tag` can undo.

    Those two deletes are elevated, resolved in #129. A release carries notes
    and uploaded assets that never existed in `git`, so no clone can restore
    them; a tag may be the only pointer to its commits, which is the reasoning
    that placed `delete_branch` in the tier. Do not reconstruct the
    additive-only justification as a correction: it was retired, not
    overlooked.

    `create_repo` was removed in #142 and must not be added back. It posted to
    `/user/repos`, which Forgejo gates behind `write:user` — the same scope that
    grants adding an SSH key, adding a GPG signing key, and changing the
    account's email addresses (verified live: all four endpoints return the
    identical `required scope(s): [write:user]`). Enabling the tool therefore
    means handing the elevated token a scope from the **never exposed** tier
    below, so that an agent could plant a credential outliving the token. There
    is no narrower scope to reach for: the org-scoped `POST /orgs/{org}/repos`
    needs `write:organization` and does not apply to a user account. The tier is
    now uniformly destructive, every member prefixed
    `[ELEVATED — DESTRUCTIVE]` with `destructiveHint: true`; a tool that does not
    destroy something unrecoverable does not belong in it.

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
