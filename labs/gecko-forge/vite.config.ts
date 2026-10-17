import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { engineBoundary, projectRoot, coreRoot } from './boundary.ts';

export default defineConfig(({ mode }) => ({
  root: projectRoot,
  resolve: { alias: { '@': coreRoot } },
  plugins: [engineBoundary()],
  server: { port: 5174, strictPort: true, fs: { strict: true, allow: [projectRoot] } },
  preview: { port: 5174, strictPort: true },
  build: mode === 'engine' ? {
    outDir: 'dist-engine',
    lib: { entry: resolve(projectRoot, 'src/engine/index.ts'), formats: ['es'], fileName: 'gecko-forge' },
    copyPublicDir: false,
  } : { outDir: 'dist', target: 'es2022' },
}));
