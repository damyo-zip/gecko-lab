import type { AllelePair } from "../mendel";

export type Inheritance = "dominant" | "recessive" | "incomplete-dominant" | "multiple-alleles";
export interface Evidence {
  sources: readonly string[];
  reviewed: string;
  level: "breeder-supported" | "provisional" | "game-model";
  claim: string;
  disagreements: string;
  safety: string;
}
export interface Locus {
  id: string;
  name: string;
  alleles: readonly string[];
  inheritance: Inheritance;
  modelVersion: number;
  /** Explicit dosage/allelic phenotype rules, separate from safety. */
  phenotypes: Readonly<Record<string, string>>;
  nonViable: readonly string[];
  blocked: readonly string[];
  evidence: Evidence;
  linkage?: { chromosome?: string; group?: string; position?: number; recombination?: number };
}
export interface MendelianGenome { version: 1; loci: Record<string, AllelePair> }
export const FEATURES = ["red", "orange", "brightness", "cream", "dorsal", "flank", "harlequin", "spots", "pinstripe", "contrast"] as const;
export type Feature = typeof FEATURES[number];
export type Scores = Record<Feature, number>;
export interface PolyGenome { version: 1; loci: Record<string, readonly [number, number]> }
export interface Genome { version: 1; mendelian: MendelianGenome; polygenic: PolyGenome }
export type KnowledgeSource = "appearance" | "parents" | "offspring" | "seller" | "legacy" | "unknown";
export interface Belief {
  /** null = no justified prior. Never replace missing evidence with a fabricated probability. */
  probabilities: Record<string, number> | null;
  source: KnowledgeSource;
  evidenceIds: string[];
  note: string;
}
export interface Knowledge { version: 1; loci: Record<string, Belief> }
export interface GeneticsRecord {
  version: 1;
  /** Old numeric traits cannot reconstruct virtual alleles. null preserves the old model. */
  genome: Genome | null;
  knowledge: Knowledge;
  appearanceVersion: "legacy-1" | "5.0" | "patterns-1" | "regional-2";
  /** v9 mixed legacy crosses retain actual transmitted complex alleles.
   * null is genuinely unknown; it is never silently substituted with wild type. */
  unresolvedComplex?: readonly [string|null,string|null];
}
export interface JointOutcome {
  loci: Record<string, AllelePair>;
  probability: number;
  viableProbability: number;
  viable: boolean;
  safe: boolean;
  phenotype: string;
}
export interface Forecast {
  outcomes: JointOutcome[];
  phenotypes: { label: string; probability: number; viableProbability: number }[];
  nonViableProbability: number;
  blockedProbability: number;
}
