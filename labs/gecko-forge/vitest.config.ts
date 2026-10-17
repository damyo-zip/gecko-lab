import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { labRoot, repoRoot } from './boundary.ts';

export default defineConfig({
  root: labRoot,
  resolve: { alias: { '@': resolve(repoRoot, 'src') } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node', maxWorkers: 2 },
});
