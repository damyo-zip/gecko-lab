import { B_ORIGIN_01 as source } from './art/b-origin-01';
import { companionFlameParameters, renderCompanionFlame, describeCompanionFlame, type CompanionFlameParameters } from './companion-flame';
import { patternlessTones } from './patternless';
import type { AppearanceRenderer, RenderInput } from './model';
import type { SpriteLayer } from '@/engine/model';

export const COMPANION_LILLY_RENDERER_ID = 'b-origin-01-companion-lilly-1' as const;
/** Game appearance coefficients, independent of the original inheritance model. */
export const COMPANION_LILLY_MODEL = {
  version: 1, whiteColor: [253, 252, 242] as const,
  flankMinimum: .72, flankRange: .24, legMinimum: .85,
  skinCream: 'invert expressed cream = .75 + inherited cream * .25; apply white pigment separately',
  preservedMaterials: ['face_crown', 'face_cheek', 'throat', 'toe_pads'],
} as const;
export interface CompanionLillyParameters extends CompanionFlameParameters { lilly: boolean }

export function renderCompanionLilly(parameters: CompanionLillyParameters) {
  if (typeof parameters.lilly !== 'boolean') throw Error('릴리 발현 여부가 필요합니다.');
  const ordinary = renderCompanionFlame(parameters), whiteMask = new Uint8Array(96 * 96);
  const pixels = ordinary.sprite.pixels.slice();
  if (parameters.lilly) {
    const m = COMPANION_LILLY_MODEL;
    const expanded = renderCompanionFlame({ ...parameters,
      flameStrength: m.flankMinimum + parameters.flameStrength * m.flankRange,
      legPatternStrength: Math.max(m.legMinimum, parameters.legPatternStrength) });
    const tones = patternlessTones(m.whiteColor);
    whiteMask.forEach((_, i) => {
      if (!source.foreground[i] || source.protection[i] || source.labels[i] === 1 || [1, 2, 3, 5].includes(ordinary.base.materialMask[i])) return;
      if (!expanded.patternMask[i] && source.labels[i] !== 2 && ordinary.base.materialMask[i] !== 6) return;
      whiteMask[i] = 255;
      const rgb = source.shading[i] === 1 ? tones.highlight : source.shading[i] === 3 ? tones.shadow : tones.base;
      pixels.set([...rgb, 255], i * 4);
    });
  }
  const layer: SpriteLayer = { name: 'details', mask: whiteMask.slice(), pixels: new Uint8ClampedArray(pixels.length) };
  whiteMask.forEach((v, i) => { if (v) layer.pixels.set(pixels.slice(i * 4, i * 4 + 4), i * 4); });
  const whiteLateralPixels = whiteMask.filter((v, i) => v && [3, 4].includes(source.labels[i])).length;
  const sprite = { ...ordinary.sprite, version: COMPANION_LILLY_RENDERER_ID, pixels,
    layers: parameters.lilly ? [...ordinary.sprite.layers, layer] : ordinary.sprite.layers };
  return { sprite, ordinary, whiteMask, metrics: { whitePixels: whiteMask.filter(Boolean).length,
    whiteLateralPixels, whiteLateralCoverage: whiteLateralPixels / ordinary.metrics.lateralPixels } };
}
export function companionLillyParameters(input: RenderInput): CompanionLillyParameters {
  return { ...companionFlameParameters(skinInput(input)), lilly: input.phenotype.observed['lilly-white'] === 'Lilly White' };
}
// Core phenotype already boosts Lilly cream. Local white pigment carries that
// expression here; recover inherited cream for the remaining skin so it is not
// desaturated a second time. No genome or core phenotype is changed.
function skinInput(input: RenderInput): RenderInput {
  if (input.phenotype.observed['lilly-white'] !== 'Lilly White') return input;
  const p = input.phenotype;
  return { ...input, phenotype: { ...p, genetics: { ...p.genetics,
    scores: { ...p.genetics.scores, cream: Math.max(0, Math.min(1, (p.genetics.scores.cream - .75) / .25)) } } } };
}
export function describeCompanionLilly(input: RenderInput) {
  const original = describeCompanionFlame(skinInput(input)), parameters = companionLillyParameters(input), result = renderCompanionLilly(parameters);
  const failed = input.phenotype.observed['lilly-white'] === 'Lilly 동형접합 비생존';
  return { ...original, name: failed ? '릴리 동형접합 비생존' : parameters.lilly ? `릴리화이트 · ${original.name}` : original.name,
    parameters, whiteMetrics: result.metrics };
}
export const companionLillyRenderer: AppearanceRenderer = { id: COMPANION_LILLY_RENDERER_ID,
  render: input => renderCompanionLilly(companionLillyParameters(input)).sprite };
