import { createCompanionCappuccinoFounder, createCompanionCappuccinoOffspring, importCompanionCappuccinoWorkspace, COMPANION_CAPPUCCINO_PRESETS, type CompanionCappuccinoPresetId, forecastCappuccino } from './companion-cappuccino-breeding';
import { COMPANION_TRICOLOR_RENDERER_ID } from './companion-tricolor';
import { emptyWorkspace } from './workspace';
import { POLY_CONFIG, seededRandom, type Feature } from './genetics';
import type { FounderInput } from './individual';
import type { ColourPresetId } from './patternless-breeding';
import type { ForgeGecko } from './model';

const recipes = [
  { id: 'tricolor-harlequin', name: '트라이컬러 할리퀸', base: 'harlequin-pinstripe', orange: 3.6, cream: 3.4, contrast: 3.5, brightness: 1.6, pinstripe: 0 },
  { id: 'tricolor-pinstripe', name: '트라이컬러 니어 풀 핀', base: 'harlequin-pinstripe', orange: 3.6, cream: 3.4, contrast: 3.5, brightness: 1.6, pinstripe: 3.5 },
  { id: 'tricolor-full-pin', name: '트라이컬러 풀 핀', base: 'harlequin-pinstripe', orange: 3.6, cream: 3.4, contrast: 3.5, brightness: 1.6, pinstripe: 3.9 },
  { id: 'tricolor-orange', name: '주황이 풍부한 삼색', base: 'harlequin-pinstripe', orange: 4, cream: 2.9, contrast: 3.3, brightness: 1.8, pinstripe: 3.5 },
  { id: 'tricolor-cream', name: '크림이 풍부한 삼색', base: 'harlequin-pinstripe', orange: 3.3, cream: 3.8, contrast: 3.7, brightness: 1.6, pinstripe: 3.5 },
  { id: 'tricolor-dalmatian', name: '삼색 달마시안', base: 'dalmatian-pinstripe', orange: 3.6, cream: 3.4, contrast: 3.5, brightness: 1.6, pinstripe: 3.5 },
  { id: 'tricolor-cappuccino', name: '삼색 카푸치노', base: 'cappuccino-pinstripe', orange: 3.6, cream: 3.4, contrast: 3.5, brightness: 1.6, pinstripe: 3.5 },
  { id: 'tricolor-lilly', name: '삼색 바탕 릴리', base: 'lilly-pinstripe', orange: 3.6, cream: 3.4, contrast: 3.5, brightness: 1.6, pinstripe: 3.5 },
  { id: 'tricolor-axanthic', name: '삼색 바탕 아잔틱', base: 'axanthic-pinstripe', orange: 3.6, cream: 3.4, contrast: 3.5, brightness: 1.6, pinstripe: 3.5 },
] as const;
export const COMPANION_TRICOLOR_PRESETS = [...COMPANION_CAPPUCCINO_PRESETS, ...recipes.map(r => ({ ...r, colour: 'brown' as const }))] as const;
export type CompanionTricolorPresetId = typeof COMPANION_TRICOLOR_PRESETS[number]['id'];
// Founder recipes distribute real copies across heterozygous pairs so the
// chosen mean does not accidentally create a family that cannot segregate.
function setFounderFeature(g: ForgeGecko, feature: Feature, mean: number) {
  const total = Math.round(mean * 12), low = Math.floor(total / 12), extra = total % 12;
  const pairs: [number, number][] = Array.from({ length: 6 }, () => [low, low]);
  if (!extra && low > 0 && low < 4) pairs.forEach(p => { p[0] = low - 1; p[1] = low + 1; });
  else for (let n = 0; n < extra; n++) pairs[n % 6][n < 6 ? 1 : 0] = low + 1;
  const order = [0, 1, 2, 3, 4, 5], rng = seededRandom(g.creationSeed, `companion:tricolor-founder:${feature}:1`);
  for (let i = 5; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  pairs.forEach((p, n) => { g.genome.polygenic.loci[`${feature}-${order[n]}`] = p; });
}
export function createCompanionTricolorFounder(input: Omit<FounderInput, 'mendelian'> & { morph: CompanionTricolorPresetId; colour?: ColourPresetId }) {
  const recipe = recipes.find(r => r.id === input.morph);
  const g = createCompanionCappuccinoFounder({ ...input, morph: (recipe?.base ?? input.morph) as CompanionCappuccinoPresetId, colour: input.colour ?? (recipe ? 'brown' : undefined) });
  if (recipe) {
    for (const feature of ['orange', 'cream', 'contrast', 'brightness', 'pinstripe'] as const) setFounderFeature(g, feature, recipe[feature]);
    setFounderFeature(g, 'flank', 3.7); setFounderFeature(g, 'harlequin', 3.4);
  }
  return g;
}
export const createCompanionTricolorOffspring = createCompanionCappuccinoOffspring;
export function emptyCompanionTricolorWorkspace() {
  const b = emptyWorkspace(COMPANION_TRICOLOR_RENDERER_ID); b.settings.showB = false; b.offspringCount = 6; b.breedingSeed = 'tricolor-cross-1'; return b;
}
export function starterCompanionTricolorWorkspace() {
  const b = emptyCompanionTricolorWorkspace();
  b.individuals = [
    createCompanionTricolorFounder({ id: 'C-0001', name: '단풍', seed: 'tricolor-maple-1', sex: 'male', morph: 'tricolor-orange' }),
    createCompanionTricolorFounder({ id: 'C-0002', name: '우유', seed: 'tricolor-milk-1', sex: 'female', morph: 'tricolor-cream' }),
    createCompanionTricolorFounder({ id: 'C-0003', name: '살구', seed: 'tricolor-apricot-1', sex: 'male', morph: 'tricolor-harlequin' }),
    createCompanionTricolorFounder({ id: 'C-0004', name: '후추', seed: 'tricolor-pepper-1', sex: 'female', morph: 'tricolor-dalmatian' }),
    createCompanionTricolorFounder({ id: 'C-0005', name: '흑설탕', seed: 'tricolor-brown-sugar-1', sex: 'male', morph: 'tricolor-cappuccino' }),
    createCompanionTricolorFounder({ id: 'C-0006', name: '설빛', seed: 'tricolor-snow-1', sex: 'female', morph: 'tricolor-lilly' }),
  ];
  setFounderFeature(b.individuals[1], 'pinstripe', 44 / 12);
  b.nextId = 7; b.selectedId = b.fatherId = 'C-0001'; b.motherId = 'C-0002'; return b;
}
export function importCompanionTricolorWorkspace(json: string) {
  const b = importCompanionCappuccinoWorkspace(json); b.rendererVersion = COMPANION_TRICOLOR_RENDERER_ID; return b;
}
/** Exact reachable score bounds, including existing shared effects. These are
 * trait ranges, not a fabricated Mendelian probability for visible tricolor. */
export function forecastTricolor(father: ForgeGecko, mother: ForgeGecko) {
  const previous = forecastCappuccino(father, mother), effects = POLY_CONFIG.alleleEffects;
  const sumBounds = (feature: Feature) => {
    let min = 0, max = 0;
    for (let n = 0; n < 6; n++) {
      const f = father.genome.polygenic.loci[`${feature}-${n}`].map(a => effects[a]), m = mother.genome.polygenic.loci[`${feature}-${n}`].map(a => effects[a]);
      min += Math.min(...f) + Math.min(...m); max += Math.max(...f) + Math.max(...m);
    }
    return { min, max };
  };
  const traitRanges = Object.fromEntries((['orange', 'cream', 'contrast', 'brightness', 'flank', 'harlequin'] as const).map(feature => {
    const b = sumBounds(feature);
    for (const shared of POLY_CONFIG.shared.filter(s => s.to === feature)) {
      const s = sumBounds(shared.from); b.min += shared.weight * (shared.weight < 0 ? s.max : s.min); b.max += shared.weight * (shared.weight < 0 ? s.min : s.max);
    }
    const score = (effect: number) => 1 / (1 + Math.exp(-(POLY_CONFIG.intercept[feature] + POLY_CONFIG.additiveScale * effect / Math.sqrt(12))));
    return [feature, { minimum: score(b.min), maximum: score(b.max) }];
  })) as Record<'orange' | 'cream' | 'contrast' | 'brightness' | 'flank' | 'harlequin', { minimum: number; maximum: number }>;
  return { pin: previous.pin, viableProbability: previous.viableProbability, traitRanges, targetProbability: null,
    target: 'Clear visible tricolor plus both full pin rails, evaluated after rendering; not a Mendelian morph probability.' };
}
