// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Dax Davis / Rubicon TechVentures
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ForgejoClient } from './client';
import { elevatedTools, tools } from './tools';

/**
 * Decide whether the opt-in elevated (destructive) tier is active.
 *
 * Double gate — BOTH must hold, or the tier stays off (fail closed):
 *   1. FORGEJO_MCP_ELEVATED=1        (explicit operator opt-in)
 *   2. FORGEJO_MCP_ELEVATED_TOKEN=…  (a token distinct from FORGEJO_TOKEN)
 *
 * With neither set, the tool surface is byte-identical to the safe default.
 */
function resolveElevation(env: NodeJS.ProcessEnv): { active: boolean; token: string } {
  const flagged = env.FORGEJO_MCP_ELEVATED === '1';
  const token = env.FORGEJO_MCP_ELEVATED_TOKEN ?? '';
  if (!flagged) return { active: false, token: '' };
  if (!token) {
    console.error(
      '[forgejo-mcp] FORGEJO_MCP_ELEVATED=1 but FORGEJO_MCP_ELEVATED_TOKEN is unset — ' +
        'elevated tools will NOT be registered (fail closed). Set a distinct, ' +
        'separately-scoped token to enable them.',
    );
    return { active: false, token: '' };
  }
  console.error(
    '[forgejo-mcp] ELEVATED TIER ACTIVE — destructive tools (merge_pull_request, ' +
      'delete_branch) are registered. Do NOT blanket-allowlist this server; ' +
      'allowlist only the specific safe tools you want to run without prompts.',
  );
  return { active: true, token };
}

async function main(): Promise<void> {
  const elevation = resolveElevation(process.env);

  const client = new ForgejoClient({
    baseUrl: process.env.FORGEJO_BASE_URL ?? '',
    token: process.env.FORGEJO_TOKEN ?? '',
    elevatedToken: elevation.active ? elevation.token : undefined,
  });

  const activeTools = elevation.active ? [...tools, ...elevatedTools] : tools;

  const server = new Server(
    { name: 'forgejo-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  const byName = new Map(activeTools.map((tool) => [tool.name, tool]));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: activeTools.map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = byName.get(request.params.name);
    if (!tool) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
      };
    }

    try {
      const result = await tool.handler(client, request.params.arguments ?? {});
      const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      return { content: [{ type: 'text', text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: 'text', text: message }] };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('forgejo-mcp server running on stdio');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
