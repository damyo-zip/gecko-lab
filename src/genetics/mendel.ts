import { seededRandom } from "./random";

export type AllelePair = readonly [string, string];
export interface Genotype {
  modelVersion: 1;
  loci: Record<string, AllelePair>;
}
export interface LocusDefinition {
  id: string;
  name: string;
  alleles: readonly string[];
  nonViablePairs: readonly AllelePair[];
  evidence: string;
}
export const LILLY_LOCUS: LocusDefinition = {
  id: "lilly-white", name: "Lilly White", alleles: ["n", "Lw"], nonViablePairs: [["Lw", "Lw"]],
  evidence: "브리더 관찰에 기반한 단일 우성 형질 / 동형접합 비생존 모델. 분자 유전자 검사 모델은 아닙니다.",
};
export const SUPPORTED_LOCI: readonly LocusDefinition[] = [LILLY_LOCUS];
export const normalGenotype = (): Genotype => ({ modelVersion: 1, loci: { "lilly-white": ["n", "n"] } });
export const lillyGenotype = (): Genotype => ({ modelVersion: 1, loci: { "lilly-white": ["n", "Lw"] } });

export interface LocusOutcome {
  alleles: AllelePair;
  probability: number;
  viable: boolean;
  /** P(genotype | viable), explicitly separate from P(genotype at fertilization). */
  viableProbability: number;
}
export interface CrossForecast {
  loci: { definition: LocusDefinition; outcomes: LocusOutcome[] }[];
  nonViableProbability: number;
}

export function canonicalPair(pair: AllelePair, definition: LocusDefinition): AllelePair {
  if (pair.length !== 2 || pair.some((allele) => !definition.alleles.includes(allele)))
    throw new Error("지원하지 않는 대립유전자입니다: " + definition.name);
  return [...pair].sort((a, b) => definition.alleles.indexOf(a) - definition.alleles.indexOf(b)) as unknown as AllelePair;
}

export function isViablePair(pair: AllelePair, definition: LocusDefinition): boolean {
  const normalized = canonicalPair(pair, definition);
  return !definition.nonViablePairs.some((excluded) => {
    const value = canonicalPair(excluded, definition);
    return value[0] === normalized[0] && value[1] === normalized[1];
  });
}

export function validateGenotype(genotype: Genotype, definitions = SUPPORTED_LOCI): void {
  if (genotype.modelVersion !== 1 || !genotype.loci || Object.keys(genotype.loci).length !== definitions.length ||
    Object.keys(genotype).some(key => key !== "modelVersion" && key !== "loci"))
    throw new Error("지원하지 않는 유전 모델입니다.");
  for (const definition of definitions) {
    const pair = genotype.loci[definition.id];
    if (!Array.isArray(pair) || pair.length !== 2) throw new Error("유전형에 필수 유전자좌가 없습니다.");
    canonicalPair(pair, definition);
  }
}

/** Diploid Mendelian segregation; no phenotype labels participate in this calculation. */
export function crossLocus(father: AllelePair, mother: AllelePair, definition: LocusDefinition): LocusOutcome[] {
  const paternalPair = canonicalPair(father, definition), maternalPair = canonicalPair(mother, definition);
  const merged = new Map<string, LocusOutcome>();
  for (const paternal of paternalPair) for (const maternal of maternalPair) {
    const alleles = canonicalPair([paternal, maternal], definition);
    const key = alleles.join("/");
    const old = merged.get(key);
    if (old) old.probability += .25;
    else merged.set(key, { alleles, probability: .25, viable: isViablePair(alleles, definition), viableProbability: 0 });
  }
  const results = [...merged.values()];
  const survival = results.filter((value) => value.viable).reduce((sum, value) => sum + value.probability, 0);
  return results.map((value) => ({ ...value, viableProbability: value.viable && survival > 0 ? value.probability / survival : 0 }));
}

/**
 * Multiple independent loci are supported by the calculation API.
 * Linked/allelic interactions must be reviewed before a locus is registered.
 */
export function forecastCross(father: Genotype, mother: Genotype, definitions = SUPPORTED_LOCI): CrossForecast {
  validateGenotype(father, definitions); validateGenotype(mother, definitions);
  const loci = definitions.map((definition) => ({
    definition, outcomes: crossLocus(father.loci[definition.id], mother.loci[definition.id], definition),
  }));
  const survival = loci.reduce((product, locus) => product * locus.outcomes
    .filter((value) => value.viable).reduce((sum, value) => sum + value.probability, 0), 1);
  return { loci, nonViableProbability: 1 - survival };
}

/** Sampling includes nonviable outcomes for model validation. Gameplay blocks risky crosses first. */
export function inheritGenotype(father: Genotype, mother: Genotype, seed: string, definitions = SUPPORTED_LOCI): {
  genotype: Genotype; viable: boolean;
} {
  const forecast = forecastCross(father, mother, definitions);
  const genotype: Genotype = { modelVersion: 1, loci: {} };
  let viable = true;
  for (const locus of forecast.loci) {
    const roll = seededRandom(seed, "locus:" + locus.definition.id)();
    let cumulative = 0;
    const selected = locus.outcomes.find((value) => {
      cumulative += value.probability;
      return roll < cumulative;
    }) ?? locus.outcomes[locus.outcomes.length - 1];
    genotype.loci[locus.definition.id] = [...selected.alleles] as unknown as AllelePair;
    viable = viable && selected.viable;
  }
  return { genotype, viable };
}

export function hasLilly(genotype: Genotype): boolean {
  validateGenotype(genotype);
  return genotype.loci["lilly-white"].includes("Lw");
}
export function genotypeLabel(genotype: Genotype): string {
  return canonicalPair(genotype.loci["lilly-white"], LILLY_LOCUS).join("/");
}
