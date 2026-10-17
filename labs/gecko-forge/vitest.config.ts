import { defineConfig } from 'vitest/config';
import { projectRoot, coreRoot } from './boundary.ts';

export default defineConfig({
  root: projectRoot,
  resolve: { alias: { '@': coreRoot } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node', maxWorkers: 2 },
});
