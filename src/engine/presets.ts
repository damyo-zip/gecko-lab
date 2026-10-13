import type { AppearanceTraits, GeckoSpecimen, PatternStyle } from "./model";

export interface MorphPreset {
  id: PatternStyle;
  name: string;
  english: string;
  nickname: string;
  accent: string;
  description: string;
  appearance: AppearanceTraits;
}
export const MORPH_PRESETS: readonly MorphPreset[] = [
  { id: "normal", name: "노멀", english: "Normal", nickname: "치즈", accent: "#f6ad58",
    description: "따뜻한 오렌지 체색과 얇은 등 무늬",
    appearance: { bodyColor: "orange", patternStyle: "normal", dorsalCoverage: .32, flankCoverage: .48, spotCount: 0 } },
  { id: "lilly", name: "릴리 화이트", english: "Lilly White", nickname: "모카", accent: "#f2dec0",
    description: "넓은 크림색 등과 옆구리 무늬",
    appearance: { bodyColor: "cream", patternStyle: "lilly", dorsalCoverage: .92, flankCoverage: .83, spotCount: 0 } },
  { id: "axanthic", name: "아잔틱", english: "Axanthic", nickname: "그레이", accent: "#a9b1cf",
    description: "회색 팔레트와 차분한 무늬 대비",
    appearance: { bodyColor: "slate", patternStyle: "axanthic", dorsalCoverage: .45, flankCoverage: .4, spotCount: 0 } },
  { id: "dalmatian", name: "달마시안", english: "Dalmatian", nickname: "도트", accent: "#e9c393",
    description: "부위별로 배치한 짙은 달마시안 반점",
    appearance: { bodyColor: "cream", patternStyle: "dalmatian", dorsalCoverage: .18, flankCoverage: .1, spotCount: 45 } },
  { id: "harlequin", name: "할리퀸", english: "Harlequin", nickname: "할리", accent: "#e7bd6b",
    description: "짙은 브라운 체색과 가지처럼 뻗은 무늬",
    appearance: { bodyColor: "brown", patternStyle: "harlequin", dorsalCoverage: .64, flankCoverage: .74, spotCount: 0 } },
  { id: "tricolor", name: "트라이컬러", english: "Tricolor Harlequin", nickname: "트리", accent: "#f18c62",
    description: "오렌지·브라운·크림의 세 가지 색",
    appearance: { bodyColor: "orange", patternStyle: "tricolor", dorsalCoverage: .73, flankCoverage: .8, spotCount: 0 } },
];

export function specimenFromPreset(preset: MorphPreset, seed = "GECKO-0014"): GeckoSpecimen {
  return { schemaVersion: 1, id: preset.id + ":" + seed, name: preset.nickname, seed,
    appearance: { ...preset.appearance }, state: { fire: "up" } };
}
