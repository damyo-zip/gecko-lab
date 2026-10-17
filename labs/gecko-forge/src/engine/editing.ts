import { FEATURES, POLY_CONFIG, polyScores } from './genetics';
import type { Feature, Genome } from './genetics';
import { validateGenome } from './individual';

export function alleleMean(genome: Genome, feature: Feature): number {
  return Array.from({ length: POLY_CONFIG.lociPerFeature }, (_, i) => genome.polygenic.loci[`${feature}-${i}`]).flat().reduce((a, b) => a + b, 0) / 12;
}
/** Lab editor, NOT inheritance/inference. Set twelve actual allele indices in
 * six existing loci; scores still use the original logistic/pleiotropy model. */
export function editFeature(genome: Genome, feature: Feature, mean: number): Genome {
  validateGenome(genome);
  if (!FEATURES.includes(feature) || !Number.isFinite(mean) || mean < 0 || mean > 4) throw new Error('형질 편집 범위는 0~4입니다.');
  const copy = structuredClone(genome), total = Math.round(mean * 12), floor = Math.floor(total / 12), extra = total % 12;
  for (let i = 0; i < 6; i++) copy.polygenic.loci[`${feature}-${i}`] = [floor + (i * 2 < extra ? 1 : 0), floor + (i * 2 + 1 < extra ? 1 : 0)];
  validateGenome(copy); polyScores(copy.polygenic);
  return copy;
}
