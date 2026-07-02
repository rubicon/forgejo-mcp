# Contributing to forgejo-mcp

Thanks for your interest in contributing. This project is developed on GitHub at
[`rubicon/forgejo-mcp`](https://github.com/rubicon/forgejo-mcp) and released under
the [Apache License 2.0](LICENSE).

By contributing, you agree that your contributions are licensed under Apache-2.0
and that you have the right to submit them.

## Ground rules

- Be respectful. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- Keep the security model intact: read tools plus additive writes only
  (`create_issue`, `create_issue_comment`, `create_pull_request`). There are no
  merge, delete, or admin tools by design. Proposing a destructive tool requires
  a design discussion in an issue first; it is not a routine PR.
- Never commit a token, secret, or a real `FORGEJO_BASE_URL`. The token and base
  URL are supplied at runtime through `FORGEJO_TOKEN` and `FORGEJO_BASE_URL`.

## Workflow

1. **Open an issue first** describing the change, its scope, and how you would
   verify it. Non-trivial changes should start from an issue; truly trivial fixes
   (a typo, a comment) may skip it but still go through a branch and a PR.
2. **Branch from `main`** using `dev/<issue-number>-<short-kebab-slug>`, for
   example `dev/12-add-list-branches-tool`. CI enforces the pattern
   `^dev/[0-9]+-[a-z0-9.-]+$`.
3. **Commit** in focused, semantic commits. Messages follow
   [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) with the
   type set `feat`, `fix`, `chore`, `docs`, `test`, `ci`, `refactor`, `build`,
   `perf`, `revert`, `style`. Commits to `main` must be signed; sign your commits
   if you can (`git commit -S`).
4. **Open a pull request** into `main`. The PR title uses a Conventional Commits
   type, and the body links its issue with a closing keyword such as
   `Closes #12`. Say what changed, why, and how you verified it.
5. **Green checks required.** CI runs build, typecheck, and the smoke test on
   Node 18, 20, and 22, plus PR-title, branch-name, commit-message, and
   issue-link policy checks. All must pass before merge.

## Verifying locally

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run smoke       # builds, then runs a token-free MCP handshake + tools/list
```

The smoke test asserts the exact tool count. If you add or remove a tool, update
that count in `scripts/smoke.mjs` and the tool table in `README.md` in the same
change.

## Style

- TypeScript and JavaScript are formatted with [Prettier](https://prettier.io).
  Match the surrounding code; do not reformat unrelated lines.
- YAML files use the `.yaml` extension, except where a tool requires otherwise
  (for example GitHub's `dependabot.yml`).
- New source files carry an `SPDX-License-Identifier: Apache-2.0` header.

## Upstream note

This is an independent, clean-room implementation, not a fork of any existing
project (see [NOTICE](NOTICE)). Please do not paste code from other Forgejo/Gitea
MCP servers into a contribution here.
