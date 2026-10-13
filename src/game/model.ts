import type { Genotype } from "@/genetics/mendel";
import type { PotentialTraits, TraitVariation } from "@/genetics/traits";

export const SAVE_VERSION = 2 as const;
export const RULES_VERSION = 1 as const;
export type Sex = "male" | "female";
export type GrowthStage = "hatchling" | "juvenile" | "adult";
export const STAGE_LABELS: Record<GrowthStage, string> = { hatchling: "해칭", juvenile: "아성체", adult: "성체" };
export const SEX_LABELS: Record<Sex, string> = { male: "수컷", female: "암컷" };

export interface Parents { fatherId: string; motherId: string }
export interface Individual {
  id: string;
  name: string;
  sex: Sex;
  birthTurn: number;
  stage: GrowthStage;
  parents: Parents | null;
  generation: number;
  genotype: Genotype;
  potential: PotentialTraits;
  visualSeed: string;
  nextBreedTurn: number;
}
export interface Egg {
  id: string;
  clutch: number;
  laidTurn: number;
  dueTurn: number;
  parents: Parents;
  /** Fixed at laying. Hatching reveals this record; it never rolls genetics again. */
  embryo: Individual;
  status: "incubating" | "hatched";
  hatchedTurn: number | null;
}
export interface GameRules {
  clutchSize: 2;
  incubationTurns: number;
  juvenileAfter: number;
  adultAfter: number;
  cooldownTurns: number;
  traitVariation: TraitVariation;
}
export interface GameState {
  saveVersion: 2;
  rulesVersion: 1;
  gameId: string;
  seed: string;
  revision: number;
  turn: number;
  nextClutch: number;
  rules: GameRules;
  individuals: Record<string, Individual>;
  eggs: Record<string, Egg>;
}
export type GameAction =
  | { type: "breed"; fatherId: string; motherId: string }
  | { type: "advance"; turns: number }
  | { type: "rename"; id: string; name: string };

export function growthStage(individual: Individual, turn: number, rules: GameRules): GrowthStage {
  const age = turn - individual.birthTurn;
  return age >= rules.adultAfter ? "adult" : age >= rules.juvenileAfter ? "juvenile" : "hatchling";
}
