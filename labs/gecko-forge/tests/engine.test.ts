import { expect, test } from 'vitest';
import { createFounder, createOffspring, viability } from '../src/engine/individual';
import { calculatePhenotype } from '../src/engine/appearance';
import { renderAppearance, renderIndividual } from '../src/engine/renderer';
import { editFeature } from '../src/engine/editing';
import { founderPoly, inherit, inheritPoly, LOCI, POLY_IDS, polyScores, wildGenome } from '../src/engine/genetics';
import { inherit as originalInherit } from '@/genetics/advanced/inheritance';
import { inheritPoly as originalInheritPoly } from '@/genetics/advanced/polygenic';

const father = () => createFounder({ id: 'father', sex: 'male', seed: 'father' });
const mother = () => createFounder({ id: 'mother', sex: 'female', seed: 'mother' });
test('shared inheritance functions are the original implementations, not a fork', () => {
  expect(inherit).toBe(originalInherit); expect(inheritPoly).toBe(originalInheritPoly);
  expect(father().genome.polygenic).toEqual(founderPoly('father'));
  expect(POLY_IDS).toHaveLength(60);
});
test('founders, phenotype and 96×96 RGBA reproduce independently of identity', () => {
  const f = father(), clone = { ...structuredClone(f), id: 'other', name: 'other' };
  expect(f).toEqual(father()); expect(calculatePhenotype(f.genome)).toEqual(calculatePhenotype(clone.genome));
  const image = renderIndividual(f)!;
  expect([image.width, image.height, image.pixels.length]).toEqual([96, 96, 96 * 96 * 4]);
  expect(image.pixels).toEqual(renderIndividual(clone)!.pixels);
  expect(image.pixels.some(v => v !== 0)).toBe(true);
  expect(new Set(Array.from(image.pixels).filter((_, i) => i % 4 === 3))).toEqual(new Set([0, 255]));
});
test('changing visual seed changes pixels, never genome or breeding values', () => {
  const f = father(), before = JSON.stringify(f.genome), changed = { ...f, visualSeed: 'other-seed' };
  expect(renderIndividual(f)!.pixels).not.toEqual(renderIndividual(changed)!.pixels);
  expect(calculatePhenotype(f.genome)).toEqual(calculatePhenotype(changed.genome)); expect(JSON.stringify(f.genome)).toBe(before);
});
test('render cache buffers are not mutable through returned output', () => {
  const f = father(), before = renderIndividual(f)!, pixels = before.pixels.slice();
  before.pixels.fill(0); before.layers[0].pixels.fill(0);
  expect(renderIndividual(f)!.pixels).toEqual(pixels);
});
test('every one of 63 loci inherits one actual allele from each parent, including C/S/H', () => {
  const f = father(), m = mother();
  f.genome.mendelian.loci['cappuccino-complex'] = ['C', 'H']; m.genome.mendelian.loci['cappuccino-complex'] = ['n', 'S'];
  const before = JSON.stringify([f, m]);
  for (let i = 0; i < 100; i++) {
    const c = createOffspring(f, m, { id: `c${i}`, seed: `cross${i}` });
    expect(c.genome.mendelian).toEqual(inherit(f.genome.mendelian, m.genome.mendelian, `cross${i}`));
    expect(c.genome.polygenic).toEqual(inheritPoly(f.genome.polygenic, m.genome.polygenic, `cross${i}`));
    for (const l of LOCI) { expect(f.genome.mendelian.loci[l.id]).toContain(c.genome.mendelian.loci[l.id][0]); expect(m.genome.mendelian.loci[l.id]).toContain(c.genome.mendelian.loci[l.id][1]); }
    for (const id of POLY_IDS) { expect(f.genome.polygenic.loci[id]).toContain(c.genome.polygenic.loci[id][0]); expect(m.genome.polygenic.loci[id]).toContain(c.genome.polygenic.loci[id][1]); }
  }
  expect(JSON.stringify([f, m])).toBe(before);
});
test('offspring and subsequent generations retain real pedigree and sibling diversity', () => {
  const f = father(), m = mother(), children = Array.from({ length: 16 }, (_, i) => createOffspring(f, m, { id: `c${i}`, seed: `siblings${i}` }));
  expect(new Set(children.map(c => JSON.stringify(c.genome))).size).toBe(16);
  for (const c of children) expect(c).toMatchObject({ generation: 2, parents: { fatherId: f.id, motherId: m.id } });
  const c = children.find(c => c.sex === 'male')!;
  expect(createOffspring(c, m, { id: 'grandchild', seed: 'f3' }).generation).toBe(3);
});
test('existing nonviable Lilly outcomes are kept, never rerolled or drawn alive', () => {
  const f = father(), m = mother(); f.genome.mendelian.loci['lilly-white'] = ['n', 'Lw']; m.genome.mendelian.loci['lilly-white'] = ['n', 'Lw'];
  const children = Array.from({ length: 100 }, (_, i) => createOffspring(f, m, { id: `c${i}`, seed: `lilly${i}` }));
  const failed = children.find(c => !viability(c.genome).viable)!;
  expect(failed).toBeDefined(); expect(failed.genome.mendelian.loci['lilly-white']).toEqual(['Lw', 'Lw']); expect(renderIndividual(failed)).toBeNull();
  expect(() => createOffspring({ ...failed, sex: 'male' }, m, { id: 'invalid', seed: 'invalid' })).toThrow('비생존');
});
test('all supported complex combinations can be inspected without adding mortality', () => {
  const locus = LOCI.find(l => l.id === 'cappuccino-complex')!;
  for (const pair of Object.keys(locus.phenotypes)) {
    const f = father(); f.genome.mendelian.loci[locus.id] = pair.split('/') as [string, string];
    expect(viability(f.genome).viable).toBe(true); expect(renderIndividual(f)!.width).toBe(96);
  }
});
test('feature editing changes only six actual loci; original scores and pleiotropy still run', () => {
  const g = father().genome, before = JSON.stringify(g), edited = editFeature(g, 'cream', 4);
  for (const id of POLY_IDS) expect(edited.polygenic.loci[id]).toEqual(id.startsWith('cream-') ? [4, 4] : g.polygenic.loci[id]);
  expect(polyScores(edited.polygenic).cream).toBeGreaterThan(polyScores(g.polygenic).cream);
  expect(polyScores(edited.polygenic).harlequin).toBeGreaterThan(polyScores(g.polygenic).harlequin);
  expect(JSON.stringify(g)).toBe(before); expect(() => editFeature(g, 'cream', NaN)).toThrow();
});
test('renderer interface accepts independent replacement without changing inheritance', () => {
  const p = calculatePhenotype(father().genome), baseline = renderIndividual(father())!;
  const custom = { id: 'test-only', render: () => baseline };
  expect(renderAppearance({ phenotype: p, seed: 'replace', fire: 'up' }, custom)).toBe(baseline);
  expect(() => renderAppearance({ phenotype: p, seed: '', fire: 'up' }, custom)).toThrow('시드');
  expect(() => createFounder({ id: 'bad', seed: 'x', mendelian: { ...wildGenome(), loci: {} } })).toThrow();
});
