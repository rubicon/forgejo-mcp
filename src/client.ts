// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Dax Davis / Rubicon TechVentures
import type {
  Comment,
  CommitStatus,
  FileContent,
  ForgejoConfig,
  Issue,
  PullRequest,
  Release,
  Repository,
  Tag,
} from './types';

type QueryValue = string | number | boolean | undefined;
type Query = Record<string, QueryValue>;

interface RequestOptions {
  method?: string;
  query?: Query;
  body?: unknown;
}

/**
 * Thin, typed wrapper over the Forgejo/Gitea REST API (v1).
 *
 * Design notes baked in here rather than at each call site:
 * - Path segments are URL-encoded, so owners/repos/refs with special
 *   characters (e.g. a `dev/12-slug` file ref) do not corrupt the URL.
 * - An omitted `ref` is left off the request entirely, so the server resolves
 *   the repository's own default branch instead of assuming `main`.
 * - Non-2xx responses surface the API's response body, so validation errors
 *   are actionable instead of a bare status code.
 */
export class ForgejoClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(config: ForgejoConfig) {
    this.baseUrl = (config.baseUrl ?? '').replace(/\/+$/, '');
    this.token = config.token ?? '';
  }

  private ensureConfigured(): void {
    if (!this.baseUrl || !this.token) {
      throw new Error('FORGEJO_BASE_URL and FORGEJO_TOKEN must be set.');
    }
  }

  private buildUrl(path: string, query?: Query): string {
    const url = new URL(`${this.baseUrl}/api/v1${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    this.ensureConfigured();
    const { method = 'GET', query, body } = options;

    const response = await fetch(this.buildUrl(path, query), {
      method,
      headers: {
        Authorization: `token ${this.token}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) throw await this.error(method, path, response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async requestText(path: string): Promise<string> {
    this.ensureConfigured();
    const response = await fetch(this.buildUrl(path), {
      headers: { Authorization: `token ${this.token}` },
    });
    if (!response.ok) throw await this.error('GET', path, response);
    return response.text();
  }

  private async error(method: string, path: string, response: Response): Promise<Error> {
    const detail = await response.text().catch(() => '');
    return new Error(
      `Forgejo API ${method} ${path} failed: ${response.status} ${response.statusText}` +
        (detail ? ` — ${detail}` : ''),
    );
  }

  /** Encode a single path segment (owner, repo, ref). */
  private static seg(value: string): string {
    return encodeURIComponent(value);
  }

  /** Encode a file path while preserving the slashes that separate segments. */
  private static filePath(value: string): string {
    return value
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
  }

  private repoBase(owner: string, repo: string): string {
    return `/repos/${ForgejoClient.seg(owner)}/${ForgejoClient.seg(repo)}`;
  }

  listRepositories(username?: string): Promise<Repository[]> {
    return username
      ? this.request(`/users/${ForgejoClient.seg(username)}/repos`)
      : this.request('/user/repos');
  }

  getRepository(owner: string, repo: string): Promise<Repository> {
    return this.request(this.repoBase(owner, repo));
  }

  listIssues(
    owner: string,
    repo: string,
    opts: { state?: string; labels?: string; page?: number; limit?: number } = {},
  ): Promise<Issue[]> {
    return this.request(`${this.repoBase(owner, repo)}/issues`, {
      query: { state: opts.state, labels: opts.labels, page: opts.page, limit: opts.limit },
    });
  }

  getIssue(owner: string, repo: string, index: number): Promise<Issue> {
    return this.request(`${this.repoBase(owner, repo)}/issues/${index}`);
  }

  createIssue(
    owner: string,
    repo: string,
    body: { title: string; body?: string; labels?: number[]; assignees?: string[] },
  ): Promise<Issue> {
    return this.request(`${this.repoBase(owner, repo)}/issues`, { method: 'POST', body });
  }

  listIssueComments(
    owner: string,
    repo: string,
    index: number,
    opts: { page?: number; limit?: number } = {},
  ): Promise<Comment[]> {
    return this.request(`${this.repoBase(owner, repo)}/issues/${index}/comments`, {
      query: { page: opts.page, limit: opts.limit },
    });
  }

  createIssueComment(owner: string, repo: string, index: number, body: string): Promise<Comment> {
    return this.request(`${this.repoBase(owner, repo)}/issues/${index}/comments`, {
      method: 'POST',
      body: { body },
    });
  }

  getFileContent(owner: string, repo: string, filepath: string, ref?: string): Promise<FileContent> {
    return this.request(`${this.repoBase(owner, repo)}/contents/${ForgejoClient.filePath(filepath)}`, {
      query: { ref },
    });
  }

  listPullRequests(
    owner: string,
    repo: string,
    opts: { state?: string; page?: number; limit?: number } = {},
  ): Promise<PullRequest[]> {
    return this.request(`${this.repoBase(owner, repo)}/pulls`, {
      query: { state: opts.state, page: opts.page, limit: opts.limit },
    });
  }

  getPullRequest(owner: string, repo: string, index: number): Promise<PullRequest> {
    return this.request(`${this.repoBase(owner, repo)}/pulls/${index}`);
  }

  getPullRequestDiff(owner: string, repo: string, index: number): Promise<string> {
    return this.requestText(`${this.repoBase(owner, repo)}/pulls/${index}.diff`);
  }

  createPullRequest(
    owner: string,
    repo: string,
    body: { title: string; head: string; base: string; body?: string },
  ): Promise<PullRequest> {
    return this.request(`${this.repoBase(owner, repo)}/pulls`, { method: 'POST', body });
  }

  getCommitStatus(owner: string, repo: string, ref: string): Promise<CommitStatus> {
    return this.request(`${this.repoBase(owner, repo)}/commits/${ForgejoClient.seg(ref)}/status`);
  }

  listReleases(
    owner: string,
    repo: string,
    opts: { page?: number; limit?: number } = {},
  ): Promise<Release[]> {
    return this.request(`${this.repoBase(owner, repo)}/releases`, {
      query: { page: opts.page, limit: opts.limit },
    });
  }

  getRelease(owner: string, repo: string, id: number): Promise<Release> {
    return this.request(`${this.repoBase(owner, repo)}/releases/${id}`);
  }

  createRelease(
    owner: string,
    repo: string,
    body: {
      tag_name: string;
      target_commitish?: string;
      name?: string;
      body?: string;
      draft?: boolean;
      prerelease?: boolean;
    },
  ): Promise<Release> {
    return this.request(`${this.repoBase(owner, repo)}/releases`, { method: 'POST', body });
  }

  listTags(
    owner: string,
    repo: string,
    opts: { page?: number; limit?: number } = {},
  ): Promise<Tag[]> {
    return this.request(`${this.repoBase(owner, repo)}/tags`, {
      query: { page: opts.page, limit: opts.limit },
    });
  }

  getTag(owner: string, repo: string, tag: string): Promise<Tag> {
    return this.request(`${this.repoBase(owner, repo)}/tags/${ForgejoClient.seg(tag)}`);
  }

  createTag(
    owner: string,
    repo: string,
    body: { tag_name: string; target?: string; message?: string },
  ): Promise<Tag> {
    return this.request(`${this.repoBase(owner, repo)}/tags`, { method: 'POST', body });
  }
}
