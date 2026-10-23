import { buildCompanionTransverseStripes, COMPANION_TRANSVERSE_STRIPE_MODEL } from './companion-stripes-v4';
import type { CompanionPatternsParameters } from './companion-patterns';
export const COMPANION_PARTIAL_STRIPE_MODEL = {
  ...COMPANION_TRANSVERSE_STRIPE_MODEL,
  version: 5,
  maximumLateralDepth: .78,
  bellyClearance: 2,
  minimumLateralRows: 2,
  shape: 'The same seeded dorsal bands stop before the ventral edge; short dorsal bands dip slightly into the visible flank.',
  extent: 'Leave two native flank rows towards the belly, or one in very thin sections; taper ends and retain unequal lengths. Short bands aim for two lateral rows where the anatomy permits.',
  layout: 'Reuse the accepted v4 layout and its visual seed domain, so this is an extent refinement of the same individual.',
} as const;
export function buildCompanionPartialStripes(p: Pick<CompanionPatternsParameters, 'stripeStrength' | 'brindleStrength' | 'stripeWidth' | 'stripeSeed'>) {
  return buildCompanionTransverseStripes(p, COMPANION_PARTIAL_STRIPE_MODEL);
}
