import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { labRoot, repoRoot } from './boundary.ts';

/** Only initial extraction / final transplant. Routine art work uses npm test. */
export default defineConfig({
  root: labRoot, resolve: { alias: { '@': resolve(repoRoot, 'src') } },
  test: { include: ['integration/**/*.test.ts'], environment: 'node', maxWorkers: 2 },
});
