import { B_ORIGIN_01 as source } from './art/b-origin-01';
import { renderCompanionBase } from './companion-base';
import { renderCompanionFlame } from './companion-flame';
import { renderCompanionCappuccino, companionCappuccinoParameters, describeCompanionCappuccino, createCompanionCappuccinoRenderer, type CompanionCappuccinoParameters } from './companion-cappuccino';
import { patternlessColour, patternlessTones, type Rgb } from './patternless';
import type { AppearanceRenderer, RenderInput } from './model';
import type { SpriteLayer } from '@/engine/model';

export const COMPANION_TRICOLOR_RENDERER_ID = 'b-origin-01-companion-tricolor-1' as const;
export const COMPANION_TRICOLOR_MODEL = {
  version: 1, creamGrowthScale: .8,
  thresholds: { lateralPattern: .5, body: .1, orange: .12, cream: .1, colourDistance: 38, orangeChroma: 42, clearQuality: 70 },
  quality: { clarityWeight: .6, balanceWeight: .4, clarityBaseline: 30, clarityRange: 190, chromaTarget: 120 },
  inheritance: 'Existing orange/red, brightness/contrast, cream, flank/harlequin and pinstripe scores; no new locus or Mendelian tricolor allele.',
  shape: 'One reference-rooted harlequin growth field. Cream occupies an earlier stage inside the orange field; both remain large ventrally rooted patches.',
  limits: 'Game material and selection criteria, not a causal gene, market grade, or measured breeder standard.',
} as const;
export interface CompanionTricolorParameters extends CompanionCappuccinoParameters {
  orangeColor: Rgb;
  /** Orange material expression; zero preserves the previous renderer exactly. */
  tricolorStrength: number;
  /** Relative advance of cream inside the same rooted pattern field. */
  creamCoverage: number;
}
export const DEFAULT_TRICOLOR_PARAMETERS: Readonly<CompanionTricolorParameters> = {
  bodyColor: [91, 57, 39], detailColor: [255, 232, 194], orangeColor: [228, 126, 50],
  flameStrength: .9, legPatternStrength: .9, patternSeed: 42,
  lilly: false, veilStrength: .6, axanthic: false, pigmentSuppression: 1, skinBrightness: .25,
  spotDensity: 0, spotSize: .5, spotSeed: 42, pinStrength: 0, pinSeed: 42,
  cappuccinoCopies: 0, cappuccinoExpression: .75, dorsalRetention: .2, pinSpread: .55, tailRootLength: .18,
  tricolorStrength: 1, creamCoverage: .7,
};
export const TRICOLOR_COMPARISON = [
  { id: 'bicolor', name: '두 색 할리퀸', tricolorStrength: 0, pinStrength: 0 },
  { id: 'tricolor', name: '트라이컬러', tricolorStrength: 1, pinStrength: 0 },
  { id: 'full-pin', name: '트라이컬러 풀 핀', tricolorStrength: 1, pinStrength: 1 },
] as const;
export const TRICOLOR_LABELS = { bicolor: '두 색 계열', developing: '삼색 발현 중', tricolor: '트라이컬러', suppressed: '색소 억제', super: '슈퍼폼 별도 기록' } as const;
const N = 96 * 96;
const roles = renderCompanionBase().materialMask;
const side = (i: number) => source.labels[i] === 3 || source.labels[i] === 4;
const sideDomain = source.foreground.flatMap((v, i) => v && side(i) && !source.protection[i] && ![1, 2, 3, 5].includes(roles[i]) ? [i] : []);
const tone = (i: number) => source.shading[i] === 1 ? 'highlight' : source.shading[i] === 3 ? 'shadow' : 'base';
const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, c) => Math.round(v + (b[c] - v) * t)) as unknown as Rgb;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const distance = (a: Rgb, b: Rgb) => Math.sqrt(a.reduce((s, v, c) => s + (v - b[c]) ** 2, 0));
const hex = (c: Rgb) => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
function unit(v: number) { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) throw Error('삼색 발현과 크림 면적은 0~1이어야 합니다.'); }

export function renderCompanionTricolor(parameters: CompanionTricolorParameters) {
  unit(parameters.tricolorStrength); unit(parameters.creamCoverage); patternlessTones(parameters.orangeColor);
  const under = renderCompanionCappuccino(parameters), pixels = under.sprite.pixels.slice();
  const orangeMask = new Uint8Array(N), creamMask = new Uint8Array(N), materialMask = new Uint8Array(N), visibleMaterials = new Uint8Array(N);
  const albedo = new Uint8ClampedArray(N * 4), layer: SpriteLayer = { name: 'details', mask: new Uint8Array(N), pixels: new Uint8ClampedArray(N * 4) };
  const active = parameters.tricolorStrength > 0 && parameters.cappuccinoCopies !== 2;
  const creamPlan = active ? renderCompanionFlame({ ...parameters, flameStrength: parameters.flameStrength * parameters.creamCoverage * COMPANION_TRICOLOR_MODEL.creamGrowthScale }) : undefined;
  const suppression = under.pigment.suppression, cream = under.pigment.pattern.resolved;
  // Warm orange and the pale reflective cream are distinct materials. Axanthic
  // suppresses orange chroma but preserves its darker substrate and the shape.
  const neutralOrange = mix(under.pigment.skin.neutral, under.pigment.pattern.neutral, .48);
  const warmOrange = parameters.cappuccinoCopies === 1 ? mix(parameters.orangeColor, under.pigment.skin.resolved, .12 * parameters.cappuccinoExpression) : parameters.orangeColor;
  const orange = mix(cream, mix(warmOrange, neutralOrange, suppression), parameters.tricolorStrength);
  const litOrange = patternlessTones(orange), litCream = patternlessTones(cream), litWhite = patternlessTones(under.pigment.white);
  if (active) source.foreground.forEach((v, i) => {
    if (!v || source.protection[i]) return;
    let rgb: Rgb | undefined;
    if (under.patternMask[i]) {
      if (creamPlan!.patternMask[i]) { rgb = cream; creamMask[i] = 255; materialMask[i] = 3; }
      else { rgb = orange; orangeMask[i] = 255; materialMask[i] = 2; }
    } else if (source.labels[i] === 2) {
      rgb = parameters.cappuccinoCopies === 1 ? mix(under.pigment.skin.resolved, orange, parameters.dorsalRetention) : orange;
      orangeMask[i] = 255; materialMask[i] = 2;
    } else if (!parameters.cappuccinoCopies && roles[i] === 6) {
      rgb = mix(under.pigment.skin.resolved, orange, .76); orangeMask[i] = 255; materialMask[i] = 2;
    }
    if (!rgb) return;
    albedo.set([...rgb, 255], i * 4);
    // Previous white, pins, widened pins and complete spot shapes stay above
    // the new materials. The immutable source planes are applied exactly once.
    if (under.whiteMask[i] || under.pinMask[i] || under.pinSpreadMask[i] || under.spotMask[i]) return;
    let lit = rgb === orange ? litOrange[tone(i)] : rgb === cream ? litCream[tone(i)] : patternlessTones(rgb)[tone(i)];
    if (parameters.lilly) lit = mix(lit, litWhite[tone(i)], parameters.veilStrength);
    pixels.set([...lit, pixels[i * 4 + 3]], i * 4); layer.mask[i] = 255; layer.pixels.set(pixels.slice(i * 4, i * 4 + 4), i * 4);
  });
  const counts = [0, 0, 0, 0], sums = Array.from({ length: 4 }, () => [0, 0, 0]);
  for (const i of sideDomain) {
    if (under.whiteMask[i] || under.spotMask[i]) continue;
    const role = active ? materialMask[i] || 1 : under.patternMask[i] ? 3 : 1;
    visibleMaterials[i] = role; counts[role]++;
    for (let c = 0; c < 3; c++) sums[role][c] += pixels[i * 4 + c];
  }
  const means = sums.map((s, n) => s.map(v => counts[n] ? Math.round(v / counts[n]) : 0) as unknown as Rgb);
  const ratios = { body: counts[1] / sideDomain.length, orange: counts[2] / sideDomain.length, cream: counts[3] / sideDomain.length };
  const minDistance = Math.min(distance(means[1], means[2]), distance(means[2], means[3]), distance(means[1], means[3]));
  const orangeChroma = Math.max(...means[2]) - Math.min(...means[2]);
  const q = COMPANION_TRICOLOR_MODEL.quality;
  const clarity = counts.slice(1).every(Boolean) ? clamp((minDistance - q.clarityBaseline) / q.clarityRange) : 0;
  const balance = Math.min(1, ratios.body / .25, ratios.orange / .22, ratios.cream / .22);
  const quality = Math.round(100 * (q.clarityWeight * clarity + q.balanceWeight * balance) * clamp(orangeChroma / q.chromaTarget));
  const t = COMPANION_TRICOLOR_MODEL.thresholds;
  const qualified = active && under.metrics.lateralCoverage >= t.lateralPattern && ratios.body >= t.body && ratios.orange >= t.orange && ratios.cream >= t.cream && minDistance >= t.colourDistance && orangeChroma >= t.orangeChroma;
  const classification: keyof typeof TRICOLOR_LABELS = parameters.cappuccinoCopies === 2 ? 'super' : parameters.axanthic && suppression > .8 ? 'suppressed' : qualified ? 'tricolor' : !active ? 'bicolor' : 'developing';
  const tricolorMetrics = { classification, quality, clear: qualified && quality >= t.clearQuality, lateralPixels: sideDomain.length,
    bodyPixels: counts[1], orangePixels: counts[2], creamPixels: counts[3], otherPixels: sideDomain.length - counts.slice(1).reduce((s, n) => s + n, 0),
    ratios, minimumColourDistance: minDistance, orangeChroma, clarity, balance, meanColours: { body: means[1], orange: means[2], cream: means[3] } };
  return { ...under, sprite: { ...under.sprite, version: COMPANION_TRICOLOR_RENDERER_ID, pixels, layers: active ? [...under.sprite.layers, layer] : under.sprite.layers },
    orangeMask, creamMask, tricolorMaterialMask: materialMask, visibleTricolorMaterials: visibleMaterials, tricolorPaintMask: layer.mask, tricolorAlbedo: albedo,
    tricolorMetrics, tricolorPalette: { body: under.pigment.skin.resolved, orange, cream } };
}

export function companionTricolorParameters(input: RenderInput, veilOverride?: number): CompanionTricolorParameters {
  const p = companionCappuccinoParameters(input, veilOverride), s = input.phenotype.inheritedScores;
  const skin = patternlessColour({ ...s, cream: 0, brightness: .12 + .5 * s.brightness }, input.fire).base;
  const bodyColor = mix(skin, [56, 38, 32], .2 + .34 * s.contrast);
  return { ...p, bodyColor, detailColor: mix([255, 218, 164], [255, 244, 218], s.cream),
    orangeColor: mix([213, 157, 67], [237, 109, 46], clamp(.16 + .6 * s.orange + .34 * s.red)),
    tricolorStrength: clamp((s.orange - .15) / .7), creamCoverage: clamp((s.cream - .1) / .72) };
}
export function describeCompanionTricolor(input: RenderInput, veilOverride?: number) {
  const previous = describeCompanionCappuccino(input, veilOverride), parameters = companionTricolorParameters(input, veilOverride), result = renderCompanionTricolor(parameters);
  const m = result.tricolorMetrics, failed = input.phenotype.observed['lilly-white'] === 'Lilly 동형접합 비생존';
  const name = failed ? previous.name : parameters.cappuccinoCopies === 2 ? previous.name : [
    ...(parameters.cappuccinoCopies === 1 ? [parameters.lilly ? '프라푸치노' : '카푸치노'] : parameters.lilly ? ['릴리화이트'] : []),
    ...(parameters.axanthic ? ['아잔틱'] : []), TRICOLOR_LABELS[m.classification],
    ...(result.spotMetrics.count ? ['달마시안'] : []), result.pinMetrics.classification === 'full' ? '풀 핀' : result.pinMetrics.classification === 'near-full' ? '니어 풀 핀' : result.pinMetrics.classification === 'none' ? '핀 없음' : '부분 핀',
  ].join(' · ');
  return { ...previous, name, parameters, base: result.pigment.skin.resolved, hex: hex(result.pigment.skin.resolved),
    tricolorMetrics: m, tricolorPalette: result.tricolorPalette, pinMetrics: result.pinMetrics };
}
export function createCompanionTricolorRenderer(veilOverride?: number): AppearanceRenderer {
  createCompanionCappuccinoRenderer(veilOverride);
  return { id: veilOverride === undefined ? COMPANION_TRICOLOR_RENDERER_ID : `${COMPANION_TRICOLOR_RENDERER_ID}:veil:${veilOverride}`,
    render: input => renderCompanionTricolor(companionTricolorParameters(input, veilOverride)).sprite };
}
export const companionTricolorRenderer = createCompanionTricolorRenderer();
