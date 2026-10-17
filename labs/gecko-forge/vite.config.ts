import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { engineBoundary, labRoot, repoRoot } from './boundary.ts';

export default defineConfig(({ mode }) => ({
  root: labRoot,
  resolve: { alias: { '@': resolve(repoRoot, 'src') } },
  plugins: [engineBoundary()],
  server: { port: 5174, strictPort: true, fs: { allow: [labRoot, resolve(repoRoot, 'src')] } },
  preview: { port: 5174, strictPort: true },
  build: mode === 'engine' ? {
    outDir: 'dist-engine',
    lib: { entry: resolve(labRoot, 'src/engine/index.ts'), formats: ['es'], fileName: 'gecko-forge' },
    copyPublicDir: false,
  } : { outDir: 'dist', target: 'es2022' },
}));
