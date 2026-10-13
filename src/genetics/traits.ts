import { seededRandom } from "./random";

export const TRAIT_KEYS = ["bodyTone", "redIntensity", "creamCoverage", "dorsalIntensity", "flankIntensity", "spotDensity"] as const;
export type TraitKey = typeof TRAIT_KEYS[number];
export type PotentialTraits = Record<TraitKey, number>;
export type TraitVariation = Record<TraitKey, number>;
export const TRAIT_LABELS: Record<TraitKey, string> = {
  bodyTone: "기본 체색", redIntensity: "적색 강도", creamCoverage: "크림 면적",
  dorsalIntensity: "등 패턴", flankIntensity: "측면 패턴", spotDensity: "반점 밀도",
};
export const DEFAULT_VARIATION: TraitVariation = {
  bodyTone: .12, redIntensity: .1, creamCoverage: .12, dorsalIntensity: .1, flankIntensity: .12, spotDensity: .16,
};
export const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function validateTraits(traits: PotentialTraits): void {
  if (!traits || Object.keys(traits).length !== TRAIT_KEYS.length ||
    TRAIT_KEYS.some((key) => !Number.isFinite(traits[key]) || traits[key] < 0 || traits[key] > 1))
    throw new Error("잠재 외형 형질은 0~1의 유한 수치여야 합니다.");
}

/** GAME APPROXIMATION: parental mean plus bounded uniform variation, not a genetic probability. */
export function inheritTraits(father: PotentialTraits, mother: PotentialTraits, seed: string, variation = DEFAULT_VARIATION): PotentialTraits {
  validateTraits(father); validateTraits(mother); validateTraits(variation);
  return Object.fromEntries(TRAIT_KEYS.map((key) => [
    key, clamp((father[key] + mother[key]) / 2 + (seededRandom(seed, "trait:" + key)() * 2 - 1) * variation[key]),
  ])) as PotentialTraits;
}
