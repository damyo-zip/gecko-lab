import { renderCompanionPatterns, companionPatternsParameters, describeCompanionPatterns, createCompanionPatternsRenderer, DEFAULT_PATTERNS_PARAMETERS, type CompanionPatternsParameters } from './companion-patterns';
import { buildCompanionWedgeStripes, COMPANION_WEDGE_STRIPE_MODEL } from './companion-stripes-v3';
import type { AppearanceRenderer, RenderInput } from './model';
import type { Rgb } from './patternless';
export { buildCompanionWedgeStripes, COMPANION_WEDGE_STRIPE_MODEL };
export const COMPANION_PATTERNS_V3_RENDERER_ID = 'b-origin-01-companion-patterns-3' as const;
export const DEFAULT_PATTERNS_V3_PARAMETERS: Readonly<CompanionPatternsParameters> = {
  ...DEFAULT_PATTERNS_PARAMETERS, stripeBodyColor: [228, 157, 76], stripeColor: [96, 49, 29],
};
function honeyColour(rgb: Rgb): Rgb {
  const light = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  const honey = [light * 1.25 + 27, light * .87 + 15, light * .42 + 8];
  return rgb.map((v, n) => Math.round(Math.max(0, Math.min(255, v * .2 + honey[n] * .8)))) as unknown as Rgb;
}
export function companionPatternsParametersV3(input: RenderInput, veilOverride?: number): CompanionPatternsParameters {
  const p = companionPatternsParameters(input, veilOverride);
  return { ...p, stripeBodyColor: honeyColour(p.stripeBodyColor), stripeColor: p.stripeColor.map((v, n) => Math.round(v * .4 + [101, 49, 27][n] * .6)) as unknown as Rgb };
}
export function renderCompanionPatternsV3(p: CompanionPatternsParameters) {
  const r = renderCompanionPatterns(p, buildCompanionWedgeStripes);
  return { ...r, sprite: { ...r.sprite, version: COMPANION_PATTERNS_V3_RENDERER_ID }, stripeStyle: COMPANION_WEDGE_STRIPE_MODEL };
}
export function describeCompanionPatternsV3(input: RenderInput, veilOverride?: number) {
  // Reuse the shared naming rules with this version's palette and observed pixels.
  const parameters = companionPatternsParametersV3(input, veilOverride);
  return { ...describeCompanionPatterns(input, veilOverride, () => renderCompanionPatternsV3(parameters)), parameters };
}
export function createCompanionPatternsRendererV3(veilOverride?: number): AppearanceRenderer {
  createCompanionPatternsRenderer(veilOverride);
  return { id: veilOverride === undefined ? COMPANION_PATTERNS_V3_RENDERER_ID : `${COMPANION_PATTERNS_V3_RENDERER_ID}:veil:${veilOverride}`,
    render: input => renderCompanionPatternsV3(companionPatternsParametersV3(input, veilOverride)).sprite };
}
export const companionPatternsRendererV3 = createCompanionPatternsRendererV3();
