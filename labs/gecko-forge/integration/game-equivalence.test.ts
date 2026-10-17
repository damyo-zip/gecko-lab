import { expect, test } from 'vitest';
import { createFounder, createOffspring } from '../src/engine/individual';
import { calculatePhenotype } from '../src/engine/appearance';
import { baselineSpecimen, renderIndividual } from '../src/engine/renderer';
import { LOCI, wildGenome } from '../src/engine/genetics';
import { founderRecord, offspringRecord } from '@/game/hardcore/genetics';
import { specimen } from '@/game/hardcore/adapter';
import { legacyTraits } from '@/genetics/advanced/phenotype';
import { polyScores } from '@/genetics/advanced/polygenic';
import { renderSprite } from '@/engine/render';
import type { ForgeGecko } from '../src/engine/model';

const legacyGenotype = (g: ForgeGecko) => ({ modelVersion: 1 as const, loci: { 'lilly-white': g.genome.mendelian.loci['lilly-white'], axanthic: g.genome.mendelian.loci.axanthic } });
function gameView(g: ForgeGecko): Parameters<typeof specimen>[0] {
  // Fixture only. No game creation/save/turn runs in this comparison.
  return { id: g.id, name: g.name, visualSeed: g.visualSeed, stage: 'adult', genotype: legacyGenotype(g),
    sex: g.sex, birthTurn: 0, nextBreedTurn: 0, generation: g.generation, parents: g.parents,
    birthDate: '2026-10-17', status: 'pedigree', hearts: 5, lastFedDate: null, diedDate: null,
    cycleAnchor: '2026-10-17', recoverUntil: '2026-10-17', lineageIds: [], provenance: 'known',
    potential: legacyTraits(polyScores(g.genome.polygenic)), genetics: { ...founderRecord(legacyGenotype(g), g.creationSeed), genome: g.genome } };
}
test('founder and child genomes exactly match production record constructors', () => {
  const f = createFounder({ id: 'f', seed: 'production-f', sex: 'male' }), m = createFounder({ id: 'm', seed: 'production-m', sex: 'female' });
  f.genome.mendelian.loci['lilly-white'] = ['n', 'Lw']; m.genome.mendelian.loci.axanthic = ['A', 'ax'];
  const fr = founderRecord(legacyGenotype(f), f.creationSeed), mr = founderRecord(legacyGenotype(m), m.creationSeed);
  expect(fr.genome).toEqual(f.genome); expect(mr.genome).toEqual(m.genome);
  for (let i = 0; i < 50; i++) {
    const seed = `match-production-${i}`, child = createOffspring(f, m, { id: `c${i}`, seed });
    expect(offspringRecord(fr, mr, null, seed, child.id, true).genome).toEqual(child.genome);
  }
});
test('all viable supported Mendelian combinations and both fire states match game adapter pixels', () => {
  // 2 viable Lilly × 3 Ax × 10 complex × 2 fire = 120 production comparisons.
  for (const lilly of ['n/n', 'n/Lw']) for (const ax of ['A/A', 'A/ax', 'ax/ax']) for (const complex of Object.keys(LOCI[2].phenotypes)) for (const fire of ['up', 'down'] as const) {
    const mendelian = wildGenome();
    for (const [id, pair] of [['lilly-white', lilly], ['axanthic', ax], ['cappuccino-complex', complex]]) mendelian.loci[id] = pair.split('/') as [string, string];
    const g = createFounder({ id: 'match', seed: 'production-match', mendelian }); g.fire = fire;
    const expected = specimen(gameView(g), fire), actual = baselineSpecimen({ phenotype: calculatePhenotype(g.genome), seed: g.visualSeed, fire });
    expect(actual.appearance).toEqual(expected.appearance);
    expect(Buffer.from(renderIndividual(g)!.pixels).equals(Buffer.from(renderSprite(expected).pixels)), `${lilly} / ${ax} / ${complex} / ${fire}`).toBe(true);
  }
});
