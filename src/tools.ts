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
];
