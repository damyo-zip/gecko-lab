/** Visible, renderable traits; never genotype or a set of independent morph genes. */
export type RGB = readonly [number, number, number];
export interface PatternTraits {
  version: 1;
  dorsal: number; flank: number; limbs: number; complexity: number;
  cream: number; contrast: number; drippy: number; wall: number;
  tiger: number; brindle: number;
  pin: readonly [number, number]; side: readonly [number, number];
  spots: { count: number; size: number };
  palette: { base: RGB; secondary: RGB; cream: RGB };
  color: "레드" | "오렌지" | "옐로" | "크림" | "다크" | "회색";
}
export interface LineObservation { coverage: number; longestRun: number; gapCount: number; length: number }
export interface PatternObservation {
  dorsal: number; flank: number; limbs: number;
  baseArea: number; creamArea: number; secondaryArea: number;
  pin: readonly [LineObservation, LineObservation]; side: readonly [LineObservation, LineObservation];
  drips: number; wall: number; bars: number; brokenBars: boolean; spots: number;
}
export interface PatternName { primary: string; features: string[]; base: string; color: string; rulesVersion: 1 }
