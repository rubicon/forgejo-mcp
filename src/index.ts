// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Dax Davis / Rubicon TechVentures
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ForgejoClient } from './client';
import { tools } from './tools';

async function main(): Promise<void> {
  const client = new ForgejoClient({
    baseUrl: process.env.FORGEJO_BASE_URL ?? '',
    token: process.env.FORGEJO_TOKEN ?? '',
  });

  const server = new Server(
    { name: 'forgejo-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
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
