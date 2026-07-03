# forgejo-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI
clients tools to work with a [Forgejo](https://forgejo.org) or Gitea instance
over its REST API: repositories, issues, comments, files, pull requests, and CI
status.

It speaks MCP over stdio and calls the Forgejo/Gitea REST API with `fetch`. The
whole server bundles to a single `dist/index.js` with no runtime framework.

## Security model

The server exposes **read tools plus additive writes only** — creating issues,
issue/PR comments, and pull requests. There are deliberately **no merge, delete,
or admin tools** in the default surface. This keeps it safe for unattended use
and caps the blast radius of the API token. Pair it with a least-privilege token
(repository R/W, issue R/W, user Read).

A small set of destructive operations is available behind an
[opt-in, off-by-default elevated tier](#elevated-tier-opt-in-off-by-default).
With no elevated environment variables set, the tool surface is byte-identical
to the safe default described above.

## Tools

| Tool | Kind | Purpose |
|------|------|---------|
| `list_repositories` | read | List a user's repositories (default: authenticated user) |
| `get_repository` | read | Repository metadata, including default branch |
| `list_issues` | read | List issues; filter by state and labels; paginated |
| `get_issue` | read | A single issue with body, labels, assignees |
| `create_issue` | write | Open an issue (optional labels, assignees) |
| `list_issue_comments` | read | Comments on an issue or PR |
| `create_issue_comment` | write | Add a comment to an issue or PR |
| `get_file_content` | read | Decoded file content (default branch if no ref) |
| `list_directory` | read | List a directory's entries (root if no path) |
| `create_file` | write | Create a file from plain-text content (optional new branch) |
| `update_file` | write | Replace a file's content (pass `sha` to guard concurrent edits) |
| `list_pull_requests` | read | List PRs; filter by state; paginated |
| `get_pull_request` | read | A single PR with merge state |
| `get_pull_request_diff` | read | Unified diff for a PR as plain text |
| `create_pull_request` | write | Open a PR from a head branch into a base branch |
| `get_commit_status` | read | Combined CI/commit status for a ref |
| `list_branches` | read | List branches with latest commit and protection status; paginated |
| `get_branch` | read | A single branch by name |
| `create_branch` | write | Create a branch from a source ref (default branch if none) |
| `list_commits` | read | List commits; filter by start ref and path; paginated |
| `get_commit` | read | A single commit by SHA or ref |
| `list_releases` | read | List releases; paginated |
| `get_release` | read | A single release by ID, with notes and draft/prerelease flags |
| `create_release` | write | Create a release for a tag (draft, prerelease, notes) |
| `list_tags` | read | List tags with their target commits; paginated |
| `get_tag` | read | A single tag by name |
| `create_tag` | write | Create a tag on a branch or commit (optionally annotated) |
| `list_pull_request_reviews` | read | Reviews on a PR (approvals, change requests, comments) |
| `create_pull_request_review` | write | Submit a review (`APPROVE`, `REQUEST_CHANGES`, or `COMMENT`) |
| `request_pull_request_reviewers` | write | Request reviews from users (and org teams) on a PR |
| `list_labels` | read | Labels defined in a repository (id, name, color); paginated |
| `add_labels` | write | Add labels (by id) to an issue or PR; existing labels kept |
| `add_assignees` | write | Assign users to an issue or PR; existing assignees kept |

## Configuration

Supply the target and token at runtime via environment variables:

- `FORGEJO_BASE_URL` — e.g. `https://git.example.com`
- `FORGEJO_TOKEN` — a Forgejo/Gitea API token

Never hardcode the token; inject it from a secret store at launch.

### Claude Code

Two setups, both good — pick by whether you value portability or keeping the
token out of Claude's config file.

#### Option A — `npx` (recommended)

Once the package is on npm, no local checkout or build is needed:

```sh
claude mcp add forgejo \
  --env FORGEJO_BASE_URL=https://git.example.com \
  --env FORGEJO_TOKEN=... \
  -- npx -y @rubicontv/forgejo-mcp
```

Portable and self-updating. Note this stores the token in Claude Code's config
(`~/.claude.json`). If you would rather the token never touch that file, use
Option B.

#### Option B — local wrapper (keeps the token out of config)

A small launcher sources a `chmod 600` env file at startup, so the token lives
only in that file (ideally hydrated from a secret manager) and never in
`~/.claude.json`:

```sh
#!/bin/sh
# ~/.config/forgejo-mcp/launch.sh
set -eu
. "$HOME/.config/forgejo-mcp/forgejo-mcp.env"   # sets FORGEJO_BASE_URL, FORGEJO_TOKEN
export FORGEJO_BASE_URL FORGEJO_TOKEN
exec npx -y @rubicontv/forgejo-mcp                # or: exec node /path/to/forgejo-mcp/dist/index.js
```

Point Claude Code at the wrapper — no `env` block, so no secret in the config:

```json
{
  "mcpServers": {
    "forgejo": {
      "command": "/Users/you/.config/forgejo-mcp/launch.sh"
    }
  }
}
```

#### Running from a local build (no npm)

If you are working from a checkout instead of the published package:

```json
{
  "mcpServers": {
    "forgejo": {
      "command": "node",
      "args": ["/path/to/forgejo-mcp/dist/index.js"],
      "env": {
        "FORGEJO_BASE_URL": "https://git.example.com",
        "FORGEJO_TOKEN": "..."
      }
    }
  }
}
```

#### Allowlisting

To let an agent use the server without a prompt on every call, allowlist it. On
the **safe default surface** (no elevated tier), blanket-allowlisting the whole
server is fine:

```
mcp__forgejo
```

**If you turn on the elevated tier, do _not_ do this** — a blanket allowlist
would let `merge_pull_request` / `delete_branch` run without a prompt too.
Allowlist only the specific safe tools instead, e.g.:

```
mcp__forgejo__create_issue
mcp__forgejo__create_pull_request
```

See the allowlist warning in the [Elevated tier](#elevated-tier-opt-in-off-by-default)
section below.

## Elevated tier (opt-in, off by default)

The server can optionally expose a **minimal set of destructive tools**. This
tier is **off by default** and must be deliberately enabled by the operator.

| Tool | Kind | Operation |
|------|------|-----------|
| `merge_pull_request` | elevated | Merge a PR (`merge` / `rebase` / `squash`) into its base branch |
| `delete_branch` | elevated | Permanently delete a branch |

Each elevated tool's description is prefixed with `[ELEVATED — DESTRUCTIVE]`.

### Why it is gated so carefully

This server hands tools to an LLM that reads **untrusted content** — issue
bodies, PR text, file contents. That is a prompt-injection surface: a misled
agent should never be able to merge or delete anything. So the elevated tier is
**double-gated** and uses a **separate token**.

### Enabling it — the double gate

Elevated tools are registered **only when BOTH** of these are set:

- `FORGEJO_MCP_ELEVATED=1` — an explicit opt-in flag, and
- `FORGEJO_MCP_ELEVATED_TOKEN` — a token **distinct** from `FORGEJO_TOKEN`.

The default `FORGEJO_TOKEN` **never** performs an elevated operation — elevated
calls use `FORGEJO_MCP_ELEVATED_TOKEN` exclusively. Scope that token to only the
repositories and permissions the destructive tools actually need.

If `FORGEJO_MCP_ELEVATED=1` is set but `FORGEJO_MCP_ELEVATED_TOKEN` is missing,
the server **fails closed**: the elevated tools are not registered and a warning
is logged to stderr.

```json
{
  "mcpServers": {
    "forgejo": {
      "command": "node",
      "args": ["/path/to/forgejo-mcp/dist/index.js"],
      "env": {
        "FORGEJO_BASE_URL": "https://git.example.com",
        "FORGEJO_TOKEN": "…read/write token…",
        "FORGEJO_MCP_ELEVATED": "1",
        "FORGEJO_MCP_ELEVATED_TOKEN": "…distinct, narrowly-scoped token…"
      }
    }
  }
}
```

### ⚠️ Allowlist warning — read before enabling

This MCP is commonly **whole-server allowlisted** (e.g. `mcp__forgejo`) so an
agent can use it autonomously without per-call prompts. **If you enable the
elevated tier under a blanket allowlist, the destructive tools also run without
any prompt.** A single prompt-injection payload in an issue or PR could then
merge or delete on your behalf.

Therefore, when the elevated tier is on:

- **Do NOT blanket-allow the whole server** (`mcp__forgejo`).
- **Allowlist only the specific safe tools** you want to run autonomously
  (e.g. `mcp__forgejo__create_issue`), and leave `merge_pull_request` /
  `delete_branch` to require an explicit prompt each time.

The server cannot enforce the client's allowlist — distinct tool naming and this
warning are the mitigation. Enabling elevated tools is a decision the operator
owns.

### Permanently excluded

The elevated tier is intentionally tiny. The following are **never** exposed,
regardless of any flag: user management, secret/variable writes, permission or
collaborator changes, and org/repo admin. Those are not appropriate to hand to
an LLM that reads untrusted content, so they stay out by design. Adding any
destructive tool requires explicit owner sign-off and a matching token-scope
review.

## Build and test

```bash
npm install
npm run build     # esbuild -> dist/index.js
npm run smoke     # builds, then runs a token-free MCP handshake + tools/list
npm run typecheck # tsc --noEmit
```

## Contributors

[![Contributors](https://contrib.rocks/image?repo=rubicon/forgejo-mcp)](https://github.com/rubicon/forgejo-mcp/graphs/contributors)

See [CONTRIBUTING.md](CONTRIBUTING.md) to get started, the
[Code of Conduct](CODE_OF_CONDUCT.md) for community expectations, and
[SECURITY.md](SECURITY.md) to report a vulnerability privately.

## License and attribution

Licensed under the [Apache License 2.0](LICENSE). This is an independent,
clean-room implementation; see [NOTICE](NOTICE). It was inspired by
[`nsvk13/forgejo-mcp-server`](https://github.com/nsvk13/forgejo-mcp-server),
with thanks, but shares no source code with it.
