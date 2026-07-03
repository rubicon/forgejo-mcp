# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0](https://github.com/rubicon/forgejo-mcp/compare/v0.2.0...v0.3.0) (2026-07-03)


### Added

* add branch tools (list_branches, get_branch, create_branch) ([#39](https://github.com/rubicon/forgejo-mcp/issues/39)) ([43edfc4](https://github.com/rubicon/forgejo-mcp/commit/43edfc4903942f01ba1c7722dda2ef7e23f80726)), closes [#38](https://github.com/rubicon/forgejo-mcp/issues/38)
* add commit tools (list_commits, get_commit) ([#42](https://github.com/rubicon/forgejo-mcp/issues/42)) ([3bcae03](https://github.com/rubicon/forgejo-mcp/commit/3bcae03dfc9be3f55fa549d294588ca59aed371c)), closes [#40](https://github.com/rubicon/forgejo-mcp/issues/40)
* add repository file tools (create_file, update_file, list_directory) ([#36](https://github.com/rubicon/forgejo-mcp/issues/36)) ([bde1e6f](https://github.com/rubicon/forgejo-mcp/commit/bde1e6fec88fcbc9eaaf755cafb87120e9999251)), closes [#35](https://github.com/rubicon/forgejo-mcp/issues/35)


### Fixed

* derive MCP handshake version from package.json at build time ([#45](https://github.com/rubicon/forgejo-mcp/issues/45)) ([d275bfe](https://github.com/rubicon/forgejo-mcp/commit/d275bfec201c6b0322ef197791d9b6bf2bd145af)), closes [#44](https://github.com/rubicon/forgejo-mcp/issues/44)

## [0.2.0](https://github.com/rubicon/forgejo-mcp/compare/v0.1.0...v0.2.0) (2026-07-03)


### Added

* add opt-in elevated tier (merge_pull_request, delete_branch) ([#25](https://github.com/rubicon/forgejo-mcp/issues/25)) ([ffd877e](https://github.com/rubicon/forgejo-mcp/commit/ffd877e4178011da488bd32bde39069320aef204)), closes [#22](https://github.com/rubicon/forgejo-mcp/issues/22)
* add release + tag tools (create/list/get) ([#24](https://github.com/rubicon/forgejo-mcp/issues/24)) ([f0d2313](https://github.com/rubicon/forgejo-mcp/commit/f0d2313209f3f4bd8ff5541cdfc0ff490d0b4190)), closes [#21](https://github.com/rubicon/forgejo-mcp/issues/21)

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
