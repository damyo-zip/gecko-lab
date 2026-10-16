import type { Genome, Scores } from '@/genetics/advanced/model';
import type { RGB } from '@/phenotype/model';
import type { SpriteResult } from '@/engine/model';

/** Lab-only contract. Never a saved appearanceVersion or a gameplay phenotype. */
export const PROTOTYPE_VERSION = 'regional-prototype-1';
export const RELIEF_VERSION = 'regional-prototype-2';
export interface PrototypeInput { genome: Genome; seed: string; fire?: 'up' | 'down' }
export interface PrototypePhenotype {
  version: typeof PROTOTYPE_VERSION;
  scores: Scores;
  expressed: { lilly: boolean; axanthic: boolean; cappuccino: boolean; highway: boolean; sable: boolean };
  strength: { lilly: number; cappuccino: number; highway: number; sable: number };
  palette: { base: RGB; secondary: RGB; cream: RGB; white: RGB; ink: RGB };
  melanin: number;
  contrast: number;
}
export interface PrototypeMetrics {
  skinPixels: number; whitePixels: number; headWhite: number; headSkin: number;
  dorsalWhite: number; dorsalSkin: number; flankWhite: number; flankSkin: number;
  tailBaseWhite: number; tailTipDark: number; meanSkinLuminance: number;
}
export interface PrototypeResult {
  sprite: SpriteResult;
  phenotype: PrototypePhenotype;
  /** Material masks, measured before lighting, not literal whole-animal coverage. */
  white: Uint8Array;
  dark: Uint8Array;
  /** Pigment labels before illumination: base / cream / dark / white / spot.
   * For boundary diagnostics only, never a genotype or a saved mask. */
  materials: Uint8Array;
  metrics: PrototypeMetrics;
}
