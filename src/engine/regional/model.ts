import type { Genome, Scores } from '@/genetics/advanced/model';
import type { RGB } from '@/phenotype/model';
import type { SpriteResult } from '@/engine/model';

/** Sole production appearance contract, based on the reviewed v2 pixels. */
export const APPEARANCE_VERSION = 'regional-2';
export interface RegionalInput { genome: Genome; seed: string; fire?: 'up' | 'down' }
export interface RegionalPhenotype {
  version: typeof APPEARANCE_VERSION;
  scores: Scores;
  expressed: { lilly: boolean; axanthic: boolean; cappuccino: boolean; highway: boolean; sable: boolean };
  strength: { lilly: number; cappuccino: number; highway: number; sable: number };
  palette: { base: RGB; secondary: RGB; cream: RGB; white: RGB; ink: RGB };
  melanin: number;
  contrast: number;
}
export interface RegionalMetrics {
  skinPixels: number; whitePixels: number; headWhite: number; headSkin: number;
  dorsalWhite: number; dorsalSkin: number; flankWhite: number; flankSkin: number;
  tailBaseWhite: number; tailTipDark: number; meanSkinLuminance: number;
}
export interface RegionalResult {
  sprite: SpriteResult;
  phenotype: RegionalPhenotype;
  /** Material masks, measured before lighting, not literal whole-animal coverage. */
  white: Uint8Array;
  dark: Uint8Array;
  /** Pigment labels before illumination: base / cream / dark / white / spot.
   * Used for final observations and boundary diagnostics; never stored as genotype. */
  materials: Uint8Array;
  metrics: RegionalMetrics;
}
