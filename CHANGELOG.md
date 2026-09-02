# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.17.0](https://github.com/rubicon/forgejo-mcp/compare/v0.16.0...v0.17.0) (2026-09-02)


### Added

* **tools:** add edit_pull_request ([#146](https://github.com/rubicon/forgejo-mcp/issues/146)) ([fe5064f](https://github.com/rubicon/forgejo-mcp/commit/fe5064f836a91947a8a3fc2d02cf5a8d22842685)), closes [#130](https://github.com/rubicon/forgejo-mcp/issues/130)

## [0.16.0](https://github.com/rubicon/forgejo-mcp/compare/v0.15.0...v0.16.0) (2026-09-02)


### ⚠ BREAKING CHANGES

* **elevated:** create_repo is removed from the elevated tier. The elevated surface is now 6 tools and the full surface 59.

### Fixed

* **elevated:** remove create_repo and correct every tier enumeration ([#144](https://github.com/rubicon/forgejo-mcp/issues/144)) ([9faf8c3](https://github.com/rubicon/forgejo-mcp/commit/9faf8c39df13ecc2a0c5df9caa3f07bb9207770c)), closes [#142](https://github.com/rubicon/forgejo-mcp/issues/142) [#143](https://github.com/rubicon/forgejo-mcp/issues/143)

## [Unreleased]

Nothing yet.

## [0.15.0](https://github.com/rubicon/forgejo-mcp/compare/v0.14.0...v0.15.0) (2026-08-31)

Since the first release this server could attach a milestone without being able to tell you which milestones existed, post a comment without being able to correct a typo in it, and write a file it had no way to remove. Twenty tools later, all three are closed, and the surface stops asking callers for identifiers it refused to hand out. The more useful find was in the check rather than the code: swapping the elevated token for the everyday one passed the whole suite, on a tool that had shipped in that tier since #106. The stub now records which credential actually arrives, so the trust boundary is asserted rather than assumed. Deleting a label, a release or a tag is elevated, because none of the three can be undone from here.


### Added

* **tools:** add create_commit_status and list_commit_statuses ([#134](https://github.com/rubicon/forgejo-mcp/issues/134)) ([3a0479b](https://github.com/rubicon/forgejo-mcp/commit/3a0479bb3f60991b79bd9d3923cc63abee5a5967)), closes [#126](https://github.com/rubicon/forgejo-mcp/issues/126)
* **tools:** add delete_file ([#135](https://github.com/rubicon/forgejo-mcp/issues/135)) ([8054511](https://github.com/rubicon/forgejo-mcp/commit/8054511ed4da235d4ce8fea69250a5532ca3958b)), closes [#128](https://github.com/rubicon/forgejo-mcp/issues/128)
* **tools:** add edit_issue for issue and pull request content edits ([#131](https://github.com/rubicon/forgejo-mcp/issues/131)) ([be49344](https://github.com/rubicon/forgejo-mcp/commit/be4934442af5c9988ab765f06bac7391e207768f)), closes [#123](https://github.com/rubicon/forgejo-mcp/issues/123)
* **tools:** add edit_issue_comment and delete_issue_comment ([#133](https://github.com/rubicon/forgejo-mcp/issues/133)) ([9110b7c](https://github.com/rubicon/forgejo-mcp/commit/9110b7c96134186eac37985d60f8807fa9f21c86)), closes [#125](https://github.com/rubicon/forgejo-mcp/issues/125)
* **tools:** add label definition tools, delete_label elevated ([#136](https://github.com/rubicon/forgejo-mcp/issues/136)) ([5429673](https://github.com/rubicon/forgejo-mcp/commit/5429673328079c299e3df03a2eda473580af24dd)), closes [#127](https://github.com/rubicon/forgejo-mcp/issues/127)
* **tools:** add milestone tools ([#132](https://github.com/rubicon/forgejo-mcp/issues/132)) ([d6223e3](https://github.com/rubicon/forgejo-mcp/commit/d6223e31a56dce3638dd959489b47e5c6a40356a)), closes [#124](https://github.com/rubicon/forgejo-mcp/issues/124)
* **tools:** add release reads, edit_release, and elevated release and tag deletion ([#137](https://github.com/rubicon/forgejo-mcp/issues/137)) ([631543c](https://github.com/rubicon/forgejo-mcp/commit/631543ceb5fecb737a4dad10145d5534f9e2b945)), closes [#129](https://github.com/rubicon/forgejo-mcp/issues/129)
* **tools:** let merge_pull_request request head-branch deletion ([#121](https://github.com/rubicon/forgejo-mcp/issues/121)) ([3b8d856](https://github.com/rubicon/forgejo-mcp/commit/3b8d856686671c0c5ce070b79e82f41459297bd2)), closes [#120](https://github.com/rubicon/forgejo-mcp/issues/120)

The default surface goes from 36 tools to 53.

### Elevated tier

The opt-in tier goes from four tools to seven. `delete_label`, `delete_release` and `delete_tag` join `merge_pull_request`, `delete_branch`, `create_repo` and `delete_repo`. Each was placed there on the same test as the rest of the tier, which is whether the damage can be undone from this server: a deleted label is stripped from every issue that carried it, release notes and assets never existed in git, and a tag may be the only pointer to its commits.

The double gate is unchanged. Nothing in this tier registers unless `FORGEJO_MCP_ELEVATED=1`, `FORGEJO_TOKEN` is set, and `FORGEJO_MCP_ELEVATED_TOKEN` differs from it.

### Verification

The smoke check now records the `Authorization` header on every stub request and asserts that elevated tools travel on the elevated token while default tools do not. Before this release that boundary was invisible to the check, so an elevated tool running under the everyday credential would have passed. It also drives 44 real tool calls against a stub Forgejo, up from 23.

### Known limitations

The token-scope review this project requires whenever the elevated tier widens has not been done for `create_repo`, `delete_repo`, `delete_label`, `delete_release` or `delete_tag`. Separately, `create_repo` fails against a live instance when the token lacks `write:user`.

## [0.14.0](https://github.com/rubicon/forgejo-mcp/compare/v0.13.0...v0.14.0) (2026-08-23)


### Added

* ship MCP tool annotations, and pass them through tools/list ([#110](https://github.com/rubicon/forgejo-mcp/issues/110)) ([329b35e](https://github.com/rubicon/forgejo-mcp/commit/329b35e0ee9318f7e799599d9927eba3603c711e)), closes [#109](https://github.com/rubicon/forgejo-mcp/issues/109)


### Fixed

* **ci:** drop the stale last-release-sha and roll the version state back to 0.13.0 ([#115](https://github.com/rubicon/forgejo-mcp/issues/115)) ([dd6b6c7](https://github.com/rubicon/forgejo-mcp/commit/dd6b6c7aeeb931363281ee43e0b5b22a7d75fdfc)), closes [#114](https://github.com/rubicon/forgejo-mcp/issues/114)
* the elevated tier accepts an elevated token identical to the default one ([#112](https://github.com/rubicon/forgejo-mcp/issues/112)) ([654fc42](https://github.com/rubicon/forgejo-mcp/commit/654fc422fba46f9ade46f0267084097effbe0d7f)), closes [#111](https://github.com/rubicon/forgejo-mcp/issues/111)

## [0.13.0](https://github.com/rubicon/forgejo-mcp/compare/v0.12.0...v0.13.0) (2026-08-22)


### ⚠ BREAKING CHANGES

* list_directory returns { total_count, count, page, items } and fails on a path that names a file. Read the entries from items; use get_file_content for files.

### Added

* accept label names on add_labels, and make list_directory list directories ([#104](https://github.com/rubicon/forgejo-mcp/issues/104)) ([6b4e22f](https://github.com/rubicon/forgejo-mcp/commit/6b4e22f36983fcbf1dfc27833e9fa48395a27484)), closes [#101](https://github.com/rubicon/forgejo-mcp/issues/101)

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
