/** Game thresholds at 96px. These are NOT industry standards or Mendelian odds.
 * Definitions/evidence and disputed inheritance claims: docs/inherited-patterns.md. */
export const PATTERN_RULES = {
  version: 1 as const,
  patternless: { dorsal: .18, flank: .13 },
  harlequin: { flank: .26, limbs: .16 },
  extreme: { flank: .55, limbs: .32 },
  tricolor: { minArea: .10, minColorDistance: 65 },
  partialPin: .32, quadSide: .90,
  drippy: 3, whitewall: .20,
  dalmatian: 12, superDalmatian: 48,
  aliases: { "익스트림 할리퀸": "익할", "트라이컬러 익스트림 할리퀸": "트익할", "풀 핀스트라이프": "풀핀", "쿼드 핀스트라이프": "쿼드" },
};
export const PATTERN_PRICE_RULES = {
  version: 1, note: "임시 게임 수요·품질 가중치. 검증된 국내 거래 시세가 아님. 이름별 가산 없음.",
  pattern: .35, continuity: .15, spots: .12, contrast: .12,
};
export const PATTERN_FILTERS=["패턴리스","플레임","할리퀸","익스트림 할리퀸","트라이컬러","타이거","브린들","파셜 핀스트라이프","풀 핀스트라이프","쿼드 핀스트라이프","드리피","화이트월","달마시안","슈퍼달마시안","레드","오렌지","옐로","크림","다크"] as const;
