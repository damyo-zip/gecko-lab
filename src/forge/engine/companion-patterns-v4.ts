import { renderCompanionPatterns, describeCompanionPatterns, createCompanionPatternsRenderer, type CompanionPatternsParameters } from './companion-patterns';
import { companionPatternsParametersV3, DEFAULT_PATTERNS_V3_PARAMETERS } from './companion-patterns-v3';
import { buildCompanionTransverseStripes, COMPANION_TRANSVERSE_STRIPE_MODEL } from './companion-stripes-v4';
import type { AppearanceRenderer, RenderInput } from './model';
export { buildCompanionTransverseStripes, COMPANION_TRANSVERSE_STRIPE_MODEL };
export const COMPANION_PATTERNS_V4_RENDERER_ID = 'b-origin-01-companion-patterns-4' as const;
export const DEFAULT_PATTERNS_V4_PARAMETERS = DEFAULT_PATTERNS_V3_PARAMETERS;
export const companionPatternsParametersV4 = companionPatternsParametersV3;
/** Controlled art previews; these RGB overrides do not edit family genomes. */
export const TIGER_COLOUR_STUDIES = [
  { id: 'tiger-buckskin', name: '벅스킨 타이거', stripeBodyColor: [179, 151, 111], stripeColor: [67, 53, 39], detailColor: [233, 212, 169] },
  { id: 'tiger-ochre', name: '황토색 타이거', stripeBodyColor: [192, 153, 74], stripeColor: [67, 45, 28], detailColor: [233, 212, 169] },
  { id: 'tiger-red', name: '적갈색 타이거', stripeBodyColor: [164, 86, 58], stripeColor: [62, 34, 30], detailColor: [233, 212, 169] },
  { id: 'tiger-olive', name: '올리브 타이거', stripeBodyColor: [150, 149, 92], stripeColor: [58, 52, 33], detailColor: [233, 212, 169] },
] as const;
export function renderCompanionPatternsV4(p: CompanionPatternsParameters) {
  const r = renderCompanionPatterns(p, buildCompanionTransverseStripes, { dorsalSkinBlend: .92, retainCappuccinoTail: true, includeDorsalInTracks: true });
  return { ...r, sprite: { ...r.sprite, version: COMPANION_PATTERNS_V4_RENDERER_ID }, stripeStyle: COMPANION_TRANSVERSE_STRIPE_MODEL };
}
export function describeCompanionPatternsV4(input: RenderInput, veilOverride?: number) {
  const parameters = companionPatternsParametersV4(input, veilOverride);
  return { ...describeCompanionPatterns(input, veilOverride, () => renderCompanionPatternsV4(parameters)), parameters };
}
export function createCompanionPatternsRendererV4(veilOverride?: number): AppearanceRenderer {
  createCompanionPatternsRenderer(veilOverride);
  return { id: veilOverride === undefined ? COMPANION_PATTERNS_V4_RENDERER_ID : `${COMPANION_PATTERNS_V4_RENDERER_ID}:veil:${veilOverride}`,
    render: input => renderCompanionPatternsV4(companionPatternsParametersV4(input, veilOverride)).sprite };
}
export const companionPatternsRendererV4 = createCompanionPatternsRendererV4();
