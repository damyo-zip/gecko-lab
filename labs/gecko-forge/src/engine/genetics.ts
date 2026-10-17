/** Shared implementations, not copies. Do not change inheritance to test new art. */
export { inherit, cross, risks } from '@/genetics/advanced/inheritance';
export { LOCI, pairKey, wildGenome, validateMendelian } from '@/genetics/advanced/loci';
export { founderPoly, inheritPoly, polyScores, validatePoly, POLY_IDS, POLY_CONFIG, FEATURE_LABELS } from '@/genetics/advanced/polygenic';
export { phenotype } from '@/genetics/advanced/phenotype';
export { FEATURES } from '@/genetics/advanced/model';
export type { Genome, MendelianGenome, Feature, Scores } from '@/genetics/advanced/model';
export { seededRandom, seedId } from '@/genetics/random';
