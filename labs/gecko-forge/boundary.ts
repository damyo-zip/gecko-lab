import { fileURLToPath } from 'node:url';
import { relative, resolve, isAbsolute } from 'node:path';
import type { Plugin } from 'vite';

export const projectRoot = fileURLToPath(new URL('.', import.meta.url));
export const coreRoot = resolve(projectRoot, 'src/core');
/** All application/engine source must be inside this project, in any checkout. */
export function assertModuleBoundary(id: string): void {
  const path = id.split('?')[0];
  if (!isAbsolute(path)) return; // bundler virtual modules / node builtins
  const normalized = path.replaceAll('\\', '/');
  if (/\/node_modules\/(next|react|react-dom)\//.test(normalized)) throw new Error(`Forge framework dependency: ${path}`);
  const local = relative(projectRoot, path);
  if (local.startsWith('..') || isAbsolute(local)) throw new Error(`Forge outside-project dependency: ${path}`);
  if (/^src\/(game|storage|components)\//.test(local.replaceAll('\\', '/'))) throw new Error(`Forge game dependency: ${path}`);
}
export function engineBoundary(): Plugin {
  return {
    name: 'forge-pure-dependency-boundary',
    moduleParsed(info) { assertModuleBoundary(info.id); },
  };
}
