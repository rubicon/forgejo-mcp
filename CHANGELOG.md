# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.13.0](https://github.com/rubicon/forgejo-mcp/compare/v0.12.0...v0.13.0) (2026-08-22)


### ⚠ BREAKING CHANGES

* list_directory returns { total_count, count, page, items } and fails on a path that names a file. Read the entries from items; use get_file_content for files.

### Added

* accept label names on add_labels, and make list_directory list directories ([#104](https://github.com/rubicon/forgejo-mcp/issues/104)) ([6b4e22f](https://github.com/rubicon/forgejo-mcp/commit/6b4e22f36983fcbf1dfc27833e9fa48395a27484)), closes [#101](https://github.com/rubicon/forgejo-mcp/issues/101)

## [Unreleased]

Nothing yet.

## [0.12.0](https://github.com/rubicon/forgejo-mcp/compare/v0.11.0...v0.12.0) (2026-08-20)

Finding open issues that mention you, updated this week, meant fetching pages and filtering them yourself. Both listing tools now take the filters their endpoints have always accepted, including text search, milestones, authorship, and sort. The two endpoints disagree about almost everything. Milestones go by name on one and by id on the other, and the sort values overlap without matching, so the tools mirror the API rather than inventing a tidier contract that Forgejo would ignore. Label filtering on pull requests was also being sent comma-joined to an endpoint that wanted repeated parameters, so it had been silently doing nothing.


### Added

* expose the issue and pull request listing filters ([#95](https://github.com/rubicon/forgejo-mcp/issues/95)) ([a860586](https://github.com/rubicon/forgejo-mcp/commit/a860586da846dd5a96e7b3a128c124c94d7e0c39)), closes [#94](https://github.com/rubicon/forgejo-mcp/issues/94)

## [0.11.0](https://github.com/rubicon/forgejo-mcp/compare/v0.10.0...v0.11.0) (2026-08-20)

Labels could go on and never come off, which is a fine arrangement for tattoos and a poor one for issue triage. Removing one takes a name or an id, so resolving through the label list first is optional. It sits in the safe tier rather than behind the elevated gate: labels are metadata, reattaching is one call, and the timeline records it. The same work turned up that delete_branch, which permanently deletes branches, had no test coverage at all.


### Added

* remove a label from an issue or pull request ([#90](https://github.com/rubicon/forgejo-mcp/issues/90)) ([d7f6911](https://github.com/rubicon/forgejo-mcp/commit/d7f691129070817689fc954fb165832492f460c7)), closes [#88](https://github.com/rubicon/forgejo-mcp/issues/88)

## [0.10.0](https://github.com/rubicon/forgejo-mcp/compare/v0.9.0...v0.10.0) (2026-08-20)

Reviews could comment on a specific line as of the last release, with no way to discover which lines existed. The only route was the entire unified diff as one blob, to be parsed by the caller. Pull requests now list their changed files with status and line counts, paginated like everything else. The whitespace and skip-to parameters stay unexposed, since one is a cursor into a diff this tool does not return.


### Added

* list the files a pull request changes ([#86](https://github.com/rubicon/forgejo-mcp/issues/86)) ([379726b](https://github.com/rubicon/forgejo-mcp/commit/379726b8b428484f4f42c7b178041be028a17644)), closes [#85](https://github.com/rubicon/forgejo-mcp/issues/85)

## [0.9.0](https://github.com/rubicon/forgejo-mcp/compare/v0.8.0...v0.9.0) (2026-08-20)

A review that cannot point at a line says only that something, somewhere, is wrong. Reviews now carry inline comments anchored to a file and line, and a commit SHA so they stay attached to the diff that was actually read. Comments missing a path or a body are refused here rather than sent, because Forgejo accepts them and files a degraded review with a success response. Positions have to be whole numbers, which was not true until review pointed out that the schema said so and nothing checked.


### Added

* inline review comments and commit_id on reviews ([#83](https://github.com/rubicon/forgejo-mcp/issues/83)) ([d6c4848](https://github.com/rubicon/forgejo-mcp/commit/d6c48489bb3d43634dfec4785be4ec60534433f1)), closes [#82](https://github.com/rubicon/forgejo-mcp/issues/82)

## [0.8.0](https://github.com/rubicon/forgejo-mcp/compare/v0.7.0...v0.8.0) (2026-08-20)

The workflow this server exists to support ends with closing an issue, which it could not do. That is now fixed, along with the discovery that every enum in the tool surface was decoration: nothing validated arguments before a handler ran, so any value at all reached the API. The review event enum was the dangerous one, since an unrecognised value does not error in Forgejo. It falls through to a pending draft and reports success, which is the bug from 0.5.0 arriving by a different road.


### Added

* close and reopen issues ([#78](https://github.com/rubicon/forgejo-mcp/issues/78)) ([8d42be5](https://github.com/rubicon/forgejo-mcp/commit/8d42be540713605d667e5c19163ef8fc92b67db8)), closes [#77](https://github.com/rubicon/forgejo-mcp/issues/77)


### Fixed

* enforce the enums the tool schemas advertise ([#81](https://github.com/rubicon/forgejo-mcp/issues/81)) ([c4e5b2f](https://github.com/rubicon/forgejo-mcp/commit/c4e5b2fb429942a8d6f171e9e0dd9aba20ce77b7)), closes [#79](https://github.com/rubicon/forgejo-mcp/issues/79)

## [0.7.0](https://github.com/rubicon/forgejo-mcp/compare/v0.6.0...v0.7.0) (2026-08-18)

A list of thirty repositories and a list of the first thirty of fifty-one look identical when both are a bare array. Forgejo has been sending the real total in a header the whole time and this server was discarding it. List tools now return the count, the page, and the total alongside the items, so a caller can tell a complete answer from a slice of one. Reading the array from items instead of the response is the cost.


### ⚠ BREAKING CHANGES

* list tools return { total_count, count, page, items } instead of a bare array. Read the array from items.

### Added

* report pagination metadata from list tools ([#75](https://github.com/rubicon/forgejo-mcp/issues/75)) ([cc83cf7](https://github.com/rubicon/forgejo-mcp/commit/cc83cf7af6fcef939a53ec46f707e28f5da6543d))

## [0.6.0](https://github.com/rubicon/forgejo-mcp/compare/v0.5.0...v0.6.0) (2026-08-15)

An agent could merge a pull request it had never read. merge_pull_request took a number and a strategy, which is enough to merge anything you can count to, including code pushed after the review that approved it. It now requires the head SHA, which can only come from reading the pull request first, and Forgejo refuses the merge if the branch moved since. The guard is one field long and should have been there from the start.


### ⚠ BREAKING CHANGES

* **elevated:** merge_pull_request requires head_commit_id. Read it from get_pull_request (head.sha) before merging.

### Added

* **elevated:** pin merge_pull_request to a reviewed head SHA ([#73](https://github.com/rubicon/forgejo-mcp/issues/73)) ([861f593](https://github.com/rubicon/forgejo-mcp/commit/861f593e50c91d37024d31f119824c8a4dece72a)), closes [#70](https://github.com/rubicon/forgejo-mcp/issues/70)

## [0.5.0](https://github.com/rubicon/forgejo-mcp/compare/v0.4.0...v0.5.0) (2026-08-15)

The review tool has been reporting success while filing nothing since the day it shipped. Forgejo calls an approval APPROVED; this server sent APPROVE, which matches no state Forgejo recognises, so every approval quietly became a pending draft and returned 200 anyway. Three more of the same shape came out of the same audit: issue listings that included pull requests, a repository listing that showed thirty of fifty-one and said nothing, and a required field marked optional. Four calls that looked like they worked.


### ⚠ BREAKING CHANGES

* list_issues returns issues only by default. Pass type: 'all' for the previous mixed issue-and-pull-request result.

### Fixed

* correct four tool-contract defects ([#71](https://github.com/rubicon/forgejo-mcp/issues/71)) ([d7826b6](https://github.com/rubicon/forgejo-mcp/commit/d7826b68c32b608eb3932393658a690ed2fc2951)), closes [#68](https://github.com/rubicon/forgejo-mcp/issues/68)

## [0.4.0](https://github.com/rubicon/forgejo-mcp/compare/v0.3.0...v0.4.0) (2026-08-03)

Pull request reviews can be read and written, which closes the gap between opening a pull request and doing anything useful with it afterwards. Labels and assignees came along in the same slice, since a review workflow that cannot triage is only half a workflow. The rest of this release is release-pipeline plumbing that only matters when it breaks, and it broke twice.


### Added

* add PR reviews + metadata tools ([#53](https://github.com/rubicon/forgejo-mcp/issues/53)) ([4350bb2](https://github.com/rubicon/forgejo-mcp/commit/4350bb2480e69318d139e14b341ca7f27ee3cbd7)), closes [#52](https://github.com/rubicon/forgejo-mcp/issues/52)


### Fixed

* **ci:** address the release-please 1Password item by UUID ([#65](https://github.com/rubicon/forgejo-mcp/issues/65)) ([1552ec6](https://github.com/rubicon/forgejo-mcp/commit/1552ec60b427fbae25003d9726aef168b60e88ac)), closes [#64](https://github.com/rubicon/forgejo-mcp/issues/64)

## [0.3.0](https://github.com/rubicon/forgejo-mcp/compare/v0.2.0...v0.3.0) (2026-07-03)

Reading a file required knowing its path already, since nothing could list a directory. That is fixed, along with the branch and commit tools that make it possible to see what a repository contains before writing to it. The handshake version also stopped being a literal that someone had to remember to bump, which it had already failed to be. It now comes from package.json at build time.


### Added

* add branch tools (list_branches, get_branch, create_branch) ([#39](https://github.com/rubicon/forgejo-mcp/issues/39)) ([43edfc4](https://github.com/rubicon/forgejo-mcp/commit/43edfc4903942f01ba1c7722dda2ef7e23f80726)), closes [#38](https://github.com/rubicon/forgejo-mcp/issues/38)
* add commit tools (list_commits, get_commit) ([#42](https://github.com/rubicon/forgejo-mcp/issues/42)) ([3bcae03](https://github.com/rubicon/forgejo-mcp/commit/3bcae03dfc9be3f55fa549d294588ca59aed371c)), closes [#40](https://github.com/rubicon/forgejo-mcp/issues/40)
* add repository file tools (create_file, update_file, list_directory) ([#36](https://github.com/rubicon/forgejo-mcp/issues/36)) ([bde1e6f](https://github.com/rubicon/forgejo-mcp/commit/bde1e6fec88fcbc9eaaf755cafb87120e9999251)), closes [#35](https://github.com/rubicon/forgejo-mcp/issues/35)


### Fixed

* derive MCP handshake version from package.json at build time ([#45](https://github.com/rubicon/forgejo-mcp/issues/45)) ([d275bfe](https://github.com/rubicon/forgejo-mcp/commit/d275bfec201c6b0322ef197791d9b6bf2bd145af)), closes [#44](https://github.com/rubicon/forgejo-mcp/issues/44)

## [0.2.0](https://github.com/rubicon/forgejo-mcp/compare/v0.1.0...v0.2.0) (2026-07-03)

Merging and deleting branches are the two operations you least want an agent doing unsupervised, so they now live behind a tier that stays off unless two separate environment variables say otherwise, one of which is a token distinct from the everyday one. Miss either and the tool surface is byte for byte what it was, which is the point. Releases and tags also became first-class rather than something to shell out for. The safe surface remains read plus additive writes, and that is not an accident of what got built first.


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
