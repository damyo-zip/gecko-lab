import { B_ORIGIN_01 as source } from './art/b-origin-01';
import { renderCompanionBase } from './companion-base';
import { renderCompanionTricolor, companionTricolorParameters, createCompanionTricolorRenderer, DEFAULT_TRICOLOR_PARAMETERS, COMPANION_TRICOLOR_MODEL, TRICOLOR_LABELS, type CompanionTricolorParameters } from './companion-tricolor';
import { DALMATIAN_FORELEG_REFINEMENT } from './companion-dalmatian-v3';
import { patternlessColour, patternlessTones, type Rgb } from './patternless';
import { POLY_CONFIG, seededRandom, type Genome } from './genetics';
import { validateGenome } from './individual';
import type { AppearanceRenderer, RenderInput } from './model';
import type { SpriteLayer } from '@/engine/model';

export const COMPANION_PATTERNS_RENDERER_ID = 'b-origin-01-companion-patterns-1' as const;
export const COMPANION_PATTERNS_MODEL = {
  version: 1,
  extreme: { lateral: .65, upper: .60, legs: .32 },
  stripe: { bars: 6, firstColumn: 37, spacing: 7.7, minimumBars: 3, minimumRows: 5, minimumContrast: 26, minimumMeanContrast: 55, brindleStrength: .55, fragmentation: .12 },
  minimumVisibleContrast: 26,
  inheritance: 'Existing flank/harlequin for expansion; dorsal for stripes; contrast 0..2 for width and 3..5 for branching; no new loci or Mendelian morph names.',
  limits: 'Shared native sprite, observed material areas and game selection thresholds. Legacy renderers remain reproducible; these are not breeder grading standards.',
} as const;
export interface CompanionPatternsParameters extends CompanionTricolorParameters {
  extremeStrength: number;
  stripeStrength: number;
  brindleStrength: number;
  stripeWidth: number;
  stripeSeed: number;
  stripeBodyColor: Rgb;
  stripeColor: Rgb;
}
export const DEFAULT_PATTERNS_PARAMETERS: Readonly<CompanionPatternsParameters> = {
  ...DEFAULT_TRICOLOR_PARAMETERS, pinStrength: .65,
  extremeStrength: 0, stripeStrength: 0, brindleStrength: 0, stripeWidth: .8, stripeSeed: 42,
  stripeBodyColor: [216, 157, 75], stripeColor: [75, 41, 25],
};
export const EXPANSION_COMPARISON = [
  { id: 'harlequin', name: '할리퀸', extremeStrength: 0, tricolorStrength: 0 },
  { id: 'extreme', name: '익스트림 할리퀸', extremeStrength: 1, tricolorStrength: 0 },
  { id: 'tricolor-extreme', name: '트익할', extremeStrength: 1, tricolorStrength: 1 },
] as const;
export const STRIPE_COMPARISON = [
  { id: 'tiger', name: '타이거', brindleStrength: 0 },
  { id: 'intermediate', name: '줄무늬 중간형', brindleStrength: .5 },
  { id: 'brindle', name: '브린들', brindleStrength: 1 },
] as const;
export const PATTERN_LABELS = { patternless: '패턴리스', flame: '플레임', 'high-flame': '하이 플레임', harlequin: '할리퀸', extreme: '익스트림 할리퀸', 'tricolor-harlequin': '트라이컬러 할리퀸', 'tricolor-extreme': '트라이컬러 익스트림 할리퀸', tiger: '타이거', brindle: '브린들', super: '슈퍼폼 별도 기록' } as const;
const N = 9216, roles = renderCompanionBase().materialMask;
const side = (i: number) => source.labels[i] === 3 || source.labels[i] === 4;
const leg = (i: number) => source.labels[i] === 5 || source.labels[i] === 6;
const neighbours = (i: number) => [i % 96 ? i - 1 : -1, i % 96 < 95 ? i + 1 : -1, i - 96, i + 96].filter(j => j >= 0 && j < N);
const foreleg = new Uint8Array(N);
for (const [y, x, n] of DALMATIAN_FORELEG_REFINEMENT.runs) foreleg.fill(255, y * 96 + x, y * 96 + x + n);
const eligible = (i: number) => !!source.foreground[i] && !source.protection[i] && ![1, 2, 3, 5].includes(roles[i]) && !foreleg[i];
const sidePixels = source.labels.flatMap((_, i) => side(i) && eligible(i) ? [i] : []);
const upperPixels = sidePixels.filter(i => source.labels[i] === 3);
const legPixels = source.labels.flatMap((_, i) => leg(i) && eligible(i) ? [i] : []);
const columns = Array.from({ length: 96 }, (_, x) => {
  const ys = source.labels.flatMap((_, i) => i % 96 === x && side(i) ? [Math.floor(i / 96)] : []);
  return ys.length ? { top: Math.min(...ys), bottom: Math.max(...ys), height: Math.max(...ys) - Math.min(...ys) + 1 } : null;
});
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, c) => Math.round(v + (b[c] - v) * t)) as unknown as Rgb;
const rgbAt = (p: Uint8ClampedArray, i: number) => Array.from(p.slice(i * 4, i * 4 + 3)) as unknown as Rgb;
const distance = (a: Rgb, b: Rgb) => Math.sqrt(a.reduce((s, v, c) => s + (v - b[c]) ** 2, 0));
const tone = (i: number) => source.shading[i] === 1 ? 'highlight' : source.shading[i] === 3 ? 'shadow' : 'base';
function unit(v: number) { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) throw Error('무늬 발현 설정은 0~1이어야 합니다.'); }
function field(domain: (i: number) => boolean, starts: number[]) {
  const d = new Int16Array(N).fill(-1), q = [...starts]; starts.forEach(i => { d[i] = 0; });
  for (let n = 0; n < q.length; n++) for (const j of neighbours(q[n])) if (domain(j) && d[j] < 0) { d[j] = d[q[n]] + 1; q.push(j); }
  return d;
}
const legBodyDistance = field(leg, source.labels.flatMap((_, i) => leg(i) && neighbours(i).some(j => [1, 3, 4].includes(source.labels[j])) ? [i] : []));
const legEdgeDistance = field(leg, source.labels.flatMap((_, i) => leg(i) && neighbours(i).some(j => !source.foreground[j]) ? [i] : []));

/** Extend the same rooted patches upward and onto broad outer limb planes. */
export function expandCompanionPattern(mask: Uint8Array, strength: number) {
  unit(strength); const result = mask.slice(); if (!strength || !sidePixels.some(i => mask[i])) return result;
  const front = new Int16Array(96).fill(96);
  sidePixels.forEach(i => { if (mask[i]) front[i % 96] = Math.min(front[i % 96], Math.floor(i / 96)); });
  for (const i of sidePixels) {
    const x = i % 96, y = Math.floor(i / 96), c = columns[x]!;
    if (front[x] === 96 || y >= front[x] || y < c.top + 1) continue;
    const rise = (c.bottom - front[x]) / c.height, reach = .8 + 2.5 * rise;
    if ((front[x] - y) / reach <= strength) result[i] = 255;
  }
  for (const i of legPixels) if (legBodyDistance[i] >= 0 && legBodyDistance[i] <= 2 + 21 * strength && legEdgeDistance[i] <= 1 + 2 * strength) result[i] = 255;
  return result;
}

export function buildCompanionStripes(p: Pick<CompanionPatternsParameters, 'stripeStrength' | 'brindleStrength' | 'stripeWidth' | 'stripeSeed'>) {
  for (const v of [p.stripeStrength, p.brindleStrength, p.stripeWidth]) unit(v);
  if (!Number.isInteger(p.stripeSeed) || p.stripeSeed < 0 || p.stripeSeed > 0xffffffff) throw Error('줄무늬 시드는 uint32 정수여야 합니다.');
  const mask = new Uint8Array(N), owners = new Uint8Array(N); if (!p.stripeStrength) return { mask, owners };
  const rng = seededRandom(String(p.stripeSeed), 'companion:organic-stripes:1');
  const bars = Array.from({ length: 6 }, (_, n) => ({ center: 37 + n * 7.7 + (rng() - .5) * 1.7, phase: rng() * Math.PI * 2, lean: (rng() - .5) * 3 }));
  source.foreground.forEach((v, i) => {
    const x = i % 96, y = Math.floor(i / 96), c = columns[x];
    if (!v || !eligible(i) || ![2, 3, 4].includes(source.labels[i]) || !c || x < 34 || x > 81) return;
    const height = source.labels[i] === 2 ? -.2 : (y - c.top) / Math.max(1, c.height - 1);
    for (const [n, b] of bars.entries()) {
      const barColumn = columns[Math.round(b.center)] ?? c;
      const barHeight = source.labels[i] === 2 ? -.2 : (y - barColumn.top) / Math.max(1, barColumn.height - 1);
      const center = b.center + b.lean * (height - .5) + Math.sin(height * 5 + b.phase) * (.35 + .7 * p.brindleStrength);
      const width = (.85 + .85 * p.stripeWidth) * (.45 + .55 * p.stripeStrength) * (1 - .25 * p.brindleStrength);
      const gap = height > .05 && Math.sin(barHeight * 10 + b.phase + n * 1.7) > 1.12 - .58 * p.brindleStrength;
      const fork = height > .15 && height < .9 ? Math.sin((height - .15) / .75 * Math.PI) * 3 * p.brindleStrength : 0;
      if (!gap && (Math.abs(x - center) <= width || fork > .9 && Math.abs(x - center - fork) <= width * .65)) { mask[i] = 255; owners[i] = n + 1; break; }
    }
  });
  // Native fragments must read as short stripes, not isolated speckles.
  const seen = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (mask[i] && !seen[i]) {
    const q = [i]; seen[i] = 1;
    for (let n = 0; n < q.length; n++) for (const j of neighbours(q[n])) if (mask[j] && !seen[j]) { seen[j] = 1; q.push(j); }
    if (q.length < 3) q.forEach(j => { mask[j] = owners[j] = 0; });
  }
  return { mask, owners };
}

export interface CompanionPatternObservation {
  lateralCoverage: number; upperCoverage: number; legCoverage: number;
  stripeClass: 'none' | 'tiger' | 'brindle'; clearTricolor: boolean; superForm: boolean;
}
/** All four names use the same observed native sprite and denominators. */
export function classifyCompanionPatterns(o: CompanionPatternObservation) {
  const t = COMPANION_PATTERNS_MODEL.extreme;
  const extreme = !o.superForm && o.lateralCoverage >= t.lateral && o.upperCoverage >= t.upper && o.legCoverage >= t.legs;
  const tricolor = !o.superForm && o.clearTricolor;
  const classification: keyof typeof PATTERN_LABELS = o.superForm ? 'super' : o.stripeClass !== 'none' ? o.stripeClass : extreme ? tricolor ? 'tricolor-extreme' : 'extreme' : tricolor ? 'tricolor-harlequin' : o.lateralCoverage >= .5 ? 'harlequin' : o.lateralCoverage >= .3 ? 'high-flame' : o.lateralCoverage > 0 ? 'flame' : 'patternless';
  return { classification, extreme, tricolor, tricolorExtreme: extreme && tricolor };
}

export function measureCompanionPatternTricolor(pixels: Uint8ClampedArray, materials: Uint8Array, p: CompanionPatternsParameters, coverage: number) {
  const counts = [0, 0, 0, 0], sums = Array.from({ length: 4 }, () => [0, 0, 0]);
  for (const i of sidePixels) { const r = materials[i]; if (r < 1 || r > 3) continue; counts[r]++; for (let c = 0; c < 3; c++) sums[r][c] += pixels[i * 4 + c]; }
  const means = sums.map((s, n) => s.map(v => counts[n] ? Math.round(v / counts[n]) : 0) as unknown as Rgb);
  const ratios = { body: counts[1] / sidePixels.length, orange: counts[2] / sidePixels.length, cream: counts[3] / sidePixels.length };
  const minimumColourDistance = Math.min(distance(means[1], means[2]), distance(means[2], means[3]), distance(means[1], means[3]));
  const orangeChroma = Math.max(...means[2]) - Math.min(...means[2]), q = COMPANION_TRICOLOR_MODEL.quality, t = COMPANION_TRICOLOR_MODEL.thresholds;
  const clarity = counts.slice(1).every(Boolean) ? clamp((minimumColourDistance - q.clarityBaseline) / q.clarityRange) : 0;
  const balance = Math.min(1, ratios.body / .25, ratios.orange / .22, ratios.cream / .22);
  const quality = Math.round(100 * (q.clarityWeight * clarity + q.balanceWeight * balance) * clamp(orangeChroma / q.chromaTarget));
  const qualified = coverage >= .5 && ratios.body >= t.body && ratios.orange >= t.orange && ratios.cream >= t.cream && minimumColourDistance >= t.colourDistance && orangeChroma >= t.orangeChroma;
  const classification: keyof typeof TRICOLOR_LABELS = p.cappuccinoCopies === 2 ? 'super' : p.axanthic && p.pigmentSuppression > .8 ? 'suppressed' : qualified ? 'tricolor' : !p.tricolorStrength ? 'bicolor' : 'developing';
  return { classification, quality, clear: qualified && quality >= t.clearQuality && p.cappuccinoCopies !== 2,
    lateralPixels: sidePixels.length, bodyPixels: counts[1], orangePixels: counts[2], creamPixels: counts[3], otherPixels: sidePixels.length - counts.slice(1).reduce((s, n) => s + n, 0), ratios,
    minimumColourDistance, orangeChroma, clarity, balance, meanColours: { body: means[1], orange: means[2], cream: means[3] } };
}

export function renderCompanionPatterns(p: CompanionPatternsParameters, stripeBuilder: typeof buildCompanionStripes = buildCompanionStripes, stripeAppearance?: { dorsalSkinBlend: number; retainCappuccinoTail: boolean; includeDorsalInTracks: boolean }) {
  for (const v of [p.extremeStrength, p.stripeStrength, p.brindleStrength, p.stripeWidth]) unit(v);
  patternlessTones(p.stripeBodyColor); patternlessTones(p.stripeColor);
  if (stripeAppearance) unit(stripeAppearance.dorsalSkinBlend);
  const superForm = p.cappuccinoCopies === 2, stripeStrength = superForm ? 0 : p.stripeStrength;
  const working = { ...p, bodyColor: mix(p.bodyColor, p.stripeBodyColor, stripeStrength), flameStrength: p.flameStrength * (1 - .9 * stripeStrength) };
  const under = renderCompanionTricolor(working);
  const expansion = superForm ? 0 : p.extremeStrength * (1 - p.stripeStrength);
  const patternMask = expandCompanionPattern(under.patternMask, expansion);
  const creamPlan = expandCompanionPattern(under.creamMask, expansion * p.creamCoverage);
  const creamMask = under.creamMask.slice(), orangeMask = under.orangeMask.slice(), materialMask = under.tricolorMaterialMask.slice();
  const stripes = stripeBuilder({ ...p, stripeStrength: superForm ? 0 : p.stripeStrength });
  const pixels = under.sprite.pixels.slice(), layer: SpriteLayer = { name: 'details', mask: new Uint8Array(N), pixels: new Uint8ClampedArray(N * 4) };
  const whiteMask = under.whiteMask.slice(), visiblePatternMask = new Uint8Array(N), visibleStripeMask = new Uint8Array(N), visibleMaterials = new Uint8Array(N), albedo = new Uint8ClampedArray(N * 4);
  const skin = under.pigment.skin.resolved, cream = under.pigment.pattern.resolved, orange = under.tricolorPalette.orange;
  const palettes = renderCompanionBase({ bodyColor: skin, detailColor: cream }).palette;
  const stripeColour = mix(p.stripeColor, [35, 36, 40], under.pigment.suppression);
  const lit = (rgb: Rgb, i: number) => { const t = tone(i), value = patternlessTones(rgb)[t]; return p.lilly ? mix(value, patternlessTones(under.pigment.white)[t], p.veilStrength) : value; };
  const rows = Array.from({ length: 6 }, () => new Set<number>()); let stripeContrast = 0, stripeN = 0;
  source.foreground.forEach((v, i) => {
    if (!v || !eligible(i)) return;
    let role = under.tricolorMaterialMask[i] || (under.patternMask[i] ? 3 : 1);
    let rgb: Rgb = role === 2 ? orange : role === 3 ? cream : roles[i] === 4 ? palettes.ventral_skin : roles[i] === 7 ? palettes.limb_top : skin;
    let changed = false;
    if (stripeAppearance && !p.cappuccinoCopies && source.labels[i] === 2 && stripeStrength) {
      rgb = mix(p.tricolorStrength ? orange : cream, mix(skin, cream, .12), stripeAppearance.dorsalSkinBlend * stripeStrength);
      changed = true;
    }
    if (patternMask[i] && !under.patternMask[i] && expansion) {
      role = !p.tricolorStrength || creamPlan[i] || p.creamCoverage > 0 && leg(i) && legBodyDistance[i] > 6 * (1 - p.creamCoverage) ? 3 : 2;
      rgb = role === 3 ? cream : orange; changed = true;
    }
    if (patternMask[i] && (role === 2 || role === 3)) {
      creamMask[i] = role === 3 ? 255 : 0; orangeMask[i] = role === 2 ? 255 : 0; materialMask[i] = role;
    }
    if (p.lilly && patternMask[i] && !under.patternMask[i]) whiteMask[i] = 255;
    if (whiteMask[i]) { rgb = under.pigment.white; role = 5; }
    const baseline = changed ? lit(rgb, i) : rgbAt(pixels, i);
    if (stripes.mask[i] && !(stripeAppearance?.retainCappuccinoTail && p.cappuccinoCopies && source.labels[i] === 7) && !whiteMask[i] && !under.pinMask[i] && !under.pinSpreadMask[i] && !under.spotMask[i]) {
      if (stripeAppearance && source.labels[i] === 7) rgb = palettes.tail_plane;
      rgb = mix(rgb, stripeColour, p.stripeStrength * (stripeAppearance && source.labels[i] === 7 ? .65 : 1)); role = 4; changed = true;
    }
    if (under.pinMask[i] || under.pinSpreadMask[i] || under.spotMask[i]) { role = 0; changed = false; }
    if (changed) {
      albedo.set([...rgb, 255], i * 4); const colour = lit(rgb, i); pixels.set([...colour, pixels[i * 4 + 3]], i * 4);
      layer.mask[i] = 255; layer.pixels.set(pixels.slice(i * 4, i * 4 + 4), i * 4);
    }
    const rgbFinal = rgbAt(pixels, i);
    if (side(i)) visibleMaterials[i] = role;
    if ((patternMask[i] || whiteMask[i]) && !under.spotMask[i] && !under.pinMask[i] && !under.pinSpreadMask[i] && distance(rgbFinal, lit(skin, i)) >= COMPANION_PATTERNS_MODEL.minimumVisibleContrast && role !== 4) visiblePatternMask[i] = 255;
    const d = distance(rgbFinal, baseline);
    if (stripes.mask[i] && role === 4 && d >= COMPANION_PATTERNS_MODEL.stripe.minimumContrast) {
      visibleStripeMask[i] = 255; stripeContrast += d; stripeN++;
      if ((side(i) || stripeAppearance?.includeDorsalInTracks && source.labels[i] === 2) && stripes.owners[i]) rows[stripes.owners[i] - 1].add(Math.floor(i / 96));
    }
  });
  const fraction = (indices: number[]) => indices.filter(i => visiblePatternMask[i]).length / indices.length;
  const lateralCoverage = fraction(sidePixels), upperCoverage = fraction(upperPixels), legCoverage = fraction(legPixels);
  const tracks = rows.map(set => {
    const ys = [...set].sort((a, b) => a - b); let longest = 0, run = 0, prior = -2;
    ys.forEach(y => { run = y === prior + 1 ? run + 1 : 1; prior = y; longest = Math.max(longest, run); });
    const span = ys.length ? ys.at(-1)! - ys[0] + 1 : 0;
    return { rows: ys.length, span, longest, gaps: span - ys.length };
  });
  const goodTracks = tracks.filter(t => t.rows >= 5), span = goodTracks.reduce((s, t) => s + t.span, 0);
  const fragmentation = span ? goodTracks.reduce((s, t) => s + t.gaps, 0) / span : 0;
  const stripeClass = goodTracks.length < 3 || !stripeN || stripeContrast / stripeN < COMPANION_PATTERNS_MODEL.stripe.minimumMeanContrast ? 'none' : p.brindleStrength >= .55 && fragmentation >= .12 ? 'brindle' : 'tiger';
  const tricolorMetrics = measureCompanionPatternTricolor(pixels, visibleMaterials, p, lateralCoverage);
  const observation = { lateralCoverage, upperCoverage, legCoverage, stripeClass, clearTricolor: tricolorMetrics.clear, superForm } as const;
  const classification = classifyCompanionPatterns(observation);
  const rises = columns.flatMap((c, x) => { if (!c) return []; const ys = sidePixels.filter(i => i % 96 === x && visiblePatternMask[i]).map(i => Math.floor(i / 96)); return [ys.length ? (c.bottom - Math.min(...ys) + 1) / c.height : 0]; });
  const patternMetrics = { ...observation, ...classification, maximumRise: Math.max(0, ...rises), meanRise: rises.reduce((s, v) => s + v, 0) / rises.length,
    lateralPixels: sidePixels.length, upperPixels: upperPixels.length, legPixels: legPixels.length,
    stripePixels: stripeN, stripeContrast: stripeN ? stripeContrast / stripeN : 0, tracks, fragmentation, stripeQuality: Math.round(100 * clamp((stripeN ? stripeContrast / stripeN : 0) / 150) * Math.min(1, goodTracks.length / 5)) };
  return { ...under, sprite: { ...under.sprite, version: COMPANION_PATTERNS_RENDERER_ID, pixels, layers: layer.mask.some(Boolean) ? [...under.sprite.layers, layer] : under.sprite.layers },
    patternMask, whiteMask, creamMask, orangeMask, tricolorMaterialMask: materialMask, visiblePatternMask, stripeMask: stripes.mask, visibleStripeMask, stripeOwners: stripes.owners,
    visibleTricolorMaterials: visibleMaterials, patternAlbedo: albedo, patternPaintMask: layer.mask, tricolorMetrics, patternMetrics };
}

export function patternGeneGroup(genome: Genome, group: 'width' | 'brindle') {
  validateGenome(genome); if (!['width', 'brindle'].includes(group)) throw Error('알 수 없는 줄무늬 형질입니다.');
  const start = group === 'width' ? 0 : 3, alleles = Array.from({ length: 3 }, (_, n) => genome.polygenic.loci[`contrast-${n + start}`]).flat();
  return { mean: alleles.reduce((s, a) => s + a, 0) / 6, score: 1 / (1 + Math.exp(-(alleles.reduce((s, a) => s + POLY_CONFIG.alleleEffects[a], 0) * 1.3 / Math.sqrt(6)))) };
}
export function companionPatternsParameters(input: RenderInput, veilOverride?: number): CompanionPatternsParameters {
  const p = companionTricolorParameters(input, veilOverride), s = input.phenotype.inheritedScores;
  const stripeStrength = clamp((s.dorsal - .52) / .38) * (1 - clamp((s.harlequin - .52) / .30));
  // Recover the two original contrast subsets from the additive total and the
  // core's second-half score, undoing its declared brightness shared effect.
  // This keeps RenderInput genome-free and does not add a new phenotype gene.
  const logit = (v: number) => Math.log(Math.max(.000001, v) / Math.max(.000001, 1 - v));
  const brightnessSum = (logit(s.brightness) - POLY_CONFIG.intercept.brightness) * Math.sqrt(12) / POLY_CONFIG.additiveScale;
  const shared = POLY_CONFIG.shared.find(v => v.to === 'contrast' && v.from === 'brightness')!.weight;
  const totalContrast = (logit(s.contrast) - POLY_CONFIG.intercept.contrast) * Math.sqrt(12) / POLY_CONFIG.additiveScale - shared * brightnessSum;
  const secondHalf = logit(input.phenotype.traits.brindle) * Math.sqrt(6) / 1.3;
  const width = 1 / (1 + Math.exp(-(totalContrast - secondHalf) * 1.3 / Math.sqrt(6)));
  const brindle = clamp((input.phenotype.traits.brindle - .60) / .32);
  const warm = patternlessColour({ ...s, cream: .05, brightness: .48 + .28 * s.brightness }, input.fire).base;
  return { ...p, extremeStrength: clamp((s.flank * .45 + s.harlequin * .55 - .62) / .28), stripeStrength,
    brindleStrength: brindle, stripeWidth: width, stripeSeed: Math.floor(seededRandom(input.seed, 'companion:pattern-stripes:1')() * 0x100000000),
    stripeBodyColor: mix(warm, [232, 169, 76], .25), stripeColor: mix([75, 41, 25], [40, 27, 22], s.contrast * .5) };
}
export function describeCompanionPatterns(input: RenderInput, veilOverride?: number, render: (p: CompanionPatternsParameters) => Omit<ReturnType<typeof renderCompanionPatterns>, 'sprite'> = renderCompanionPatterns) {
  const parameters = companionPatternsParameters(input, veilOverride), r = render(parameters), m = r.patternMetrics;
  const failed = input.phenotype.observed['lilly-white'] === 'Lilly 동형접합 비생존';
  const genes = parameters.cappuccinoCopies === 2 ? [parameters.lilly ? '설악' : '슈퍼 카푸치노'] : [...(parameters.cappuccinoCopies === 1 ? [parameters.lilly ? '프라푸치노' : '카푸치노'] : parameters.lilly ? ['릴리화이트'] : []), ...(parameters.axanthic ? ['아잔틱'] : [])];
  const name = failed ? '릴리 동형접합 비생존' : [...genes, PATTERN_LABELS[m.classification], ...(r.spotMetrics.count ? ['달마시안'] : []), r.pinMetrics.classification === 'full' && !m.superForm ? '풀 핀' : ''].filter(Boolean).join(' · ');
  const base = r.pigment.skin.resolved;
  return { name, parameters, base, hex: '#' + base.map(v => v.toString(16).padStart(2, '0')).join(''), superForm: m.superForm,
    morph: PATTERN_LABELS[m.classification], patternMetrics: m, tricolorMetrics: r.tricolorMetrics, tricolorPalette: r.tricolorPalette,
    pinMetrics: r.pinMetrics, veilMetrics: r.veilMetrics, pigment: r.pigment, metrics: r.metrics, whiteMetrics: r.whiteMetrics };
}
export function createCompanionPatternsRenderer(veilOverride?: number): AppearanceRenderer {
  createCompanionTricolorRenderer(veilOverride);
  return { id: veilOverride === undefined ? COMPANION_PATTERNS_RENDERER_ID : `${COMPANION_PATTERNS_RENDERER_ID}:veil:${veilOverride}`,
    render: input => renderCompanionPatterns(companionPatternsParameters(input, veilOverride)).sprite };
}
export const companionPatternsRenderer = createCompanionPatternsRenderer();
