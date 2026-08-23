// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Dax Davis / Rubicon TechVentures
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ForgejoClient } from './client';
import { elevatedTools, tools } from './tools';

// Replaced at build time by esbuild `define` with the version from package.json
// (see scripts/build.mjs), so the MCP handshake never advertises a stale literal.
declare const __PKG_VERSION__: string;

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
  // Elevation is additive on top of the default surface, so without a default
  // token there is no pair to be the second half of. Allowing it would produce
  // the worst possible split: the destructive tools working while the safe ones
  // fail on an unconfigured credential.
  if (!(env.FORGEJO_TOKEN ?? '')) {
    console.error(
      '[forgejo-mcp] FORGEJO_MCP_ELEVATED=1 but FORGEJO_TOKEN is unset — elevated ' +
        'tools will NOT be registered (fail closed). The elevated token is the second ' +
        'half of a pair, not a replacement for the everyday one.',
    );
    return { active: false, token: '' };
  }
  // A second token that equals the first is not a second token. The point of the
  // pair is blast radius: the everyday token is broad because it has to be, and
  // the elevated one is meant to be narrow and separately revocable. Accepting
  // them collapsed would give the appearance of a boundary with none of the
  // substance, which is worse than no boundary because it gets trusted.
  if (token === (env.FORGEJO_TOKEN ?? '')) {
    console.error(
      '[forgejo-mcp] FORGEJO_MCP_ELEVATED_TOKEN is identical to FORGEJO_TOKEN — ' +
        'elevated tools will NOT be registered (fail closed). The elevated tier ' +
        'exists to keep destructive operations off the everyday credential; mint a ' +
        'separate, narrowly-scoped token.',
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
    { name: 'forgejo-mcp', version: __PKG_VERSION__ },
    { capabilities: { tools: {} } },
  );

  const byName = new Map(activeTools.map((tool) => [tool.name, tool]));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: activeTools.map(({ name, description, inputSchema, annotations }) => ({
      name,
      description,
      inputSchema,
      annotations,
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
