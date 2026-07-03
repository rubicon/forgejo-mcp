// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Dax Davis / Rubicon TechVentures
import type { ForgejoClient } from './client';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (client: ForgejoClient, args: Record<string, any>) => Promise<unknown>;
}

function req<T = any>(args: Record<string, any>, key: string): T {
  const value = args?.[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required argument: ${key}`);
  }
  return value as T;
}

const ownerRepo = {
  owner: { type: 'string', description: 'Repository owner' },
  repo: { type: 'string', description: 'Repository name' },
} as const;

const pagination = {
  page: { type: 'number', description: 'Page number (1-based)' },
  limit: { type: 'number', description: 'Results per page' },
} as const;

const stateEnum = {
  type: 'string',
  enum: ['open', 'closed', 'all'],
  description: 'Filter by state (default: open)',
} as const;

export const tools: ToolDefinition[] = [
  {
    name: 'list_repositories',
    description: 'List repositories for a user. Omit username for the authenticated user.',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Username; omit for the authenticated user.' },
      },
    },
    handler: (c, a) => c.listRepositories(a.username),
  },
  {
    name: 'get_repository',
    description: 'Get full metadata for a single repository, including its default branch.',
    inputSchema: {
      type: 'object',
      properties: { ...ownerRepo },
      required: ['owner', 'repo'],
    },
    handler: (c, a) => c.getRepository(req(a, 'owner'), req(a, 'repo')),
  },
  {
    name: 'list_issues',
    description: 'List repository issues, optionally filtered by state and labels.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        state: stateEnum,
        labels: { type: 'string', description: 'Comma-separated label names to filter by' },
        ...pagination,
      },
      required: ['owner', 'repo'],
    },
    handler: (c, a) =>
      c.listIssues(req(a, 'owner'), req(a, 'repo'), {
        state: a.state,
        labels: a.labels,
        page: a.page,
        limit: a.limit,
      }),
  },
  {
    name: 'get_issue',
    description: 'Get a single issue by its number, including body, labels, and assignees.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        index: { type: 'number', description: 'Issue number' },
      },
      required: ['owner', 'repo', 'index'],
    },
    handler: (c, a) => c.getIssue(req(a, 'owner'), req(a, 'repo'), req(a, 'index')),
  },
  {
    name: 'create_issue',
    description: 'Create a new issue. Labels are label IDs; assignees are usernames.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        title: { type: 'string', description: 'Issue title' },
        body: { type: 'string', description: 'Issue description (Markdown)' },
        labels: {
          type: 'array',
          items: { type: 'number' },
          description: 'Label IDs to apply',
        },
        assignees: {
          type: 'array',
          items: { type: 'string' },
          description: 'Usernames to assign',
        },
      },
      required: ['owner', 'repo', 'title'],
    },
    handler: (c, a) =>
      c.createIssue(req(a, 'owner'), req(a, 'repo'), {
        title: req(a, 'title'),
        body: a.body,
        labels: a.labels,
        assignees: a.assignees,
      }),
  },
  {
    name: 'list_issue_comments',
    description: 'List the comments on an issue or pull request (comments share one endpoint).',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        index: { type: 'number', description: 'Issue or pull request number' },
        ...pagination,
      },
      required: ['owner', 'repo', 'index'],
    },
    handler: (c, a) =>
      c.listIssueComments(req(a, 'owner'), req(a, 'repo'), req(a, 'index'), {
        page: a.page,
        limit: a.limit,
      }),
  },
  {
    name: 'create_issue_comment',
    description: 'Add a comment to an issue or pull request. Additive write; nothing is edited or removed.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        index: { type: 'number', description: 'Issue or pull request number' },
        body: { type: 'string', description: 'Comment body (Markdown)' },
      },
      required: ['owner', 'repo', 'index', 'body'],
    },
    handler: (c, a) =>
      c.createIssueComment(req(a, 'owner'), req(a, 'repo'), req(a, 'index'), req(a, 'body')),
  },
  {
    name: 'get_file_content',
    description:
      'Get the decoded content of a file. Omit ref to use the repository default branch.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        path: { type: 'string', description: 'File path within the repository' },
        ref: { type: 'string', description: 'Branch, tag, or commit (defaults to the repo default branch)' },
      },
      required: ['owner', 'repo', 'path'],
    },
    handler: async (c, a) => {
      const file = await c.getFileContent(req(a, 'owner'), req(a, 'repo'), req(a, 'path'), a.ref);
      const decoded =
        file.content && file.encoding === 'base64'
          ? Buffer.from(file.content, 'base64').toString('utf-8')
          : undefined;
      return { ...file, decoded_content: decoded };
    },
  },
  {
    name: 'list_directory',
    description:
      'List the entries in a repository directory (name, path, type, size, SHA). ' +
      'Omit path for the repository root; omit ref for the default branch.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        path: { type: 'string', description: 'Directory path within the repository (omit for the root)' },
        ref: { type: 'string', description: 'Branch, tag, or commit (defaults to the repo default branch)' },
      },
      required: ['owner', 'repo'],
    },
    handler: (c, a) => c.listContents(req(a, 'owner'), req(a, 'repo'), a.path, a.ref),
  },
  {
    name: 'create_file',
    description:
      'Create a new file. content is plain UTF-8 text (base64-encoded for you). Commits to ' +
      'branch (default branch if omitted), or set new_branch to commit onto a fresh branch. ' +
      'Additive write; fails if the file already exists — use update_file to change one.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        path: { type: 'string', description: 'File path within the repository' },
        content: { type: 'string', description: 'File content as plain UTF-8 text' },
        message: { type: 'string', description: 'Commit message' },
        branch: { type: 'string', description: 'Branch to commit to (defaults to the repo default branch)' },
        new_branch: { type: 'string', description: 'Create and commit onto a new branch from branch instead' },
      },
      required: ['owner', 'repo', 'path', 'content'],
    },
    handler: (c, a) =>
      c.createFile(req(a, 'owner'), req(a, 'repo'), req(a, 'path'), {
        content: Buffer.from(req<string>(a, 'content'), 'utf-8').toString('base64'),
        message: a.message,
        branch: a.branch,
        new_branch: a.new_branch,
      }),
  },
  {
    name: 'update_file',
    description:
      'Update an existing file. content is plain UTF-8 text (base64-encoded for you) and ' +
      'REPLACES the file. Pass sha (the current blob SHA from get_file_content) to guard ' +
      'against overwriting concurrent changes. Commits to branch (default branch if omitted). ' +
      'Additive write; nothing is deleted.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        path: { type: 'string', description: 'File path within the repository' },
        content: { type: 'string', description: 'New file content as plain UTF-8 text (replaces the file)' },
        sha: {
          type: 'string',
          description: 'Current blob SHA of the file being replaced (from get_file_content); required by most Forgejo versions',
        },
        message: { type: 'string', description: 'Commit message' },
        branch: { type: 'string', description: 'Branch to commit to (defaults to the repo default branch)' },
      },
      required: ['owner', 'repo', 'path', 'content'],
    },
    handler: (c, a) =>
      c.updateFile(req(a, 'owner'), req(a, 'repo'), req(a, 'path'), {
        content: Buffer.from(req<string>(a, 'content'), 'utf-8').toString('base64'),
        sha: a.sha,
        message: a.message,
        branch: a.branch,
      }),
  },
  {
    name: 'list_pull_requests',
    description: 'List repository pull requests, optionally filtered by state.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        state: stateEnum,
        ...pagination,
      },
      required: ['owner', 'repo'],
    },
    handler: (c, a) =>
      c.listPullRequests(req(a, 'owner'), req(a, 'repo'), {
        state: a.state,
        page: a.page,
        limit: a.limit,
      }),
  },
  {
    name: 'get_pull_request',
    description: 'Get a single pull request by its number, including merge state.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        index: { type: 'number', description: 'Pull request number' },
      },
      required: ['owner', 'repo', 'index'],
    },
    handler: (c, a) => c.getPullRequest(req(a, 'owner'), req(a, 'repo'), req(a, 'index')),
  },
  {
    name: 'get_pull_request_diff',
    description: 'Get the unified diff (.diff) for a pull request as plain text.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        index: { type: 'number', description: 'Pull request number' },
      },
      required: ['owner', 'repo', 'index'],
    },
    handler: (c, a) => c.getPullRequestDiff(req(a, 'owner'), req(a, 'repo'), req(a, 'index')),
  },
  {
    name: 'create_pull_request',
    description: 'Open a new pull request from a head branch into a base branch.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        title: { type: 'string', description: 'Pull request title' },
        head: { type: 'string', description: 'Source branch (the branch with your changes)' },
        base: { type: 'string', description: 'Target branch to merge into' },
        body: { type: 'string', description: 'Pull request description (Markdown)' },
      },
      required: ['owner', 'repo', 'title', 'head', 'base'],
    },
    handler: (c, a) =>
      c.createPullRequest(req(a, 'owner'), req(a, 'repo'), {
        title: req(a, 'title'),
        head: req(a, 'head'),
        base: req(a, 'base'),
        body: a.body,
      }),
  },
  {
    name: 'get_commit_status',
    description:
      'Get the combined CI/commit status for a ref (branch, tag, or SHA): overall state plus each check.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        ref: { type: 'string', description: 'Branch, tag, or commit SHA' },
      },
      required: ['owner', 'repo', 'ref'],
    },
    handler: (c, a) => c.getCommitStatus(req(a, 'owner'), req(a, 'repo'), req(a, 'ref')),
  },
  {
    name: 'list_branches',
    description: 'List repository branches with their latest commit and protection status; paginated.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        ...pagination,
      },
      required: ['owner', 'repo'],
    },
    handler: (c, a) =>
      c.listBranches(req(a, 'owner'), req(a, 'repo'), { page: a.page, limit: a.limit }),
  },
  {
    name: 'get_branch',
    description: 'Get a single branch by name, including its latest commit and protection status.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        branch: { type: 'string', description: 'Branch name' },
      },
      required: ['owner', 'repo', 'branch'],
    },
    handler: (c, a) => c.getBranch(req(a, 'owner'), req(a, 'repo'), req(a, 'branch')),
  },
  {
    name: 'list_commits',
    description:
      'List commits, newest first. sha selects the starting branch, tag, or commit ' +
      '(defaults to the repo default branch); path limits to commits touching that file. Paginated.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        sha: { type: 'string', description: 'Starting branch, tag, or commit (defaults to the repo default branch)' },
        path: { type: 'string', description: 'Only commits that touched this file path' },
        ...pagination,
      },
      required: ['owner', 'repo'],
    },
    handler: (c, a) =>
      c.listCommits(req(a, 'owner'), req(a, 'repo'), {
        sha: a.sha,
        path: a.path,
        page: a.page,
        limit: a.limit,
      }),
  },
  {
    name: 'get_commit',
    description: 'Get a single commit by SHA (or ref), including its message, author, and committer.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        sha: { type: 'string', description: 'Commit SHA or ref' },
      },
      required: ['owner', 'repo', 'sha'],
    },
    handler: (c, a) => c.getCommit(req(a, 'owner'), req(a, 'repo'), req(a, 'sha')),
  },
  {
    name: 'create_branch',
    description:
      'Create a branch. old_ref_name is the source branch, tag, or commit to branch from ' +
      '(defaults to the repo default branch). Additive write; no branch is deleted or moved.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        new_branch_name: { type: 'string', description: 'Name for the new branch' },
        old_ref_name: {
          type: 'string',
          description: 'Source branch, tag, or commit to branch from (defaults to the repo default branch)',
        },
      },
      required: ['owner', 'repo', 'new_branch_name'],
    },
    handler: (c, a) =>
      c.createBranch(req(a, 'owner'), req(a, 'repo'), {
        new_branch_name: req(a, 'new_branch_name'),
        old_ref_name: a.old_ref_name,
      }),
  },
  {
    name: 'list_releases',
    description: 'List repository releases, newest first (includes drafts and prereleases).',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        ...pagination,
      },
      required: ['owner', 'repo'],
    },
    handler: (c, a) =>
      c.listReleases(req(a, 'owner'), req(a, 'repo'), { page: a.page, limit: a.limit }),
  },
  {
    name: 'get_release',
    description: 'Get a single release by its numeric ID, including notes, draft, and prerelease flags.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        id: { type: 'number', description: 'Release ID' },
      },
      required: ['owner', 'repo', 'id'],
    },
    handler: (c, a) => c.getRelease(req(a, 'owner'), req(a, 'repo'), req(a, 'id')),
  },
  {
    name: 'create_release',
    description:
      'Create a release for a tag. Set draft to keep it unpublished or prerelease to mark it early. Additive write.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        tag_name: { type: 'string', description: 'Tag to release; created from target if it does not exist' },
        target_commitish: { type: 'string', description: 'Branch or commit the tag points at (defaults to the repo default branch)' },
        name: { type: 'string', description: 'Release title' },
        body: { type: 'string', description: 'Release notes (Markdown)' },
        draft: { type: 'boolean', description: 'Create as an unpublished draft' },
        prerelease: { type: 'boolean', description: 'Mark as a prerelease' },
      },
      required: ['owner', 'repo', 'tag_name'],
    },
    handler: (c, a) =>
      c.createRelease(req(a, 'owner'), req(a, 'repo'), {
        tag_name: req(a, 'tag_name'),
        target_commitish: a.target_commitish,
        name: a.name,
        body: a.body,
        draft: a.draft,
        prerelease: a.prerelease,
      }),
  },
  {
    name: 'list_tags',
    description: 'List repository tags with their target commits.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        ...pagination,
      },
      required: ['owner', 'repo'],
    },
    handler: (c, a) =>
      c.listTags(req(a, 'owner'), req(a, 'repo'), { page: a.page, limit: a.limit }),
  },
  {
    name: 'get_tag',
    description: 'Get a single tag by name, including its target commit and annotation message.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        tag: { type: 'string', description: 'Tag name' },
      },
      required: ['owner', 'repo', 'tag'],
    },
    handler: (c, a) => c.getTag(req(a, 'owner'), req(a, 'repo'), req(a, 'tag')),
  },
  {
    name: 'create_tag',
    description: 'Create a tag on a branch or commit, optionally annotated with a message. Additive write.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        tag_name: { type: 'string', description: 'Name for the new tag' },
        target: { type: 'string', description: 'Branch or commit to tag (defaults to the repo default branch)' },
        message: { type: 'string', description: 'Annotation message for an annotated tag' },
      },
      required: ['owner', 'repo', 'tag_name'],
    },
    handler: (c, a) =>
      c.createTag(req(a, 'owner'), req(a, 'repo'), {
        tag_name: req(a, 'tag_name'),
        target: a.target,
        message: a.message,
      }),
  },
  {
    name: 'list_pull_request_reviews',
    description:
      'List the reviews on a pull request (approvals, change requests, and review comments).',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        index: { type: 'number', description: 'Pull request number' },
      },
      required: ['owner', 'repo', 'index'],
    },
    handler: (c, a) => c.listPullRequestReviews(req(a, 'owner'), req(a, 'repo'), req(a, 'index')),
  },
  {
    name: 'create_pull_request_review',
    description:
      'Submit a review on a pull request. Additive write. event is one of APPROVE, ' +
      'REQUEST_CHANGES, or COMMENT; body is the review comment (Markdown).',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        index: { type: 'number', description: 'Pull request number' },
        event: {
          type: 'string',
          enum: ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'],
          description: 'Review verdict',
        },
        body: { type: 'string', description: 'Review comment (Markdown)' },
      },
      required: ['owner', 'repo', 'index', 'event'],
    },
    handler: (c, a) =>
      c.createPullRequestReview(req(a, 'owner'), req(a, 'repo'), req(a, 'index'), {
        event: req(a, 'event'),
        body: a.body,
      }),
  },
  {
    name: 'request_pull_request_reviewers',
    description: 'Request reviews from one or more users on a pull request. Additive write.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        index: { type: 'number', description: 'Pull request number' },
        reviewers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Usernames to request review from',
        },
        team_reviewers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Team names to request review from (organization repos)',
        },
      },
      required: ['owner', 'repo', 'index', 'reviewers'],
    },
    handler: (c, a) =>
      c.requestPullRequestReviewers(req(a, 'owner'), req(a, 'repo'), req(a, 'index'), {
        reviewers: req(a, 'reviewers'),
        team_reviewers: a.team_reviewers,
      }),
  },
  {
    name: 'list_labels',
    description:
      'List the labels defined in a repository (id, name, color). Use it to resolve label ' +
      'names to the ids that add_labels expects. Paginated.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        ...pagination,
      },
      required: ['owner', 'repo'],
    },
    handler: (c, a) =>
      c.listLabels(req(a, 'owner'), req(a, 'repo'), { page: a.page, limit: a.limit }),
  },
  {
    name: 'add_labels',
    description:
      'Add labels to an issue or pull request (they share numbering). Additive write: ' +
      'existing labels are kept. labels are label ids (see list_labels).',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        index: { type: 'number', description: 'Issue or pull request number' },
        labels: {
          type: 'array',
          items: { type: 'number' },
          description: 'Label ids to add (from list_labels)',
        },
      },
      required: ['owner', 'repo', 'index', 'labels'],
    },
    handler: (c, a) =>
      c.addLabels(req(a, 'owner'), req(a, 'repo'), req(a, 'index'), req(a, 'labels')),
  },
  {
    name: 'add_assignees',
    description:
      'Assign users to an issue or pull request (they share numbering). Additive write: ' +
      'current assignees are preserved and the given usernames are added.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        index: { type: 'number', description: 'Issue or pull request number' },
        assignees: {
          type: 'array',
          items: { type: 'string' },
          description: 'Usernames to add as assignees',
        },
      },
      required: ['owner', 'repo', 'index', 'assignees'],
    },
    handler: (c, a) =>
      c.addAssignees(req(a, 'owner'), req(a, 'repo'), req(a, 'index'), req(a, 'assignees')),
  },
];

/**
 * Elevated (destructive) tier — OPT-IN, OFF BY DEFAULT.
 *
 * These are concatenated onto `tools` in src/index.ts ONLY when the double gate
 * is satisfied: `FORGEJO_MCP_ELEVATED=1` AND a distinct `FORGEJO_MCP_ELEVATED_TOKEN`.
 * The default read/write token never performs these operations.
 *
 * Deliberately minimal: merge and delete-branch only. User, secret, permission,
 * and org-admin writes are PERMANENTLY EXCLUDED — they are never appropriate to
 * hand to an LLM that reads untrusted content, regardless of this flag.
 */
export const elevatedTools: ToolDefinition[] = [
  {
    name: 'merge_pull_request',
    description:
      '[ELEVATED — DESTRUCTIVE] Merge a pull request into its base branch. This ' +
      'writes to the default branch and cannot be undone from here. Style is one ' +
      'of merge (default), rebase, or squash.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        index: { type: 'number', description: 'Pull request number' },
        style: {
          type: 'string',
          enum: ['merge', 'rebase', 'squash'],
          description: 'Merge strategy (default: merge)',
        },
      },
      required: ['owner', 'repo', 'index'],
    },
    handler: (c, a) =>
      c.mergePullRequest(req(a, 'owner'), req(a, 'repo'), req(a, 'index'), { style: a.style }),
  },
  {
    name: 'delete_branch',
    description:
      '[ELEVATED — DESTRUCTIVE] Permanently delete a branch. This cannot be undone; ' +
      'unmerged commits on the branch may be lost.',
    inputSchema: {
      type: 'object',
      properties: {
        ...ownerRepo,
        branch: { type: 'string', description: 'Branch name to delete' },
      },
      required: ['owner', 'repo', 'branch'],
    },
    handler: (c, a) => c.deleteBranch(req(a, 'owner'), req(a, 'repo'), req(a, 'branch')),
  },
];
