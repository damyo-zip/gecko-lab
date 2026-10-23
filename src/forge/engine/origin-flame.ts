import { B_ORIGIN_01 } from './art/b-origin-01';
import { FLAME_REFERENCE } from './art/flame-reference';
import { HARLEQUIN_VARIANTS } from './flame-variants';
import { seededRandom } from './genetics';
import { patternlessTones, renderSolidPatternless, type Rgb } from './patternless';
import type { SpriteLayer, SpriteResult } from '@/engine/model';

export const FLAME_RENDERER_ID = 'b-origin-01-flame-4' as const;
export const FLAME_COLOURS = {
  orange: '#bf7030', brown: '#795533', red: '#a84835', yellow: '#c8a647', olive: '#747442', charcoal: '#414148',
  cream: '#ffe1ae', 'warm cream': '#f3cb94', 'yellow cream': '#f4df87', white: '#fff4e3', 'orange cream': '#edb77f',
} as const;
export interface FlameParameters {
  baseColor: string;
  patternColor: string;
  flameStrength: number;
  patternSeed: number;
  legPatternStrength: number;
  /** 0 = unmodified reference family; 1–20 = comparison recipes. */
  patternVariant?: number;
}
export interface FlameThresholds { highFlameCoverage: number; harlequinCoverage: number }
export type FlameClass = 'none' | 'flame' | 'high flame' | 'harlequin';
export const DEFAULT_FLAME_PARAMETERS: Readonly<FlameParameters> = { baseColor: 'orange', patternColor: 'cream', flameStrength: .6, patternSeed: 42, legPatternStrength: .45, patternVariant: 0 };
export const DEFAULT_FLAME_THRESHOLDS: Readonly<FlameThresholds> = { highFlameCoverage: .3, harlequinCoverage: .5 };
export const FLAME_GROWTH_MODEL = {
  version: 4, direction: 'ventral-to-dorsal', roots: 'LATERAL_LOWER ventral edge',
  dorsalColor: 'patternColor', dorsalIndependentOfStrength: true,
  bodyRegions: [3, 4], auxiliaryRegions: [5, 6, 7], rearLegScale: .55,
  referenceGuideId: FLAME_REFERENCE.id, referenceSeed: FLAME_REFERENCE.referenceSeed,
  referenceStrength: FLAME_REFERENCE.anchorStrength, insideExponent: .5, outsideStep: .14,
  outerLegBand: 1, tailRootReach: 4, highFlameCoverage: .3, harlequinCoverage: .5,
  denominator: 'all LATERAL_UPPER + LATERAL_LOWER pixels, including protected pixels',
} as const;
const W = 96, N = W * W, labels = B_ORIGIN_01.labels;
const side = (i: number) => labels[i] === 3 || labels[i] === 4;
const leg = (i: number) => labels[i] === 5 || labels[i] === 6;
const eligible = (i: number) => !!B_ORIGIN_01.foreground[i] && !B_ORIGIN_01.protection[i];
const neighbours = (i: number) => [i % W ? i - 1 : -1, i % W < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < N - W ? i + W : -1].filter(j => j >= 0);
const columns = Array.from({ length: W }, (_, x) => {
  const rows = Array.from({ length: W }, (_, y) => y).filter(y => side(y * W + x));
  return rows.length ? { top: rows[0], bottom: rows.at(-1)!, height: rows.at(-1)! - rows[0] + 1 } : null;
});
const sidePixels = labels.flatMap((_, i) => side(i) ? [i] : []);
const roots = labels.flatMap((label, i) => label === 4 && (i >= N - W || labels[i + W] !== 4) ? [i] : []);

function unit(value: number, name: string, allowZero = true) {
  if (!Number.isFinite(value) || value > 1 || value < 0 || (!allowZero && value === 0)) throw new Error(`${name}은 ${allowZero ? '0' : '0 초과'}~1이어야 합니다.`);
}
export function flameRgb(value: string): Rgb {
  if (typeof value !== 'string') throw new Error('색상은 이름 또는 #RRGGBB여야 합니다.');
  const hex = Object.hasOwn(FLAME_COLOURS, value) ? FLAME_COLOURS[value as keyof typeof FLAME_COLOURS] : value;
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('색상은 지원하는 이름 또는 #RRGGBB여야 합니다.');
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as unknown as Rgb;
}
export function validateFlameParameters(p: FlameParameters): void {
  if (!p || typeof p !== 'object') throw new Error('플레임 설정이 필요합니다.');
  flameRgb(p.baseColor); flameRgb(p.patternColor); unit(p.flameStrength, 'flameStrength'); unit(p.legPatternStrength, 'legPatternStrength');
  if (!Number.isSafeInteger(p.patternSeed) || p.patternSeed < 0 || p.patternSeed > 0xffffffff) throw new Error('patternSeed는 0~4294967295 정수여야 합니다.');
  if (p.patternVariant !== undefined && (!Number.isInteger(p.patternVariant) || p.patternVariant < 0 || p.patternVariant > HARLEQUIN_VARIANTS.length)) throw new Error('patternVariant는 0~20 정수여야 합니다.');
}
export function validateFlameThresholds(t: FlameThresholds): void {
  if (!t || typeof t !== 'object') throw new Error('판정 기준이 필요합니다.');
  unit(t.highFlameCoverage, '하이 플레임 점유율', false); unit(t.harlequinCoverage, '할리퀸 점유율', false);
}
export function classifyFlame(patternPixels: number, lateralPixels: number, thresholds: FlameThresholds = DEFAULT_FLAME_THRESHOLDS): FlameClass {
  validateFlameThresholds(thresholds);
  if (!Number.isInteger(patternPixels) || !Number.isInteger(lateralPixels) || lateralPixels < 1 || patternPixels < 0 || patternPixels > lateralPixels) throw new Error('옆구리 픽셀 수 오류');
  const ratio = patternPixels / lateralPixels;
  return !patternPixels ? 'none' : ratio >= thresholds.harlequinCoverage ? 'harlequin' : ratio >= thresholds.highFlameCoverage ? 'high flame' : 'flame';
}

/** Dijkstra on anatomical pixels, including protected geometry. Protection is
 * clipped only from the resulting paint mask, so lines cannot create new roots. */
function arrivalField(domain: (i: number) => boolean, starts: { i: number; cost: number }[], step: (a: number, b: number) => number, flood = false) {
  const distance = new Float64Array(N).fill(Infinity), queue: { i: number; cost: number }[] = [];
  const push = (node: { i: number; cost: number }) => {
    let pos = queue.push(node) - 1;
    while (pos) { const parent = (pos - 1) >> 1; if (queue[parent].cost <= node.cost) break; queue[pos] = queue[parent]; pos = parent; }
    queue[pos] = node;
  };
  for (const node of starts) if (node.cost < distance[node.i]) { distance[node.i] = node.cost; push(node); }
  while (queue.length) {
    const node = queue[0], last = queue.pop()!;
    if (queue.length) {
      let pos = 0;
      while (pos * 2 + 1 < queue.length) {
        let child = pos * 2 + 1;
        if (child + 1 < queue.length && queue[child + 1].cost < queue[child].cost) child++;
        if (queue[child].cost >= last.cost) break;
        queue[pos] = queue[child]; pos = child;
      }
      queue[pos] = last;
    }
    if (node.cost !== distance[node.i]) continue;
    for (const j of neighbours(node.i)) if (domain(j)) {
      const cost = flood ? Math.max(node.cost, step(node.i, j)) : node.cost + step(node.i, j);
      if (cost < distance[j]) { distance[j] = cost; push({ i: j, cost }); }
    }
  }
  return distance;
}
export interface FlameReferenceShape {
  guideId: string; sourcePngSha256: string; canonicalSeed: number;
  anchorStrength: number; guidePixels: number;
  warp: { phase: number; horizontal: number; vertical: number };
  variantId: number;
}
const referenceMask = new Uint8Array(N);
for (const [y, x, length] of FLAME_REFERENCE.runs) referenceMask.fill(1, y * W + x, y * W + x + length);
const lowerColumns = columns.flatMap((c, x) => c && roots.some(i => i % W === x) ? [x] : []);
const outerLegDistance = arrivalField(leg, labels.flatMap((_, i) => leg(i) && neighbours(i).some(j => !B_ORIGIN_01.foreground[j]) ? [{ i, cost: 0 }] : []), () => 1);
const tailRootDistance = arrivalField(i => labels[i] === 7, labels.flatMap((label, i) => label === 7 && neighbours(i).some(side) ? [{ i, cost: 0 }] : []), () => 1);
const fields = new Map<string, { body: Float64Array; legs: Float64Array; tail: Float64Array; reference: FlameReferenceShape }>();
function growthField(seed: number, variantId: number) {
  const key = `${seed}:${variantId}`, saved = fields.get(key); if (saved) return saved;
  const rng = seededRandom(String(seed), 'origin:reference-flank:3');
  const phase = rng() * Math.PI * 2, canonical = seed === FLAME_REFERENCE.referenceSeed;
  const horizontal = canonical ? 0 : .6 + rng() * 1.1, vertical = canonical ? 0 : .5 + rng();
  const guide = new Uint8Array(N);
  for (const i of sidePixels) {
    const x = i % W, y = Math.floor(i / W), c = columns[x]!;
    const rise = (c.bottom - y) / Math.max(1, c.height - 1);
    const sx = Math.round(x + Math.sin(y * .17 + phase) * horizontal * rise);
    const sy = Math.round(y + Math.sin(x * .2 + phase) * vertical * rise);
    if (sx >= 0 && sx < W && sy >= 0 && sy < W && referenceMask[sy * W + sx]) guide[i] = 1;
  }
  if (variantId) {
    const recipe = HARLEQUIN_VARIANTS[variantId - 1];
    // Reuse the reference's irregular, often forked caps. Rearrange them across
    // the torso in anatomical height coordinates, leaving the neck intact.
    const templates = [[40, 45], [46, 53], [54, 62], [63, 71]] as const;
    for (const i of sidePixels) {
      const x = i % W, y = Math.floor(i / W), c = columns[x]!;
      if (x < 40) continue;
      const rise = (c.bottom - y) / Math.max(1, c.height - 1);
      const warped = (x - 40) / 33 * recipe.branches - recipe.lean * rise + Math.sin(y * .17 + phase) * horizontal * rise * .06;
      const band = Math.max(0, Math.min(recipe.branches - 1, Math.floor(warped))), u = Math.max(0, Math.min(1, warped - band));
      const [left, right] = templates[recipe.order[band % recipe.order.length]], sx = Math.round(left + u * (right - left));
      const sourceColumn = columns[sx]!, scale = recipe.height * recipe.rhythm[band % recipe.rhythm.length];
      const sy = Math.round(sourceColumn.bottom - rise / scale * (sourceColumn.height - 1));
      guide[i] = Number(rise <= recipe.baseRise || sy >= sourceColumn.top && sy <= sourceColumn.bottom && !!referenceMask[sy * W + sx]);
    }
  }
  const referenceRoots = roots.filter(i => guide[i]);
  const inside = arrivalField(i => side(i) && !!guide[i], referenceRoots.map(i => ({ i, cost: 0 })), () => 1);
  // Keep reference branches connected to their ventral base after deformation.
  for (const i of sidePixels) if (!Number.isFinite(inside[i])) guide[i] = 0;
  const maximum = Math.max(1, ...sidePixels.filter(i => guide[i]).map(i => inside[i]));
  const outside = arrivalField(side, sidePixels.filter(i => guide[i]).map(i => ({ i, cost: 0 })), () => 1);
  const desired = new Float64Array(N).fill(Infinity), anchor = FLAME_REFERENCE.anchorStrength, last = lowerColumns.at(-1)!;
  for (const i of sidePixels) {
    desired[i] = guide[i] ? .015 + (anchor - .015) * (inside[i] / maximum) ** FLAME_GROWTH_MODEL.insideExponent : anchor + outside[i] * FLAME_GROWTH_MODEL.outsideStep;
    const x = i % W, y = Math.floor(i / W);
    if (x > last) desired[i] = Math.min(desired[i], .62 + (x - last) * .01 + (columns[x]!.bottom - y + .5) * .035);
  }
  const body = arrivalField(side, roots.map(i => ({ i, cost: desired[i] })), (_a, b) => desired[b], true);
  const starts = labels.flatMap((_, i) => leg(i) ? neighbours(i).filter(j => side(j) && Number.isFinite(body[j])).map(j => ({ i, cost: body[j] + (labels[i] === 6 ? .07 : .12) })) : []);
  const legs = arrivalField(leg, starts, () => .035);
  const tailStarts = labels.flatMap((label, i) => label === 7 && tailRootDistance[i] === 0 ? neighbours(i).filter(side).map(j => ({ i, cost: body[j] + .06 })) : []);
  const tail = arrivalField(i => labels[i] === 7 && tailRootDistance[i] <= FLAME_GROWTH_MODEL.tailRootReach, tailStarts, () => .06);
  const reference: FlameReferenceShape = { guideId: FLAME_REFERENCE.id, sourcePngSha256: FLAME_REFERENCE.sourcePngSha256,
    canonicalSeed: FLAME_REFERENCE.referenceSeed, anchorStrength: anchor, guidePixels: guide.reduce((sum, v) => sum + v, 0), warp: { phase: canonical ? 0 : phase, horizontal, vertical }, variantId };
  const result = { body, legs, tail, reference }; fields.set(key, result); if (fields.size > 64) fields.delete(fields.keys().next().value!); return result;
}

export function buildOriginFlameMask(parameters: FlameParameters, thresholds: FlameThresholds = DEFAULT_FLAME_THRESHOLDS) {
  validateFlameParameters(parameters); validateFlameThresholds(thresholds);
  const field = growthField(parameters.patternSeed, parameters.patternVariant ?? 0), mask = new Uint8Array(N), growthMask = new Uint8Array(N);
  // One rooted field preserves the reference's thick branches and deep gaps.
  const limit = parameters.flameStrength;
  for (let i = 0; i < N; i++) if (parameters.flameStrength > 0) {
    const enabled = side(i) ? field.body[i] <= limit
      : leg(i) ? outerLegDistance[i] <= FLAME_GROWTH_MODEL.outerLegBand && field.legs[i] <= limit * parameters.legPatternStrength * (labels[i] === 6 ? FLAME_GROWTH_MODEL.rearLegScale : 1)
      : labels[i] === 7 && field.tail[i] <= limit;
    if (enabled) { growthMask[i] = 255; if (eligible(i)) mask[i] = 255; }
  }
  const patternPixels = sidePixels.filter(i => mask[i]).length;
  const byRegion = { lateral_lower: 0, lateral_upper: 0, legs_front: 0, legs_rear: 0, tail_root: 0 };
  const keys = { 3: 'lateral_upper', 4: 'lateral_lower', 5: 'legs_front', 6: 'legs_rear', 7: 'tail_root' } as const;
  const riseByColumn = new Float64Array(W);
  mask.forEach((v, i) => {
    if (!v) return;
    const key = keys[labels[i] as keyof typeof keys]; if (key) byRegion[key]++;
    if (side(i)) riseByColumn[i % W] = Math.max(riseByColumn[i % W], columns[i % W]!.bottom - Math.floor(i / W) + 1);
  });
  const metrics = { patternPixels, lateralPixels: sidePixels.length, eligibleLateralPixels: sidePixels.filter(eligible).length,
    lateralCoverage: patternPixels / sidePixels.length, classification: classifyFlame(patternPixels, sidePixels.length, thresholds),
    maxRisePixels: Math.max(...riseByColumn), meanRisePixels: riseByColumn.reduce((sum, value) => sum + value, 0) / columns.filter(Boolean).length,
    byRegion, totalPatternPixels: mask.reduce((sum, v) => sum + Number(!!v), 0) };
  return { mask, growthMask, metrics, reference: { ...field.reference, warp: { ...field.reference.warp } } };
}

export function renderOriginFlame(parameters: FlameParameters, thresholds: FlameThresholds = DEFAULT_FLAME_THRESHOLDS) {
  const plan = buildOriginFlameMask(parameters, thresholds), baseColor = flameRgb(parameters.baseColor), patternColor = flameRgb(parameters.patternColor);
  const plain = renderSolidPatternless(baseColor), pixels = plain.pixels.slice(), tones = patternlessTones(patternColor);
  const pattern: SpriteLayer = { name: 'flank', pixels: new Uint8ClampedArray(N * 4), mask: plan.mask.slice() };
  const dorsal: SpriteLayer = { name: 'dorsal', pixels: new Uint8ClampedArray(N * 4), mask: new Uint8Array(N) };
  for (let i = 0; i < N; i++) {
    const target = labels[i] === 2 && eligible(i) ? dorsal : plan.mask[i] ? pattern : null;
    if (!target) continue;
    const tone = B_ORIGIN_01.shading[i], rgb = tone === 1 ? tones.highlight : tone === 3 ? tones.shadow : tones.base;
    pixels.set([...rgb, 255], i * 4); target.pixels.set([...rgb, 255], i * 4); target.mask[i] = 255;
  }
  const sprite: SpriteResult = { width: W, height: W, pixels, version: FLAME_RENDERER_ID,
    layers: [...plain.layers.slice(0, 3), dorsal, pattern, plain.layers[3]] };
  return { sprite, patternless: plain, dorsalMask: dorsal.mask.slice(), patternMask: plan.mask, metrics: plan.metrics, reference: plan.reference, palette: { base: patternlessTones(baseColor), pattern: tones } };
}

/** Find a representative of each recipe using actual lateral coverage. */
const candidateStrengths = new Map<number, number[]>();
export function createHarlequinCandidates(parameters: FlameParameters = DEFAULT_FLAME_PARAMETERS) {
  validateFlameParameters(parameters);
  let strengths = candidateStrengths.get(parameters.patternSeed);
  if (!strengths) {
    strengths = HARLEQUIN_VARIANTS.map(variant => {
      const p = { ...parameters, patternVariant: variant.id, legPatternStrength: variant.legStrength };
      let strength = 1, best = Infinity;
      for (let step = 30; step <= 100; step++) {
        const coverage = buildOriginFlameMask({ ...p, flameStrength: step / 100 }).metrics.lateralCoverage;
        const difference = Math.abs(coverage - variant.targetCoverage);
        if (coverage >= .5 && difference < best) { strength = step / 100; best = difference; }
      }
      return strength;
    });
    candidateStrengths.set(parameters.patternSeed, strengths);
    if (candidateStrengths.size > 8) candidateStrengths.delete(candidateStrengths.keys().next().value!);
  }
  return HARLEQUIN_VARIANTS.map((variant, index) => ({ variant,
    parameters: { ...parameters, patternVariant: variant.id, legPatternStrength: variant.legStrength, flameStrength: strengths![index] } }));
}

export interface FlameExperiment {
  format: 'b-origin-01-flame-experiment'; version: 1; specimenId: 'B-ORIGIN-01';
  rendererVersion: typeof FLAME_RENDERER_ID; parameters: FlameParameters; thresholds: FlameThresholds;
}
export function createFlameExperiment(parameters: FlameParameters = DEFAULT_FLAME_PARAMETERS, thresholds: FlameThresholds = DEFAULT_FLAME_THRESHOLDS): FlameExperiment {
  validateFlameParameters(parameters); validateFlameThresholds(thresholds);
  return { format: 'b-origin-01-flame-experiment', version: 1, specimenId: 'B-ORIGIN-01', rendererVersion: FLAME_RENDERER_ID,
    parameters: { baseColor: parameters.baseColor, patternColor: parameters.patternColor, flameStrength: parameters.flameStrength, patternSeed: parameters.patternSeed, legPatternStrength: parameters.legPatternStrength, patternVariant: parameters.patternVariant ?? 0 },
    thresholds: { highFlameCoverage: thresholds.highFlameCoverage, harlequinCoverage: thresholds.harlequinCoverage } };
}
export function importFlameExperiment(json: string) {
  if (new TextEncoder().encode(json).length > 65536) throw new Error('실험 설정은 64KB 이하여야 합니다.');
  const v = JSON.parse(json) as FlameExperiment;
  if (!v || v.format !== 'b-origin-01-flame-experiment' || v.version !== 1 || v.specimenId !== 'B-ORIGIN-01' || v.rendererVersion !== FLAME_RENDERER_ID) throw new Error('B-ORIGIN-01 플레임 실험 설정을 선택하세요.');
  validateFlameParameters(v.parameters); validateFlameThresholds(v.thresholds);
  return createFlameExperiment(v.parameters, v.thresholds);
}
