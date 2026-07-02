# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0](https://github.com/rubicon/forgejo-mcp/compare/v0.1.0...v0.2.0) (2026-07-02)


### Added

* initial clean-room Apache-2.0 forgejo-mcp server (13 tools) ([8b8d407](https://github.com/rubicon/forgejo-mcp/commit/8b8d4073d2049a56e59dabb79805b97990425de9))

## [0.1.0] - 2026-07-02

Initial release. Independent, clean-room Model Context Protocol server for
Forgejo/Gitea.

### Added

- 13 tools: `list_repositories`, `get_repository`, `list_issues`, `get_issue`,
  `create_issue`, `list_issue_comments`, `create_issue_comment`,
  `get_file_content`, `list_pull_requests`, `get_pull_request`,
  `get_pull_request_diff`, `create_pull_request`, `get_commit_status`.
- Structured JSON output from every tool.
- Typed `ForgejoClient` with URL-encoded path segments, response-body error
  detail, pagination parameters, and default-branch resolution (an omitted
  `ref` is left off the request rather than assumed to be `main`).
- Node-native esbuild build and a token-free MCP smoke test.
