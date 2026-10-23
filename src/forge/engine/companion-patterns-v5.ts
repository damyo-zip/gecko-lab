import { renderCompanionPatterns, describeCompanionPatterns, createCompanionPatternsRenderer, type CompanionPatternsParameters } from './companion-patterns';
import { companionPatternsParametersV4, DEFAULT_PATTERNS_V4_PARAMETERS } from './companion-patterns-v4';
import { buildCompanionPartialStripes, COMPANION_PARTIAL_STRIPE_MODEL } from './companion-stripes-v5';
import type { AppearanceRenderer, RenderInput } from './model';
export { buildCompanionPartialStripes, COMPANION_PARTIAL_STRIPE_MODEL };
export { TIGER_COLOUR_STUDIES } from './companion-patterns-v4';
export const COMPANION_PATTERNS_V5_RENDERER_ID = 'b-origin-01-companion-patterns-5' as const;
export const DEFAULT_PATTERNS_V5_PARAMETERS = DEFAULT_PATTERNS_V4_PARAMETERS;
export const companionPatternsParametersV5 = companionPatternsParametersV4;
export function renderCompanionPatternsV5(p: CompanionPatternsParameters) {
  const r = renderCompanionPatterns(p, buildCompanionPartialStripes, { dorsalSkinBlend: .92, retainCappuccinoTail: true, includeDorsalInTracks: true });
  return { ...r, sprite: { ...r.sprite, version: COMPANION_PATTERNS_V5_RENDERER_ID }, stripeStyle: COMPANION_PARTIAL_STRIPE_MODEL };
}
export function describeCompanionPatternsV5(input: RenderInput, veilOverride?: number) {
  const parameters = companionPatternsParametersV5(input, veilOverride);
  return { ...describeCompanionPatterns(input, veilOverride, () => renderCompanionPatternsV5(parameters)), parameters };
}
export function createCompanionPatternsRendererV5(veilOverride?: number): AppearanceRenderer {
  createCompanionPatternsRenderer(veilOverride);
  return { id: veilOverride === undefined ? COMPANION_PATTERNS_V5_RENDERER_ID : `${COMPANION_PATTERNS_V5_RENDERER_ID}:veil:${veilOverride}`,
    render: input => renderCompanionPatternsV5(companionPatternsParametersV5(input, veilOverride)).sprite };
}
export const companionPatternsRendererV5 = createCompanionPatternsRendererV5();
