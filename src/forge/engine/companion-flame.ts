import { B_ORIGIN_01 as source } from './art/b-origin-01';
import { renderCompanionBase, validateCompanionParameters, DEFAULT_COMPANION_PARAMETERS, type CompanionParameters } from './companion-base';
import { buildOriginFlameMask, classifyFlame, DEFAULT_FLAME_THRESHOLDS } from './origin-flame';
import { patternlessColour, patternlessTones, type Rgb } from './patternless';
import { seededRandom } from './genetics';
import type { AppearanceRenderer, RenderInput } from './model';
import type { SpriteLayer, SpriteResult } from '@/engine/model';

export const COMPANION_FLAME_RENDERER_ID = 'b-origin-01-companion-flame-1' as const;
export interface CompanionFlameParameters extends CompanionParameters {
  flameStrength: number;
  legPatternStrength: number;
  patternSeed: number;
}
export const COMPANION_FLAME_MODEL = {
  version: 1, flameWeights: { flank: .72, harlequin: .28 }, flameOffset: .06, flameRange: .82,
  legOffset: .08, legRange: .74, bodyWhiteMix: .12, detailCreamMix: .7,
  legStart: .5, legStep: .033, rearLegScale: .85,
  preservedMaterials: ['face_crown', 'face_cheek', 'throat', 'toe_pads', 'dorsal'],
  denominator: 'all lateral_upper + lateral_lower, including protected and common materials',
  harlequinCoverage: .5,
} as const;
export const COMPANION_COMPARISON = [
  { id: 'base', name: '기본형', flameStrength: 0, legPatternStrength: 0 },
  { id: 'flame', name: '플레임', flameStrength: .45, legPatternStrength: .3 },
  { id: 'harlequin', name: '할리퀸', flameStrength: .9, legPatternStrength: 1 },
] as const;
const N = 96 * 96, clamp = (n: number) => Math.max(0, Math.min(1, n));
const side = (i: number) => source.labels[i] === 3 || source.labels[i] === 4;
const leg = (i: number) => source.labels[i] === 5 || source.labels[i] === 6;
const adjacent = (i: number) => [i % 96 ? i - 1 : -1, i % 96 < 95 ? i + 1 : -1, i - 96, i + 96].filter(j => j >= 0 && j < N);
const hex = (c: Rgb) => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
const mix = (a: Rgb, b: Rgb, t: number) => a.map((v, channel) => Math.round(v + (b[channel] - v) * t)) as unknown as Rgb;
const commonMaterials = new Set([1, 2, 3, 5, 8]);
const sidePixels = source.labels.flatMap((_, i) => side(i) ? [i] : []);

export function renderCompanionFlame(parameters: CompanionFlameParameters) {
  validateCompanionParameters(parameters);
  const base = renderCompanionBase(parameters);
  const plan = buildOriginFlameMask({ baseColor: hex(parameters.bodyColor), patternColor: hex(parameters.detailColor),
    flameStrength: parameters.flameStrength, legPatternStrength: parameters.legPatternStrength, patternSeed: parameters.patternSeed });
  const mask = plan.mask.slice();
  // Extend large body patches along the outer planes of the actual limbs.
  // Every new limb pixel is reached from an active anatomical body contact;
  // stronger expression only adds roots and reach, preserving nested masks.
  const distance = new Int16Array(N).fill(-1), queue: number[] = [];
  source.labels.forEach((_, i) => {
    if (leg(i) && adjacent(i).some(j => side(j) && plan.growthMask[j])) { distance[i] = 0; queue.push(i); }
  });
  for (let n = 0; n < queue.length; n++) for (const j of adjacent(queue[n])) if (leg(j) && distance[j] < 0) { distance[j] = distance[queue[n]] + 1; queue.push(j); }
  for (const i of queue) {
    const outer = base.materialMask[i] === 7 || adjacent(i).some(j => !source.foreground[j]);
    const strength = parameters.flameStrength * parameters.legPatternStrength * (source.labels[i] === 6 ? COMPANION_FLAME_MODEL.rearLegScale : 1);
    if (outer && strength >= COMPANION_FLAME_MODEL.legStart + distance[i] * COMPANION_FLAME_MODEL.legStep) mask[i] = 255;
  }
  mask.forEach((_, i) => { if (!source.foreground[i] || source.protection[i] || commonMaterials.has(base.materialMask[i]) || source.labels[i] === 1 || source.labels[i] === 2) mask[i] = 0; });
  const tones = patternlessTones(parameters.detailColor), pixels = base.sprite.pixels.slice();
  const pattern: SpriteLayer = { name: 'flank', pixels: new Uint8ClampedArray(N * 4), mask: mask.slice() };
  mask.forEach((v, i) => {
    if (!v) return;
    const tone = source.shading[i], rgb = tone === 1 ? tones.highlight : tone === 3 ? tones.shadow : tones.base;
    pixels.set([...rgb, 255], i * 4); pattern.pixels.set([...rgb, 255], i * 4);
  });
  const count = sidePixels.filter(i => mask[i]).length;
  const metrics = { patternPixels: count, lateralPixels: sidePixels.length, lateralCoverage: count / sidePixels.length,
    classification: classifyFlame(count, sidePixels.length, DEFAULT_FLAME_THRESHOLDS),
    legsFront: source.labels.filter((label, i) => label === 5 && mask[i]).length,
    legsRear: source.labels.filter((label, i) => label === 6 && mask[i]).length,
    tailRoot: source.labels.filter((label, i) => label === 7 && mask[i]).length };
  const sprite: SpriteResult = { width: 96, height: 96, version: COMPANION_FLAME_RENDERER_ID, pixels,
    layers: [...base.sprite.layers.slice(0, 3), pattern, base.sprite.layers[3]] };
  return { sprite, base, patternMask: mask, metrics, reference: plan.reference };
}

export function companionFlameParameters(input: RenderInput): CompanionFlameParameters {
  const s = input.phenotype.genetics.scores, m = COMPANION_FLAME_MODEL;
  const plain = patternlessColour(s, input.fire);
  const bodyColor = mix(plain.base, [255, 255, 255], m.bodyWhiteMix);
  const detailColor = mix(DEFAULT_COMPANION_PARAMETERS.detailColor, [255, 244, 221], s.cream * m.detailCreamMix);
  return { bodyColor, detailColor, flameStrength: clamp((s.flank * m.flameWeights.flank + s.harlequin * m.flameWeights.harlequin - m.flameOffset) / m.flameRange),
    legPatternStrength: clamp((s.harlequin - m.legOffset) / m.legRange), patternSeed: Math.floor(seededRandom(input.seed, 'companion:flame-shape:1')() * 0x100000000) };
}
export function describeCompanionFlame(input: RenderInput) {
  const parameters = companionFlameParameters(input), result = renderCompanionFlame(parameters);
  const names = { none: '기본형', flame: '플레임', 'high flame': '하이 플레임', harlequin: '할리퀸' };
  const name = names[result.metrics.classification];
  return { name, base: parameters.bodyColor, hex: hex(parameters.bodyColor), parameters, metrics: result.metrics, features: [name] };
}
export const companionFlameRenderer: AppearanceRenderer = { id: COMPANION_FLAME_RENDERER_ID,
  render: input => renderCompanionFlame(companionFlameParameters(input)).sprite };
