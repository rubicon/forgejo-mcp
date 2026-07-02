// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Dax Davis / Rubicon TechVentures
export interface ForgejoConfig {
  baseUrl: string;
  token: string;
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
