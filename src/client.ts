// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Dax Davis / Rubicon TechVentures
import type {
  Comment,
  CommitStatus,
  ContentsResponse,
  DeleteBranchResult,
  FileChangeResponse,
  FileContent,
  ForgejoConfig,
  Issue,
  MergeResult,
  MergeStyle,
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
  /** Override the bearer token for a single request (used by elevated ops). */
  token?: string;
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
  private readonly elevatedToken: string;

  constructor(config: ForgejoConfig) {
    this.baseUrl = (config.baseUrl ?? '').replace(/\/+$/, '');
    this.token = config.token ?? '';
    this.elevatedToken = config.elevatedToken ?? '';
  }

  private ensureConfigured(token: string): void {
    if (!this.baseUrl || !token) {
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
    const { method = 'GET', query, body, token = this.token } = options;
    this.ensureConfigured(token);

    const response = await fetch(this.buildUrl(path, query), {
      method,
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) throw await this.error(method, path, response);
    if (response.status === 204) return undefined as T;
    // Some write endpoints (e.g. merge) answer 200 with an empty body; don't
    // choke on the absent JSON.
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  /**
   * Perform a request with the elevated token. Refuses to fall back to the
   * default token — the elevated tier is a distinct trust boundary, and an
   * elevated op running under the read/write token would defeat its purpose.
   */
  private requestElevated<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (!this.elevatedToken) {
      throw new Error(
        'Elevated operation requires FORGEJO_MCP_ELEVATED_TOKEN; refusing to use the default token.',
      );
    }
    return this.request<T>(path, { ...options, token: this.elevatedToken });
  }

  private async requestText(path: string): Promise<string> {
    this.ensureConfigured(this.token);
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

  /** List a directory's entries. Omit `path` for the repository root. */
  listContents(
    owner: string,
    repo: string,
    path?: string,
    ref?: string,
  ): Promise<ContentsResponse[] | ContentsResponse> {
    const suffix = path ? `/${ForgejoClient.filePath(path)}` : '';
    return this.request(`${this.repoBase(owner, repo)}/contents${suffix}`, { query: { ref } });
  }

  /** Create a new file. `content` must already be base64-encoded. */
  createFile(
    owner: string,
    repo: string,
    filepath: string,
    body: { content: string; message?: string; branch?: string; new_branch?: string },
  ): Promise<FileChangeResponse> {
    return this.request(`${this.repoBase(owner, repo)}/contents/${ForgejoClient.filePath(filepath)}`, {
      method: 'POST',
      body,
    });
  }

  /** Replace an existing file. `content` must already be base64-encoded. */
  updateFile(
    owner: string,
    repo: string,
    filepath: string,
    body: { content: string; sha?: string; message?: string; branch?: string },
  ): Promise<FileChangeResponse> {
    return this.request(`${this.repoBase(owner, repo)}/contents/${ForgejoClient.filePath(filepath)}`, {
      method: 'PUT',
      body,
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

  // --- Elevated (destructive) operations -----------------------------------
  // These run under the elevated token only; see requestElevated above.

  async mergePullRequest(
    owner: string,
    repo: string,
    index: number,
    opts: { style?: MergeStyle } = {},
  ): Promise<MergeResult> {
    const strategy = opts.style ?? 'merge';
    await this.requestElevated(`${this.repoBase(owner, repo)}/pulls/${index}/merge`, {
      method: 'POST',
      body: { Do: strategy },
    });
    return { merged: true, index, strategy };
  }

  async deleteBranch(owner: string, repo: string, branch: string): Promise<DeleteBranchResult> {
    await this.requestElevated(
      `${this.repoBase(owner, repo)}/branches/${ForgejoClient.seg(branch)}`,
      { method: 'DELETE' },
    );
    return { deleted: true, branch };
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
