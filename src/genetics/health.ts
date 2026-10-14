import { seededRandom } from './random';
import type { AllelePair } from './mendel';

/** Fictional independent recessive loci. No claim of a real gecko disease/gene. */
export const HEALTH_LOCI = [
  { id: 'embryonic-vigor', mutant: 'v', frequency: .08, hatchFactor: .75, fertilityFactor: 1 },
  { id: 'fertility', mutant: 'f', frequency: .08, hatchFactor: 1, fertilityFactor: .8 },
] as const;
export interface HealthGenome { version: 1; loci: Record<string, AllelePair> }
export function founderHealth(seed: string): HealthGenome {
  return { version: 1, loci: Object.fromEntries(HEALTH_LOCI.map(l => {
    const rng = seededRandom(seed, 'health-founder:' + l.id);
    return [l.id, [rng() < l.frequency ? l.mutant : 'N', rng() < l.frequency ? l.mutant : 'N']];
  })) };
}
export function validateHealth(g: HealthGenome): void {
  if (!g || g.version !== 1 || Object.keys(g).sort().join() !== 'loci,version' || !g.loci ||
    Object.keys(g.loci).sort().join() !== HEALTH_LOCI.map(l => l.id).sort().join()) throw new Error('가상 열성 유전 기록 오류');
  for (const l of HEALTH_LOCI) {
    const pair = g.loci[l.id];
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some(a => a !== 'N' && a !== l.mutant)) throw new Error('가상 열성 대립유전자 오류');
  }
}
export function inheritHealth(father: HealthGenome, mother: HealthGenome, seed: string): HealthGenome {
  validateHealth(father); validateHealth(mother);
  return { version: 1, loci: Object.fromEntries(HEALTH_LOCI.map(l => {
    const rng = seededRandom(seed, 'health-inherit:' + l.id);
    return [l.id, [father.loci[l.id][rng() < .5 ? 0 : 1], mother.loci[l.id][rng() < .5 ? 0 : 1]]];
  })) };
}
export function healthEffects(g: HealthGenome) {
  validateHealth(g);
  const expressed = HEALTH_LOCI.filter(l => g.loci[l.id].every(a => a === l.mutant));
  return { hatchFactor: expressed.reduce((p,l) => p*l.hatchFactor, 1),
    fertilityFactor: expressed.reduce((p,l) => p*l.fertilityFactor, 1),
    expressed: expressed.map(l => l.id) };
}
