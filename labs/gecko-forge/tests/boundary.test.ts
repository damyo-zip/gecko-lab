import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { assertModuleBoundary, labRoot, repoRoot } from '../boundary';

test('transitive public engine graph has no game/UI/storage/framework dependency', () => {
  const seen = new Set<string>(), queue = [resolve(labRoot, 'src/engine/index.ts')];
  while (queue.length) {
    const file = queue.pop()!; if (seen.has(file)) continue; seen.add(file); assertModuleBoundary(file);
    const info = ts.preProcessFile(readFileSync(file, 'utf8'), true, true);
    for (const entry of info.importedFiles) {
      const name = entry.fileName;
      expect(name.startsWith('.') || name.startsWith('@/'), `external dependency: ${name}`).toBe(true);
      const base = name.startsWith('@/') ? resolve(repoRoot, 'src', name.slice(2)) : resolve(dirname(file), name);
      const target = ts.sys.fileExists(base + '.ts') ? base + '.ts' : resolve(base, 'index.ts');
      queue.push(target);
    }
  }
  expect(seen.size).toBeGreaterThan(15);
  expect(() => assertModuleBoundary(resolve(repoRoot, 'src/game/hardcore/model.ts'))).toThrow('boundary');
  expect(() => assertModuleBoundary(resolve(repoRoot, 'src/components/Gecko.tsx'))).toThrow('boundary');
});
test('original B reference is the exact preserved source asset, not recreated art', () => {
  const png = readFileSync(resolve(labRoot, 'public/reference/B-original.png'));
  expect(createHash('sha256').update(png).digest('hex')).toBe('487aa44664d047f20a6875c48715f3a083ee876ddc524d5c01150ac9f03959de');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([96, 96]);
});
