import type {describeCompanionLineage} from '@/forge';
import {PATTERN_LABELS} from '@/forge/engine/companion-patterns';

/** Game presentation order, not a genetic dominance or market-value ranking.
 * Full observed classifications remain separate for search, pricing and details. */
export const FORGE_MORPH_PRIORITY=[
 '설악','프라푸치노','루왁','세이블/하이웨이','카푸치노/하이웨이',
 '슈퍼 카푸치노','슈퍼 세이블','슈퍼 하이웨이',
 '아잔틱','릴리화이트','카푸치노','세이블','하이웨이','팬텀',
 '화이트아웃','슈퍼스트라이프','리버스 핀스트라이프','쿼드스트라이프','엠티백','화이트월',
 '트라이컬러 익스트림 할리퀸','트라이컬러 할리퀸','익스트림 할리퀸',
 '고밀도 달마시안','풀 핀스트라이프','할리퀸','브린들','타이거',
 '하이 플레임','플레임','달마시안','포트홀','파셜 핀스트라이프','패턴리스',
] as const;

export function forgeRepresentativeMorphName(d:ReturnType<typeof describeCompanionLineage>,features:readonly string[]):string {
 const p=d.parameters,c=d.complexMetrics;
 const complex=c.sable&&c.highway?'세이블/하이웨이':c.sable?
  p.complexPair==='C/S'?'루왁':p.sableCopies===2?'슈퍼 세이블':'세이블':c.highway?
  p.complexPair==='C/H'?'카푸치노/하이웨이':p.highwayCopies===2?'슈퍼 하이웨이':'하이웨이':
  p.cappuccinoCopies===2?p.lilly?'설악':'슈퍼 카푸치노':p.cappuccinoCopies?p.lilly?'프라푸치노':'카푸치노':'';
 const candidates=new Set([complex,p.axanthic?'아잔틱':'',p.lilly?'릴리화이트':'',p.phantomCopies===2?'팬텀':'',
  ...features,PATTERN_LABELS[d.patternMetrics.classification]]);
 return FORGE_MORPH_PRIORITY.find(name=>candidates.has(name))??'슈퍼폼';
}
