import { founderPoly, inherit, inheritPoly, LOCI, pairKey, seededRandom, validateMendelian, validatePoly, wildGenome } from './genetics';
import type { Genome, MendelianGenome } from './genetics';
import type { ForgeGecko, Sex } from './model';
import { inheritMorphExtensions } from './morph-extensions';

export function validateSeed(seed: string): void {
  if (typeof seed !== 'string' || !seed.trim() || seed.length > 128) throw new Error('시드는 1~128자여야 합니다.');
}
export function validateGenome(genome: Genome): void {
  if (!genome || genome.version !== 1) throw new Error('지원하지 않는 유전체 버전입니다.');
  validateMendelian(genome.mendelian); validatePoly(genome.polygenic);
}
export function viability(genome: Genome): { viable: boolean; reasons: string[] } {
  validateGenome(genome);
  const reasons = LOCI.filter(l => l.nonViable.includes(pairKey(genome.mendelian.loci[l.id], l))).map(l => l.phenotypes[pairKey(genome.mendelian.loci[l.id], l)]);
  return { viable: reasons.length === 0, reasons };
}

export interface FounderInput {
  id: string; seed: string; visualSeed?: string; sex?: Sex; name?: string; mendelian?: MendelianGenome;
}
export function createFounder(input: FounderInput): ForgeGecko {
  validateSeed(input.seed); validateSeed(input.visualSeed ?? input.seed);
  const genome: Genome = { version: 1, mendelian: structuredClone(input.mendelian ?? wildGenome()), polygenic: founderPoly(input.seed) };
  validateGenome(genome);
  return {
    version: 1, id: input.id, name: input.name ?? input.id,
    sex: input.sex ?? (seededRandom(input.seed, 'forge:sex')() < .5 ? 'male' : 'female'),
    genome, creationSeed: input.seed, visualSeed: input.visualSeed ?? input.seed, fire: 'up',
    generation: 1, parents: null, origin: 'founder', derivedFrom: null,
  };
}

export function createOffspring(father: ForgeGecko, mother: ForgeGecko, input: { id: string; seed: string; visualSeed?: string }): ForgeGecko {
  validateSeed(input.seed); validateSeed(input.visualSeed ?? input.seed);
  if (father.id === mother.id || father.sex !== 'male' || mother.sex !== 'female') throw new Error('서로 다른 수컷·암컷 부모를 선택하세요.');
  if (!viability(father.genome).viable || !viability(mother.genome).viable) throw new Error('비생존 유전형은 부모로 선택할 수 없습니다.');
  // EXACT same calls and domains as game/hardcore/genetics. No retry, averaging,
  // mutation, selection bias, or newly invented mortality for complex alleles.
  const genome: Genome = { version: 1,
    mendelian: inherit(father.genome.mendelian, mother.genome.mendelian, input.seed),
    polygenic: inheritPoly(father.genome.polygenic, mother.genome.polygenic, input.seed),
  };
  const extensions = inheritMorphExtensions(father.extensions, mother.extensions, input.seed);
  return {
    version: 1, id: input.id, name: input.id,
    sex: seededRandom(input.seed, 'forge:sex')() < .5 ? 'male' : 'female',
    creationSeed: input.seed, visualSeed: input.visualSeed ?? input.seed, fire: 'up',
    genome, generation: Math.max(father.generation, mother.generation) + 1,
    parents: { fatherId: father.id, motherId: mother.id }, origin: 'offspring', derivedFrom: null,
    ...(extensions ? { extensions } : {}),
  };
}
