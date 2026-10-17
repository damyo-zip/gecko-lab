import { fileURLToPath } from 'node:url';
import { relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

export const labRoot = fileURLToPath(new URL('.', import.meta.url));
export const repoRoot = resolve(labRoot, '../..');
const coreRoot = resolve(repoRoot, 'src');
/** No game state, React, Next, storage, economy or existing lab may enter either bundle. */
export function assertModuleBoundary(id: string): void {
  const path = id.split('?')[0];
  if (/\/node_modules\/(next|react|react-dom)\//.test(path)) throw new Error(`Forge framework dependency: ${path}`);
  if (!path.startsWith(repoRoot + sep) || path.includes('/node_modules/')) return;
  if (path.startsWith(labRoot)) return;
  const core = relative(coreRoot, path).split(sep).join('/');
  if (!/^(genetics|engine|phenotype)\//.test(core)) throw new Error(`Forge dependency boundary: ${core}`);
}
export function engineBoundary(): Plugin {
  return {
    name: 'forge-pure-dependency-boundary',
    moduleParsed(info) { assertModuleBoundary(info.id); },
  };
}
