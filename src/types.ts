// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Dax Davis / Rubicon TechVentures
export interface ForgejoConfig {
  baseUrl: string;
  token: string;
  /**
   * Separately-scoped token used ONLY for elevated (destructive) operations.
   * When unset, the client refuses to perform elevated ops — the default
   * `token` is never used for merge/delete. See the elevated tier in tools.ts.
   */
  elevatedToken?: string;
}

/** Merge strategy accepted by `merge_pull_request` (Forgejo `Do` field). */
export type MergeStyle = 'merge' | 'rebase' | 'squash';

/**
 * One page of a list endpoint's results, with enough context to tell whether
 * more exist. `total_count` is absent when the server does not report one.
 */
export interface Paginated<T> {
  total_count?: number;
  count: number;
  page: number;
  items: T[];
}

export interface MergeResult {
  merged: boolean;
  index: number;
  strategy: MergeStyle;
  /** The head commit the merge was pinned to. */
  head_commit_id: string;
}

/** Outcome of deleting a repository; the endpoint answers 204 with no body. */
export interface DeleteRepoResult {
  deleted: boolean;
  repository: string;
}

/** Outcome of removing a label; the endpoint answers 204 with no body. */
export interface Milestone {
  id: number;
  title: string;
  description: string;
  state: string;
  open_issues: number;
  closed_issues: number;
  due_on: string | null;
}

/**
 * One reported status. The rollup Forgejo returns for a ref is `CommitStatus`
 * below, which carries the combined state and the entries behind it.
 */
export interface CommitStatusEntry {
  id: number;
  state: string;
  context: string;
  description: string;
  target_url: string;
  created_at: string;
}

export interface DeleteCommentResult {
  deleted: boolean;
  id: number;
}

export interface DeleteMilestoneResult {
  deleted: boolean;
  id: string | number;
}

export interface RemoveLabelResult {
  removed: boolean;
  index: number;
  label: string;
}

export interface DeleteBranchResult {
  deleted: boolean;
  branch: string;
}

export interface User {
  id: number;
  login: string;
  full_name?: string;
}

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  html_url: string;
  private: boolean;
  fork: boolean;
  default_branch: string;
  language?: string;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: number;
  name: string;
  color: string;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  html_url: string;
  user: User;
  labels?: Label[];
  assignees?: User[];
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: number;
  body: string;
  html_url: string;
  user: User;
  created_at: string;
  updated_at: string;
}

export interface FileContent {
  name: string;
  path: string;
  sha: string;
  type: string;
  size: number;
  encoding?: string;
  content?: string;
}

/** A single entry returned by the contents API (file or directory listing). */
export interface ContentsResponse {
  name: string;
  path: string;
  sha: string;
  type: string;
  size: number;
  encoding?: string;
  content?: string;
  target?: string;
  html_url?: string;
  download_url?: string;
}

export interface FileCommitResponse {
  sha: string;
  html_url: string;
  message: string;
}

/** Result of a create/update file write: the new content plus the commit. */
export interface FileChangeResponse {
  content: ContentsResponse | null;
  commit: FileCommitResponse;
}

export interface PullRequestRef {
  ref: string;
  label: string;
  sha: string;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  html_url: string;
  merged: boolean;
  mergeable?: boolean;
  head: PullRequestRef;
  base: PullRequestRef;
  user: User;
  created_at: string;
  updated_at: string;
}

/** One file changed by a pull request. */
export interface ChangedFile {
  filename: string;
  previous_filename?: string;
  /** added, modified, renamed, deleted, or copied. */
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  html_url?: string;
  contents_url?: string;
  raw_url?: string;
}

/** An inline comment on a pull request review, anchored to a file and line. */
export interface ReviewComment {
  path: string;
  body: string;
  new_position?: number;
  old_position?: number;
}

/** A review on a pull request (an approval, change request, or comment). */
export interface Review {
  id: number;
  body: string;
  /** APPROVED, PENDING, REQUEST_CHANGES, COMMENT, or UNKNOWN. */
  state: string;
  html_url: string;
  user: User;
  commit_id?: string;
  stale?: boolean;
  official?: boolean;
  submitted_at?: string;
}

export interface Commit {
  sha: string;
  html_url: string;
  created?: string;
  commit: {
    message: string;
    author?: { name: string; email: string; date: string };
    committer?: { name: string; email: string; date: string };
  };
  author?: User | null;
  committer?: User | null;
}

export interface Branch {
  name: string;
  commit?: { id: string; message?: string };
  protected: boolean;
  user_can_push?: boolean;
  user_can_merge?: boolean;
}

export interface CommitStatus {
  state: string;
  sha: string;
  total_count: number;
  statuses: Array<{
    status: string;
    context: string;
    description: string;
    target_url: string;
  }>;
}

export interface Release {
  id: number;
  tag_name: string;
  target_commitish: string;
  name: string;
  body: string;
  url: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  author: User;
  created_at: string;
  published_at: string;
}

export interface Tag {
  name: string;
  message?: string;
  id: string;
  commit: {
    sha: string;
    url: string;
  };
  zipball_url?: string;
  tarball_url?: string;
}
