# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-02

Initial release. Independent, clean-room Model Context Protocol server for
Forgejo/Gitea, licensed under Apache-2.0.

### Added

- 13 tools over the Forgejo/Gitea REST API: `list_repositories`,
  `get_repository`, `list_issues`, `get_issue`, `create_issue`,
  `list_issue_comments`, `create_issue_comment`, `get_file_content`,
  `list_pull_requests`, `get_pull_request`, `get_pull_request_diff`,
  `create_pull_request`, `get_commit_status`.
- Read tools plus additive writes only (issues, comments, pull requests); no
  merge, delete, or admin surface, capping the blast radius of the API token.
- Structured JSON output from every tool; the pull-request diff is returned as
  raw unified-diff text.
- Typed `ForgejoClient` with URL-encoded path segments, response-body error
  detail, pagination parameters, and default-branch resolution (an omitted
  `ref` is left off the request rather than assumed to be `main`).
- Runtime configuration via `FORGEJO_BASE_URL` and `FORGEJO_TOKEN`; no secrets
  are hardcoded.
- Node-native esbuild build and a token-free MCP smoke test.
