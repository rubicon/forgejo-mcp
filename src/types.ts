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

export interface MergeResult {
  merged: boolean;
  index: number;
  strategy: MergeStyle;
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
