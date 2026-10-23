import { createCompanionTricolorFounder, createCompanionTricolorOffspring, importCompanionTricolorWorkspace, COMPANION_TRICOLOR_PRESETS, forecastTricolor, type CompanionTricolorPresetId } from './companion-tricolor-breeding';
import { COMPANION_PATTERNS_RENDERER_ID, patternGeneGroup } from './companion-patterns';
import { emptyWorkspace } from './workspace';
import { validateGenome, type FounderInput } from './individual';
import { seededRandom, POLY_CONFIG, type Feature, type Genome } from './genetics';
import type { ForgeGecko } from './model';
import type { ColourPresetId } from './patternless-breeding';

const recipes = [
  { id: 'select-harlequin', name: '선별용 할리퀸', base: 'tricolor-pinstripe', flank: 3.25, harlequin: 2.9, dorsal: 1.8, width: 2.4, brindle: 2.4 },
  { id: 'extreme-harlequin', name: '익스트림 할리퀸', base: 'tricolor-pinstripe', flank: 4, harlequin: 3.9, dorsal: 2.6, width: 2.4, brindle: 2.4 },
  { id: 'tricolor-extreme', name: '트라이컬러 익스트림 할리퀸', base: 'tricolor-pinstripe', flank: 4, harlequin: 3.9, dorsal: 2.6, width: 3, brindle: 3 },
  { id: 'tiger', name: '타이거', base: 'flame', flank: .8, harlequin: .5, dorsal: 4, width: 3, brindle: .8 },
  { id: 'brindle', name: '브린들', base: 'flame', flank: .8, harlequin: .5, dorsal: 4, width: 3, brindle: 4 },
  { id: 'tiger-dalmatian', name: '타이거 달마시안', base: 'dalmatian', flank: .8, harlequin: .5, dorsal: 4, width: 3, brindle: .8 },
  { id: 'brindle-axanthic', name: '아잔틱 브린들', base: 'axanthic', flank: .8, harlequin: .5, dorsal: 4, width: 3, brindle: 4 },
] as const;
export const COMPANION_PATTERNS_PRESETS = [...recipes.map(r => ({ ...r, colour: 'brown' as const })), ...COMPANION_TRICOLOR_PRESETS] as const;
export type CompanionPatternsPresetId = typeof COMPANION_PATTERNS_PRESETS[number]['id'];
/** Founder/editor helper only. Offspring always use the unchanged core. */
function pairsForMean(mean: number, copies: number) {
  const total = Math.round(mean * copies), low = Math.floor(total / copies), extra = total % copies;
  const pairs: [number, number][] = Array.from({ length: copies / 2 }, () => [low, low]);
  if (!extra && low > 0 && low < 4) pairs.forEach(p => { p[0] = low - 1; p[1] = low + 1; });
  else for (let n = 0; n < extra; n++) pairs[n % pairs.length][n < pairs.length ? 1 : 0] = low + 1;
  return pairs;
}
function setFounderFeature(g: ForgeGecko, f: Feature, mean: number) {
  const pairs = pairsForMean(mean, 12), order = [0, 1, 2, 3, 4, 5], rng = seededRandom(g.creationSeed, `companion:patterns-founder:${f}:1`);
  for (let i = 5; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  pairs.forEach((p, n) => { g.genome.polygenic.loci[`${f}-${order[n]}`] = p; });
}
export function editPatternGeneGroup(genome: Genome, group: 'width' | 'brindle', mean: number): Genome {
  validateGenome(genome);
  if (!['width', 'brindle'].includes(group) || !Number.isFinite(mean) || mean < 0 || mean > 4) throw Error('줄무늬 형질은 0~4여야 합니다.');
  const result = structuredClone(genome), start = group === 'width' ? 0 : 3;
  pairsForMean(mean, 6).forEach((p, n) => { result.polygenic.loci[`contrast-${n + start}`] = p; }); return result;
}
export function createCompanionPatternsFounder(input: Omit<FounderInput, 'mendelian'> & { morph: CompanionPatternsPresetId; colour?: ColourPresetId }) {
  const r = recipes.find(r => r.id === input.morph);
  const g = createCompanionTricolorFounder({ ...input, morph: (r?.base ?? input.morph) as CompanionTricolorPresetId, colour: input.colour ?? (r ? 'brown' : undefined) });
  if (r) {
    for (const f of ['flank', 'harlequin', 'dorsal'] as const) setFounderFeature(g, f, r[f]);
    g.genome = editPatternGeneGroup(editPatternGeneGroup(g.genome, 'width', r.width), 'brindle', r.brindle);
    if (r.id === 'extreme-harlequin') { setFounderFeature(g, 'orange', .4); setFounderFeature(g, 'cream', 3.7); }
    if (r.id === 'tricolor-extreme') { setFounderFeature(g, 'cream', 2.9); setFounderFeature(g, 'brightness', .8); }
  }
  return g;
}
export const createCompanionPatternsOffspring = createCompanionTricolorOffspring;
export function emptyCompanionPatternsWorkspace() {
  const b = emptyWorkspace(COMPANION_PATTERNS_RENDERER_ID); b.settings.showB = false; b.offspringCount = 6; b.breedingSeed = 'patterns-cross-1'; return b;
}
export function starterCompanionPatternsWorkspace() {
  const b = emptyCompanionPatternsWorkspace();
  const starts = [
    ['단풍', 'male', 'select-harlequin'], ['우유', 'female', 'select-harlequin'],
    ['구름', 'male', 'extreme-harlequin'], ['삼색', 'female', 'tricolor-extreme'],
    ['호박', 'male', 'tiger'], ['나뭇결', 'female', 'brindle'],
    ['후추', 'male', 'tiger-dalmatian'], ['은빛', 'female', 'brindle-axanthic'],
  ] as const;
  b.individuals = starts.map(([name, sex, morph], n) => createCompanionPatternsFounder({ id: `C-000${n + 1}`, name, sex, morph, seed: `patterns-founder-${n + 1}` }));
  setFounderFeature(b.individuals[1], 'pinstripe', 44 / 12);
  b.nextId = 9; b.selectedId = b.fatherId = 'C-0001'; b.motherId = 'C-0002'; return b;
}
export function importCompanionPatternsWorkspace(json: string) {
  const b = importCompanionTricolorWorkspace(json); b.rendererVersion = COMPANION_PATTERNS_RENDERER_ID; return b;
}
export function forecastPatterns(father: ForgeGecko, mother: ForgeGecko) {
  const old = forecastTricolor(father, mother), effects = POLY_CONFIG.alleleEffects;
  const stripeGroups = Object.fromEntries((['width', 'brindle'] as const).map(group => {
    const start = group === 'width' ? 0 : 3;
    const bounds = (choose: (...values: number[]) => number) => {
      let sum = 0;
      for (let n = 0; n < 3; n++) for (const g of [father, mother]) sum += choose(...g.genome.polygenic.loci[`contrast-${start + n}`].map(a => effects[a]));
      return 1 / (1 + Math.exp(-sum * 1.3 / Math.sqrt(6)));
    };
    return [group, { minimum: bounds(Math.min), maximum: bounds(Math.max), father: patternGeneGroup(father.genome, group).score, mother: patternGeneGroup(mother.genome, group).score }];
  })) as Record<'width' | 'brindle', { minimum: number; maximum: number; father: number; mother: number }>;
  return { ...old, stripeGroups, targetProbability: null, target: 'Visible Extreme, Tricolor Extreme, Tiger or Brindle are recomputed from inherited traits and rendered native pixels.' };
}
