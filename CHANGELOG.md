# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.0](https://github.com/rubicon/forgejo-mcp/compare/v0.9.0...v0.10.0) (2026-08-20)


### Added

* list the files a pull request changes ([#86](https://github.com/rubicon/forgejo-mcp/issues/86)) ([379726b](https://github.com/rubicon/forgejo-mcp/commit/379726b8b428484f4f42c7b178041be028a17644)), closes [#85](https://github.com/rubicon/forgejo-mcp/issues/85)

## [0.9.0](https://github.com/rubicon/forgejo-mcp/compare/v0.8.0...v0.9.0) (2026-08-20)


### Added

* inline review comments and commit_id on reviews ([#83](https://github.com/rubicon/forgejo-mcp/issues/83)) ([d6c4848](https://github.com/rubicon/forgejo-mcp/commit/d6c48489bb3d43634dfec4785be4ec60534433f1)), closes [#82](https://github.com/rubicon/forgejo-mcp/issues/82)

## [0.8.0](https://github.com/rubicon/forgejo-mcp/compare/v0.7.0...v0.8.0) (2026-08-20)


### Added

* close and reopen issues ([#78](https://github.com/rubicon/forgejo-mcp/issues/78)) ([8d42be5](https://github.com/rubicon/forgejo-mcp/commit/8d42be540713605d667e5c19163ef8fc92b67db8)), closes [#77](https://github.com/rubicon/forgejo-mcp/issues/77)


### Fixed

* enforce the enums the tool schemas advertise ([#81](https://github.com/rubicon/forgejo-mcp/issues/81)) ([c4e5b2f](https://github.com/rubicon/forgejo-mcp/commit/c4e5b2fb429942a8d6f171e9e0dd9aba20ce77b7)), closes [#79](https://github.com/rubicon/forgejo-mcp/issues/79)

## [0.7.0](https://github.com/rubicon/forgejo-mcp/compare/v0.6.0...v0.7.0) (2026-08-16)


### ⚠ BREAKING CHANGES

* list tools return { total_count, count, page, items } instead of a bare array. Read the array from items.

### Added

* report pagination metadata from list tools ([#75](https://github.com/rubicon/forgejo-mcp/issues/75)) ([cc83cf7](https://github.com/rubicon/forgejo-mcp/commit/cc83cf7af6fcef939a53ec46f707e28f5da6543d))

## [0.6.0](https://github.com/rubicon/forgejo-mcp/compare/v0.5.0...v0.6.0) (2026-08-15)


### ⚠ BREAKING CHANGES

* **elevated:** merge_pull_request requires head_commit_id. Read it from get_pull_request (head.sha) before merging.

### Added

* **elevated:** pin merge_pull_request to a reviewed head SHA ([#73](https://github.com/rubicon/forgejo-mcp/issues/73)) ([861f593](https://github.com/rubicon/forgejo-mcp/commit/861f593e50c91d37024d31f119824c8a4dece72a)), closes [#70](https://github.com/rubicon/forgejo-mcp/issues/70)

## [0.5.0](https://github.com/rubicon/forgejo-mcp/compare/v0.4.0...v0.5.0) (2026-08-15)


### ⚠ BREAKING CHANGES

* list_issues returns issues only by default. Pass type: 'all' for the previous mixed issue-and-pull-request result.

### Fixed

* correct four tool-contract defects ([#71](https://github.com/rubicon/forgejo-mcp/issues/71)) ([d7826b6](https://github.com/rubicon/forgejo-mcp/commit/d7826b68c32b608eb3932393658a690ed2fc2951)), closes [#68](https://github.com/rubicon/forgejo-mcp/issues/68)

## [0.4.0](https://github.com/rubicon/forgejo-mcp/compare/v0.3.0...v0.4.0) (2026-07-30)


### Added

* add PR reviews + metadata tools ([#53](https://github.com/rubicon/forgejo-mcp/issues/53)) ([4350bb2](https://github.com/rubicon/forgejo-mcp/commit/4350bb2480e69318d139e14b341ca7f27ee3cbd7)), closes [#52](https://github.com/rubicon/forgejo-mcp/issues/52)


### Fixed

* **ci:** address the release-please 1Password item by UUID ([#65](https://github.com/rubicon/forgejo-mcp/issues/65)) ([1552ec6](https://github.com/rubicon/forgejo-mcp/commit/1552ec60b427fbae25003d9726aef168b60e88ac)), closes [#64](https://github.com/rubicon/forgejo-mcp/issues/64)

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
