export const SPRITE_SIZE = 96;
export const PIXEL_COUNT = SPRITE_SIZE * SPRITE_SIZE;
export const ENGINE_VERSION = "1.0.0";

export type BodyColor = "orange" | "brown" | "cream" | "slate";
export type PatternStyle = "normal" | "lilly" | "axanthic" | "dalmatian" | "harlequin" | "tricolor";
export type FireState = "up" | "down";
export type LayerName = "silhouette" | "body" | "shadow" | "highlight" | "dorsal" | "flank" | "spots" | "details";
export const LAYER_ORDER: readonly LayerName[] = [
  "silhouette", "body", "shadow", "highlight", "dorsal", "flank", "spots", "details",
];
export const LAYER_LABELS: Record<LayerName, string> = {
  silhouette: "기본 실루엣", body: "기본 체색", shadow: "그림자", highlight: "하이라이트",
  dorsal: "등 패턴", flank: "옆구리 패턴", spots: "반점", details: "눈 · 크레스트 · 꼬리",
};

/** Visual traits only. A future genetics system can supply these without changing the renderer. */
export interface AppearanceTraits {
  bodyColor: BodyColor;
  patternStyle: PatternStyle;
  dorsalCoverage: number;
  flankCoverage: number;
  spotCount: number;
}

export interface GeckoSpecimen {
  schemaVersion: 1;
  id: string;
  name: string;
  seed: string;
  appearance: AppearanceTraits;
  state: { fire: FireState };
}

export interface SpriteLayer {
  name: LayerName;
  /** Straight RGBA, 96 × 96. */
  pixels: Uint8ClampedArray;
  /** Per-pixel alpha; compositing multiplies this with RGBA alpha. */
  mask: Uint8Array;
}
export interface SpriteResult {
  width: 96;
  height: 96;
  pixels: Uint8ClampedArray;
  layers: SpriteLayer[];
  version: string;
}

export function validateSpecimen(specimen: GeckoSpecimen): void {
  if (specimen.schemaVersion !== 1) throw new Error("지원하지 않는 개체 데이터 버전입니다.");
  if (typeof specimen.seed !== "string" || specimen.seed.length === 0 || specimen.seed.length > 128)
    throw new Error("시드는 1~128자의 문자열이어야 합니다.");
  const traits = specimen.appearance;
  if (!["orange", "brown", "cream", "slate"].includes(traits.bodyColor) ||
    !["normal", "lilly", "axanthic", "dalmatian", "harlequin", "tricolor"].includes(traits.patternStyle) ||
    !["up", "down"].includes(specimen.state.fire))
    throw new Error("지원하지 않는 외형 파라미터입니다.");
  for (const amount of [traits.dorsalCoverage, traits.flankCoverage]) {
    if (!Number.isFinite(amount) || amount < 0 || amount > 1)
      throw new Error("패턴 면적은 0~1이어야 합니다.");
  }
  if (!Number.isInteger(traits.spotCount) || traits.spotCount < 0 || traits.spotCount > 70)
    throw new Error("반점 수는 0~70의 정수여야 합니다.");
}
