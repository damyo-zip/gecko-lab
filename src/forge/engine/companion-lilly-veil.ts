import { B_ORIGIN_01 as source } from './art/b-origin-01';
import { companionLillyParameters, describeCompanionLilly, renderCompanionLilly, COMPANION_LILLY_MODEL, type CompanionLillyParameters } from './companion-lilly';
import { patternlessTones } from './patternless';
import { seededRandom } from './genetics';
import type { AppearanceRenderer, RenderInput } from './model';
import type { SpriteLayer } from '@/engine/model';

export const COMPANION_LILLY_VEIL_RENDERER_ID = 'b-origin-01-companion-lilly-2' as const;
/** Cosmetic expression only; neither a new locus nor an inheritance claim. */
export const COMPANION_LILLY_VEIL_MODEL = {
  version: 2, defaultStrength: .8, automaticMinimum: .42, automaticMaximum: .94,
  automaticDomain: 'companion:lilly-veil:2', whiteColor: COMPANION_LILLY_MODEL.whiteColor,
  blend: 'lerp authored-lit Lilly v1 RGB toward authored-lit white RGB; keep original alpha',
  excluded: 'background and user-protected pixels',
} as const;
export const LILLY_VEIL_COMPARISON = [0, .35, .6, .8, .94] as const;
export interface CompanionLillyVeilParameters extends CompanionLillyParameters { veilStrength: number }

export function validateLillyVeil(strength: number) {
  if (typeof strength !== 'number' || !Number.isFinite(strength) || strength < 0 || strength > 1) throw Error('흰 베일 농도는 0~1이어야 합니다.');
}
export function renderCompanionLillyVeil(parameters: CompanionLillyVeilParameters) {
  validateLillyVeil(parameters.veilStrength);
  const original = renderCompanionLilly(parameters), pixels = original.sprite.pixels.slice();
  const strength = parameters.lilly ? parameters.veilStrength : 0;
  const veilMask = new Uint8Array(96 * 96), tones = patternlessTones(COMPANION_LILLY_VEIL_MODEL.whiteColor);
  const layer: SpriteLayer = { name: 'details', mask: veilMask, pixels: new Uint8ClampedArray(pixels.length) };
  if (strength > 0) source.foreground.forEach((v, i) => {
    if (!v || source.protection[i]) return;
    const target = source.shading[i] === 1 ? tones.highlight : source.shading[i] === 3 ? tones.shadow : tones.base;
    for (let c = 0; c < 3; c++) pixels[i * 4 + c] = Math.round(pixels[i * 4 + c] + (target[c] - pixels[i * 4 + c]) * strength);
    veilMask[i] = 255; layer.pixels.set(pixels.slice(i * 4, i * 4 + 4), i * 4);
  });
  const sprite = { ...original.sprite, pixels, version: COMPANION_LILLY_VEIL_RENDERER_ID,
    layers: strength > 0 ? [...original.sprite.layers, layer] : original.sprite.layers };
  return { ...original, sprite, veilMask, veilMetrics: { strength, underpaintRetention: 1 - strength,
    pixels: veilMask.filter(Boolean).length } };
}
export function companionLillyVeilParameters(input: RenderInput, override?: number): CompanionLillyVeilParameters {
  if (override !== undefined) validateLillyVeil(override);
  const original = companionLillyParameters(input), m = COMPANION_LILLY_VEIL_MODEL;
  const automatic = m.automaticMinimum + seededRandom(input.seed, m.automaticDomain)() * (m.automaticMaximum - m.automaticMinimum);
  return { ...original, veilStrength: original.lilly ? override ?? automatic : 0 };
}
export function describeCompanionLillyVeil(input: RenderInput, override?: number) {
  const original = describeCompanionLilly(input), parameters = companionLillyVeilParameters(input, override);
  const result = renderCompanionLillyVeil(parameters);
  return { ...original, parameters, veilMetrics: result.veilMetrics };
}
export function createCompanionLillyVeilRenderer(override?: number): AppearanceRenderer {
  if (override !== undefined) validateLillyVeil(override);
  return { id: override === undefined ? COMPANION_LILLY_VEIL_RENDERER_ID : `${COMPANION_LILLY_VEIL_RENDERER_ID}:veil:${override}`,
    render: input => renderCompanionLillyVeil(companionLillyVeilParameters(input, override)).sprite };
}
export const companionLillyVeilRenderer = createCompanionLillyVeilRenderer();
