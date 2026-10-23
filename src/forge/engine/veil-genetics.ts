import { seededRandom } from './genetics';

export type VeilAlleles = readonly [number | null, number | null];
/** Quantitative game modifiers, not identified biological Lilly loci. */
export interface VeilTraits { version: 1; density: readonly VeilAlleles[] }
export const VEIL_TRAIT_MODEL = { version: 1, loci: 6, maximumAllele: 4,
  minimumStrength: .42, maximumStrength: .94,
  inheritanceDomain: 'companion:veil-density-inheritance:1',
  evidence: 'Game selection model; six fictional modifier loci, not a demonstrated biological mechanism.' } as const;
export function validateVeilTraits(value: unknown): VeilTraits {
  const v = value as VeilTraits;
  if (!v || typeof v !== 'object' || Array.isArray(v) || v.version !== 1 || Object.keys(v).sort().join() !== 'density,version' || !Array.isArray(v.density) || v.density.length !== 6 || v.density.some(p => !Array.isArray(p) || p.length !== 2 || p.some(a => a !== null && (!Number.isInteger(a) || a < 0 || a > 4)))) throw Error('베일 농도 형질은 6쌍의 0~4 또는 미기록 사본이어야 합니다.');
  return { version: 1, density: v.density.map(p => [...p] as unknown as VeilAlleles) };
}
export function unknownVeilTraits(): VeilTraits { return { version: 1, density: Array.from({ length: 6 }, () => [null, null]) }; }
export function veilDensity(value?: VeilTraits): number | null {
  const a = validateVeilTraits(value ?? unknownVeilTraits()).density.flat();
  return a.includes(null) ? null : a.reduce<number>((s, n) => s + n!, 0) / 48;
}
export const veilStrengthFromDensity = (v: number) => VEIL_TRAIT_MODEL.minimumStrength + (VEIL_TRAIT_MODEL.maximumStrength - VEIL_TRAIT_MODEL.minimumStrength) * v;
export function createVeilTraits(seed: string, density: number): VeilTraits {
  if (!Number.isFinite(density) || density < 0 || density > 1) throw Error('유전 베일 성향은 0~1이어야 합니다.');
  const total = Math.round(density * 48), low = Math.floor(total / 12), a = Array.from({ length: 12 }, (_, n) => low + (n < total % 12 ? 1 : 0)), rng = seededRandom(seed, 'companion:veil-density-founder:1');
  for (let n = 0; n < 24; n++) { const i = Math.floor(rng() * 12), j = Math.floor(rng() * 12); if (i !== j && a[i] > 0 && a[j] < 4) { a[i]--; a[j]++; } }
  return { version: 1, density: Array.from({ length: 6 }, (_, n) => [a[n * 2], a[n * 2 + 1]]) };
}
export function inheritVeilTraits(father: VeilTraits | undefined, mother: VeilTraits | undefined, seed: string): VeilTraits {
  const f = validateVeilTraits(father ?? unknownVeilTraits()), m = validateVeilTraits(mother ?? unknownVeilTraits()), rng = seededRandom(seed, VEIL_TRAIT_MODEL.inheritanceDomain);
  return { version: 1, density: f.density.map((p, n) => [p[rng() < .5 ? 0 : 1], m.density[n][rng() < .5 ? 0 : 1]]) };
}
export function forecastVeilDensity(father?: VeilTraits, mother?: VeilTraits) {
  const pairs = [...validateVeilTraits(father ?? unknownVeilTraits()).density, ...validateVeilTraits(mother ?? unknownVeilTraits()).density], known = pairs.every(p => !p.includes(null));
  const minimum = pairs.reduce((s, p) => s + Math.min(...p.map(a => a ?? 0)), 0) / 48, maximum = pairs.reduce((s, p) => s + Math.max(...p.map(a => a ?? 4)), 0) / 48;
  return { known, mean: known ? pairs.reduce((s, p) => s + (p[0]! + p[1]!) / 2, 0) / 48 : null, minimum, maximum,
    strengthMinimum: veilStrengthFromDensity(minimum), strengthMaximum: veilStrengthFromDensity(maximum) };
}
