import { expect, test } from 'vitest';
import { createFounder, createOffspring } from '../src/engine/individual';
import { emptyWorkspace, exportWorkspace, importWorkspace } from '../src/engine/workspace';
import { renderIndividual } from '../src/engine/renderer';

function example() {
  const w = emptyWorkspace(), f = createFounder({ id: 'f', sex: 'male', seed: 'f' }), m = createFounder({ id: 'm', sex: 'female', seed: 'm' });
  w.individuals = [f, m, createOffspring(f, m, { id: 'c', seed: 'c' })];
  w.favorites = ['c']; w.selectedId = 'c'; w.fatherId = 'f'; w.motherId = 'm'; w.nextId = 4;
  return w;
}
test('JSON roundtrip preserves full genome, seed, pedigree, settings and pixels', () => {
  const before = example(), restored = importWorkspace(exportWorkspace(before));
  expect(restored).toEqual(before);
  expect(importWorkspace(exportWorkspace(before, false))).toEqual(before);
  expect(renderIndividual(restored.individuals[2])!.pixels).toEqual(renderIndividual(before.individuals[2])!.pixels);
  expect(createOffspring(restored.individuals[0], restored.individuals[1], { id: 'repeat', seed: 'c' }).genome).toEqual(restored.individuals[2].genome);
});
test('rejects game saves, unknown versions, duplicate IDs, invalid alleles and broken pedigree', () => {
  expect(() => importWorkspace('{"saveVersion":10}')).toThrow('Forge');
  const corruptions = [
    (w: ReturnType<typeof example>) => { w.individuals[0].genome.polygenic.loci['red-0'] = [5, 0]; },
    (w: ReturnType<typeof example>) => { w.individuals[1].id = 'f'; },
    (w: ReturnType<typeof example>) => { w.individuals[2].parents!.fatherId = 'c'; },
    (w: ReturnType<typeof example>) => { w.individuals[2].parents!.motherId = 'missing'; },
    (w: ReturnType<typeof example>) => { w.selectedId = 'missing'; },
    (w: ReturnType<typeof example>) => { w.individuals[0].visualSeed = ''; },
  ];
  for (const corrupt of corruptions) { const w = example(); corrupt(w); expect(() => importWorkspace(JSON.stringify(w))).toThrow(); }
});
test('import validation does not modify source workspace and keeps nonviable outcomes', () => {
  const w = example(); w.individuals[2].genome.mendelian.loci['lilly-white'] = ['Lw', 'Lw'];
  const before = JSON.stringify(w), restored = importWorkspace(before);
  restored.individuals[0].genome.polygenic.loci['red-0'] = [0, 0];
  expect(JSON.stringify(w)).toBe(before); expect(renderIndividual(restored.individuals[2])).toBeNull();
});
