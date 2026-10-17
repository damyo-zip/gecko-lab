import { expect, test } from 'vitest';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { assertModuleBoundary, projectRoot, coreRoot } from '../boundary';

test('transitive public engine graph is self-contained and has no game/UI/framework dependency', () => {
  const seen = new Set<string>(), queue = [resolve(projectRoot, 'src/engine/index.ts')];
  while (queue.length) {
    const file = realpathSync(queue.pop()!); if (seen.has(file)) continue; seen.add(file); assertModuleBoundary(file);
    const info = ts.preProcessFile(readFileSync(file, 'utf8'), true, true);
    for (const entry of info.importedFiles) {
      const name = entry.fileName;
      expect(name.startsWith('.') || name.startsWith('@/'), `external dependency: ${name}`).toBe(true);
      const base = name.startsWith('@/') ? resolve(coreRoot, name.slice(2)) : resolve(dirname(file), name);
      const target = ts.sys.fileExists(base + '.ts') ? base + '.ts' : resolve(base, 'index.ts');
      queue.push(target);
    }
  }
  expect(seen.size).toBeGreaterThan(15);
  expect(() => assertModuleBoundary(resolve(projectRoot, '../unrelated/source.ts'))).toThrow('outside-project');
  expect(() => assertModuleBoundary(resolve(projectRoot, 'src/game/model.ts'))).toThrow('game dependency');
  expect(() => assertModuleBoundary(resolve(projectRoot, 'node_modules/next/index.js'))).toThrow('framework');
});
test('original B reference is the exact preserved source asset, not recreated art', () => {
  const png = readFileSync(resolve(projectRoot, 'public/reference/B-original.png'));
  expect(createHash('sha256').update(png).digest('hex')).toBe('487aa44664d047f20a6875c48715f3a083ee876ddc524d5c01150ac9f03959de');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([96, 96]);
});

test('copied core and art remain byte-identical to the recorded upstream sources', () => {
  const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'provenance/source-manifest.json'), 'utf8')) as {
    entries: { file: string; sha256: string }[];
  };
  expect(manifest.entries.filter(e => e.file.startsWith('src/core/'))).toHaveLength(25);
  for (const entry of manifest.entries) {
    const path = realpathSync(resolve(projectRoot, entry.file)); assertModuleBoundary(path);
    expect(createHash('sha256').update(readFileSync(path)).digest('hex'), entry.file).toBe(entry.sha256);
  }
});
