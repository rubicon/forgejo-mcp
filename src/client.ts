// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Dax Davis / Rubicon TechVentures
import type {
  Branch,
  ChangedFile,
  Comment,
  Commit,
  CommitStatus,
  ContentsResponse,
  DeleteBranchResult,
  DeleteRepoResult,
  FileChangeResponse,
  FileContent,
  ForgejoConfig,
  Issue,
  Label,
  MergeResult,
  MergeStyle,
  Paginated,
  PullRequest,
  Release,
  CommitStatusEntry,
  DeleteCommentResult,
  DeleteLabelResult,
  DeleteMilestoneResult,
  Milestone,
  RemoveLabelResult,
  Repository,
  Review,
  ReviewComment,
  Tag,
} from './types';

type QueryValue = string | number | boolean | undefined | ReadonlyArray<string | number>;
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
        if (value === undefined) continue;
        // Forgejo declares its array parameters as collectionFormat: multi, so
        // each element is its own parameter rather than one joined value.
        if (Array.isArray(value)) {
          for (const element of value) url.searchParams.append(key, String(element));
          continue;
        }
        url.searchParams.set(key, String(value));
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

  /**
   * Perform a list request and report what came back alongside what exists.
   *
   * Forgejo answers list endpoints with a bounded page and puts the full size in
   * `x-total-count`, which a bare array throws away — leaving a caller unable to
   * tell a complete answer from the first page of a longer one.
   */
  private async requestPage<T>(path: string, query: Query = {}): Promise<Paginated<T>> {
    // Resolve the page once and use that same value for both the request and
    // the reported metadata, so the answer can never name a page other than the
    // one fetched.
    const page = ForgejoClient.pageNumber(query.page);
    const response = await this.requestRaw(path, { ...query, page });

    const text = await response.text();
    const items = (text ? JSON.parse(text) : []) as T[];
    const total = Number(response.headers.get('x-total-count'));

    return {
      total_count: Number.isFinite(total) ? total : undefined,
      count: items.length,
      page,
      items,
    };
  }

  /** Pages are 1-based; anything else is caller error, not something to fix up. */
  private static pageNumber(value: QueryValue): number {
    if (value === undefined) return 1;
    const page = Number(value);
    if (!Number.isInteger(page) || page < 1) {
      throw new Error(`page must be a whole number of 1 or more, got ${value}`);
    }
    return page;
  }

  private async requestRaw(path: string, query: Query): Promise<Response> {
    this.ensureConfigured(this.token);
    const response = await fetch(this.buildUrl(path, query), {
      headers: { Authorization: `token ${this.token}`, Accept: 'application/json' },
    });
    if (!response.ok) throw await this.error('GET', path, response);
    return response;
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

  listRepositories(
    username?: string,
    opts: { page?: number; limit?: number } = {},
  ): Promise<Paginated<Repository>> {
    const query = { page: opts.page, limit: opts.limit };
    return username
      ? this.requestPage(`/users/${ForgejoClient.seg(username)}/repos`, query)
      : this.requestPage('/user/repos', query);
  }

  getRepository(owner: string, repo: string): Promise<Repository> {
    return this.request(this.repoBase(owner, repo));
  }

  // `type` narrows the endpoint, which otherwise returns pull requests alongside
  // issues. 'all' means "send no filter", which is what asks the API for both.
  listIssues(
    owner: string,
    repo: string,
    opts: {
      state?: string;
      labels?: string;
      type?: string;
      q?: string;
      milestones?: string;
      since?: string;
      before?: string;
      created_by?: string;
      assigned_by?: string;
      mentioned_by?: string;
      sort?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<Paginated<Issue>> {
    return this.requestPage(`${this.repoBase(owner, repo)}/issues`, {
      state: opts.state,
      labels: opts.labels,
      type: opts.type === 'all' ? undefined : opts.type,
      q: opts.q,
      milestones: opts.milestones,
      since: opts.since,
      before: opts.before,
      created_by: opts.created_by,
      assigned_by: opts.assigned_by,
      mentioned_by: opts.mentioned_by,
      sort: opts.sort,
      page: opts.page,
      limit: opts.limit,
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
  ): Promise<Paginated<Comment>> {
    return this.requestPage(`${this.repoBase(owner, repo)}/issues/${index}/comments`, {
      page: opts.page,
      limit: opts.limit,
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
  /**
   * List a directory's entries. The endpoint is polymorphic — it answers with a
   * single object when the path names a file — so this refuses that case rather
   * than returning a shape the caller could not predict before calling.
   */
  async listDirectory(
    owner: string,
    repo: string,
    filepath?: string,
    ref?: string,
  ): Promise<Paginated<ContentsResponse>> {
    const path = filepath ? `/${ForgejoClient.filePath(filepath)}` : '';
    const response = await this.requestRaw(`${this.repoBase(owner, repo)}/contents${path}`, { ref });
    const text = await response.text();
    const items = text ? JSON.parse(text) : [];
    if (!Array.isArray(items)) {
      throw new Error(
        `${filepath ?? '/'} is a ${(items as ContentsResponse).type ?? 'file'}, not a directory; ` +
          'use get_file_content',
      );
    }
    const total = Number(response.headers.get('x-total-count'));
    return {
      total_count: Number.isFinite(total) ? total : undefined,
      count: items.length,
      page: 1,
      items,
    };
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

  /**
   * Replace an existing file. `content` must already be base64-encoded, and the
   * API requires `sha` — the blob SHA of the file being replaced.
   */
  updateFile(
    owner: string,
    repo: string,
    filepath: string,
    body: { content: string; sha: string; message?: string; branch?: string },
  ): Promise<FileChangeResponse> {
    return this.request(`${this.repoBase(owner, repo)}/contents/${ForgejoClient.filePath(filepath)}`, {
      method: 'PUT',
      body,
    });
  }

  /**
   * Delete a file. `sha` is the blob SHA of the file being removed: the API
   * requires it, and it is the same freshness guard `updateFile` carries, so a
   * deletion cannot land on a file that changed since the caller read it.
   */
  deleteFile(
    owner: string,
    repo: string,
    filepath: string,
    body: { sha: string; message?: string; branch?: string },
  ): Promise<FileChangeResponse> {
    return this.request(`${this.repoBase(owner, repo)}/contents/${ForgejoClient.filePath(filepath)}`, {
      method: 'DELETE',
      body,
    });
  }

  listPullRequests(
    owner: string,
    repo: string,
    opts: {
      state?: string;
      sort?: string;
      milestone?: number;
      labels?: ReadonlyArray<string | number>;
      poster?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<Paginated<PullRequest>> {
    return this.requestPage(`${this.repoBase(owner, repo)}/pulls`, {
      state: opts.state,
      sort: opts.sort,
      milestone: opts.milestone,
      labels: opts.labels,
      poster: opts.poster,
      page: opts.page,
      limit: opts.limit,
    });
  }

  getPullRequest(owner: string, repo: string, index: number): Promise<PullRequest> {
    return this.request(`${this.repoBase(owner, repo)}/pulls/${index}`);
  }

  getPullRequestDiff(owner: string, repo: string, index: number): Promise<string> {
    return this.requestText(`${this.repoBase(owner, repo)}/pulls/${index}.diff`);
  }

  listPullRequestFiles(
    owner: string,
    repo: string,
    index: number,
    opts: { page?: number; limit?: number } = {},
  ): Promise<Paginated<ChangedFile>> {
    return this.requestPage(`${this.repoBase(owner, repo)}/pulls/${index}/files`, {
      page: opts.page,
      limit: opts.limit,
    });
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

  listBranches(
    owner: string,
    repo: string,
    opts: { page?: number; limit?: number } = {},
  ): Promise<Paginated<Branch>> {
    return this.requestPage(`${this.repoBase(owner, repo)}/branches`, {
      page: opts.page,
      limit: opts.limit,
    });
  }

  getBranch(owner: string, repo: string, branch: string): Promise<Branch> {
    return this.request(`${this.repoBase(owner, repo)}/branches/${ForgejoClient.seg(branch)}`);
  }

  listCommits(
    owner: string,
    repo: string,
    opts: { sha?: string; path?: string; page?: number; limit?: number } = {},
  ): Promise<Paginated<Commit>> {
    return this.requestPage(`${this.repoBase(owner, repo)}/commits`, {
      sha: opts.sha,
      path: opts.path,
      page: opts.page,
      limit: opts.limit,
    });
  }

  getCommit(owner: string, repo: string, sha: string): Promise<Commit> {
    return this.request(`${this.repoBase(owner, repo)}/git/commits/${ForgejoClient.seg(sha)}`);
  }

  createBranch(
    owner: string,
    repo: string,
    body: { new_branch_name: string; old_ref_name?: string },
  ): Promise<Branch> {
    return this.request(`${this.repoBase(owner, repo)}/branches`, { method: 'POST', body });
  }

  // --- Elevated (destructive) operations -----------------------------------
  // These run under the elevated token only; see requestElevated above.

  /**
   * Merge a pull request. `head_commit_id` is sent as the API's own guard: the
   * merge is refused if the branch head has moved since it was read, so an
   * agent cannot merge commits that arrived after the review.
   */
  /**
   * Create a repository owned by the authenticated user. `private` is decided by
   * the caller rather than defaulted here, so the tool layer owns that choice.
   */
  createRepo(body: {
    name: string;
    description?: string;
    private: boolean;
    auto_init?: boolean;
    default_branch?: string;
  }): Promise<Repository> {
    return this.requestElevated('/user/repos', { method: 'POST', body });
  }

  /**
   * Delete a repository. There is no undo: issues, pull requests and history go
   * with it. The caller-confirmation guard lives in the tool layer.
   */
  async deleteRepo(owner: string, repo: string): Promise<DeleteRepoResult> {
    await this.requestElevated(this.repoBase(owner, repo), { method: 'DELETE' });
    return { deleted: true, repository: `${owner}/${repo}` };
  }

  async mergePullRequest(
    owner: string,
    repo: string,
    index: number,
    opts: { style?: MergeStyle; head_commit_id: string; delete_branch_after_merge?: boolean },
  ): Promise<MergeResult> {
    const strategy = opts.style ?? 'merge';
    await this.requestElevated(`${this.repoBase(owner, repo)}/pulls/${index}/merge`, {
      method: 'POST',
      body: {
        Do: strategy,
        head_commit_id: opts.head_commit_id,
        delete_branch_after_merge: opts.delete_branch_after_merge,
      },
    });
    return { merged: true, index, strategy, head_commit_id: opts.head_commit_id };
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
  ): Promise<Paginated<Release>> {
    return this.requestPage(`${this.repoBase(owner, repo)}/releases`, {
      page: opts.page,
      limit: opts.limit,
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
  ): Promise<Paginated<Tag>> {
    return this.requestPage(`${this.repoBase(owner, repo)}/tags`, {
      page: opts.page,
      limit: opts.limit,
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

  listPullRequestReviews(
    owner: string,
    repo: string,
    index: number,
    opts: { page?: number; limit?: number } = {},
  ): Promise<Paginated<Review>> {
    return this.requestPage(`${this.repoBase(owner, repo)}/pulls/${index}/reviews`, {
      page: opts.page,
      limit: opts.limit,
    });
  }

  createPullRequestReview(
    owner: string,
    repo: string,
    index: number,
    body: { event: string; body?: string; commit_id?: string; comments?: ReviewComment[] },
  ): Promise<Review> {
    return this.request(`${this.repoBase(owner, repo)}/pulls/${index}/reviews`, {
      method: 'POST',
      body,
    });
  }

  requestPullRequestReviewers(
    owner: string,
    repo: string,
    index: number,
    body: { reviewers: string[]; team_reviewers?: string[] },
  ): Promise<Review[]> {
    return this.request(`${this.repoBase(owner, repo)}/pulls/${index}/requested_reviewers`, {
      method: 'POST',
      body,
    });
  }

  /**
   * Report a commit status.
   *
   * Statuses are keyed by `context`: posting a second status with the same
   * context supersedes the first rather than adding to it, which is how a check
   * moves from pending to success.
   */
  createCommitStatus(
    owner: string,
    repo: string,
    sha: string,
    body: { state: string; context: string; description?: string; target_url?: string },
  ): Promise<CommitStatusEntry> {
    return this.request(`${this.repoBase(owner, repo)}/statuses/${ForgejoClient.seg(sha)}`, {
      method: 'POST',
      body,
    });
  }

  /**
   * List the individual statuses on a ref. `getCommitStatus` reports the rolled
   * up verdict; this is what says which check produced it.
   */
  listCommitStatuses(
    owner: string,
    repo: string,
    ref: string,
    opts: { page?: number; limit?: number } = {},
  ): Promise<Paginated<CommitStatusEntry>> {
    return this.requestPage(
      `${this.repoBase(owner, repo)}/commits/${ForgejoClient.seg(ref)}/statuses`,
      { page: opts.page, limit: opts.limit },
    );
  }

  /**
   * Edit a comment on an issue or pull request.
   *
   * Comment ids are unique within the repository, so this endpoint is reached
   * without the issue number. `body` is the whole replacement text: the endpoint
   * carries no guard against a simultaneous edit, so what it receives wins.
   */
  editIssueComment(
    owner: string,
    repo: string,
    id: number,
    body: string,
  ): Promise<Comment> {
    return this.request(`${this.repoBase(owner, repo)}/issues/comments/${id}`, {
      method: 'PATCH',
      body: { body },
    });
  }

  async deleteIssueComment(
    owner: string,
    repo: string,
    id: number,
  ): Promise<DeleteCommentResult> {
    await this.request(`${this.repoBase(owner, repo)}/issues/comments/${id}`, {
      method: 'DELETE',
    });
    return { deleted: true, id };
  }

  listMilestones(
    owner: string,
    repo: string,
    opts: { state?: string; name?: string; page?: number; limit?: number } = {},
  ): Promise<Paginated<Milestone>> {
    return this.requestPage(`${this.repoBase(owner, repo)}/milestones`, {
      state: opts.state,
      name: opts.name,
      page: opts.page,
      limit: opts.limit,
    });
  }

  /**
   * Fetch one milestone. Forgejo matches `id` against the milestone id first and
   * falls back to its title, which is the only way to reach a milestone whose id
   * the caller never learned.
   */
  getMilestone(owner: string, repo: string, id: string | number): Promise<Milestone> {
    return this.request(
      `${this.repoBase(owner, repo)}/milestones/${ForgejoClient.seg(String(id))}`,
    );
  }

  createMilestone(
    owner: string,
    repo: string,
    body: { title: string; description?: string; due_on?: string; state?: string },
  ): Promise<Milestone> {
    return this.request(`${this.repoBase(owner, repo)}/milestones`, { method: 'POST', body });
  }

  /**
   * Edit a milestone. As with `editIssue`, only the named fields are sent: the
   * endpoint replaces what it receives.
   */
  editMilestone(
    owner: string,
    repo: string,
    id: string | number,
    edit: { title?: string; description?: string; due_on?: string; state?: string },
  ): Promise<Milestone> {
    return this.request(
      `${this.repoBase(owner, repo)}/milestones/${ForgejoClient.seg(String(id))}`,
      { method: 'PATCH', body: edit },
    );
  }

  async deleteMilestone(
    owner: string,
    repo: string,
    id: string | number,
  ): Promise<DeleteMilestoneResult> {
    await this.request(
      `${this.repoBase(owner, repo)}/milestones/${ForgejoClient.seg(String(id))}`,
      { method: 'DELETE' },
    );
    return { deleted: true, id };
  }

  getLabel(owner: string, repo: string, id: number): Promise<Label> {
    return this.request(`${this.repoBase(owner, repo)}/labels/${id}`);
  }

  createLabel(
    owner: string,
    repo: string,
    body: {
      name: string;
      color: string;
      description?: string;
      exclusive?: boolean;
      is_archived?: boolean;
    },
  ): Promise<Label> {
    return this.request(`${this.repoBase(owner, repo)}/labels`, { method: 'POST', body });
  }

  /** Edit a label definition. Only the named fields are sent. */
  editLabel(
    owner: string,
    repo: string,
    id: number,
    edit: {
      name?: string;
      color?: string;
      description?: string;
      exclusive?: boolean;
      is_archived?: boolean;
    },
  ): Promise<Label> {
    return this.request(`${this.repoBase(owner, repo)}/labels/${id}`, {
      method: 'PATCH',
      body: edit,
    });
  }

  /**
   * Delete a label definition. Elevated: this strips the label from every issue
   * and pull request that carried it, and neither the label nor those
   * associations can be restored from here.
   */
  async deleteLabel(owner: string, repo: string, id: number): Promise<DeleteLabelResult> {
    await this.requestElevated(`${this.repoBase(owner, repo)}/labels/${id}`, {
      method: 'DELETE',
    });
    return { deleted: true, id };
  }

  listLabels(
    owner: string,
    repo: string,
    opts: { page?: number; limit?: number } = {},
  ): Promise<Paginated<Label>> {
    return this.requestPage(`${this.repoBase(owner, repo)}/labels`, {
      page: opts.page,
      limit: opts.limit,
    });
  }

  /**
   * Remove one label. `identifier` is a label name or id, and names can contain
   * spaces and slashes, so it is encoded as a single path segment.
   */
  async removeLabel(
    owner: string,
    repo: string,
    index: number,
    label: string,
  ): Promise<RemoveLabelResult> {
    await this.request(
      `${this.repoBase(owner, repo)}/issues/${index}/labels/${ForgejoClient.seg(label)}`,
      { method: 'DELETE' },
    );
    return { removed: true, index, label };
  }

  addLabels(owner: string, repo: string, index: number, labels: number[]): Promise<Label[]> {
    return this.request(`${this.repoBase(owner, repo)}/issues/${index}/labels`, {
      method: 'POST',
      body: { labels },
    });
  }

  /**
   * Edit an issue's title or body. Pull requests share issue numbering, so this
   * reaches them too.
   *
   * Only the fields the caller named are sent. The endpoint replaces what it
   * receives, so passing an unchanged value back would overwrite a concurrent
   * edit instead of leaving it alone.
   */
  editIssue(
    owner: string,
    repo: string,
    index: number,
    edit: { title?: string; body?: string },
  ): Promise<Issue> {
    return this.request(`${this.repoBase(owner, repo)}/issues/${index}`, {
      method: 'PATCH',
      body: edit,
    });
  }

  /**
   * Close or reopen an issue. Only `state` is sent, so this tool cannot disturb
   * the title or body that `editIssue` owns on the same endpoint.
   */
  setIssueState(owner: string, repo: string, index: number, state: string): Promise<Issue> {
    return this.request(`${this.repoBase(owner, repo)}/issues/${index}`, {
      method: 'PATCH',
      body: { state },
    });
  }

  // Additive: Forgejo has no add-assignee endpoint, and the issue-edit endpoint
  // replaces the whole assignee list — so read the current assignees and merge
  // the new ones in rather than clobbering them.
  async addAssignees(
    owner: string,
    repo: string,
    index: number,
    assignees: string[],
  ): Promise<Issue> {
    const issue = await this.getIssue(owner, repo, index);
    const current = (issue.assignees ?? []).map((user) => user.login);
    const merged = Array.from(new Set([...current, ...assignees]));
    return this.request(`${this.repoBase(owner, repo)}/issues/${index}`, {
      method: 'PATCH',
      body: { assignees: merged },
    });
  }
}
