// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Dax Davis / Rubicon TechVentures
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

// Single source of truth for the version: read it from package.json (which
// release-please bumps) and inline it at build time. Keeps the MCP handshake's
// advertised version in lockstep with the package instead of a stale literal.
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  outfile: 'dist/index.js',
  define: { __PKG_VERSION__: JSON.stringify(version) },
  // The MCP SDK's transitive dependencies use require() at runtime; provide a
  // shim so the bundled ESM output can resolve them.
  banner: {
    js: [
      '#!/usr/bin/env node',
      "import { createRequire } from 'node:module';",
      'const require = createRequire(import.meta.url);',
    ].join('\n'),
  },
});
