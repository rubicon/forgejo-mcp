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
or admin tools**. This keeps it safe for unattended use and caps the blast
radius of the API token. Pair it with a least-privilege token (repository R/W,
issue R/W, user Read).

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
| `list_pull_requests` | read | List PRs; filter by state; paginated |
| `get_pull_request` | read | A single PR with merge state |
| `get_pull_request_diff` | read | Unified diff for a PR as plain text |
| `create_pull_request` | write | Open a PR from a head branch into a base branch |
| `get_commit_status` | read | Combined CI/commit status for a ref |

## Configuration

Supply the target and token at runtime via environment variables:

- `FORGEJO_BASE_URL` — e.g. `https://git.example.com`
- `FORGEJO_TOKEN` — a Forgejo/Gitea API token

Never hardcode the token; inject it from a secret store at launch.

### Claude Code

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
