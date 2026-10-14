import { PATTERN_RULES as R } from "./rules";
import type { LineObservation, PatternName, PatternObservation, PatternTraits, RGB } from "./model";
const distance=(a:RGB,b:RGB)=>Math.sqrt(a.reduce((v,c,i)=>v+(c-b[i])**2,0));
/** Both rendered paths must be present, gapless and end-to-end. */
export const fullLine=(line:LineObservation)=>line.length>=16&&line.coverage===1&&line.longestRun===line.length&&line.gapCount===0;
export function classifyPattern(t:PatternTraits,o:PatternObservation,geneticMorphs:readonly string[]=[]):PatternName {
  const extreme=o.flank>=R.extreme.flank&&o.limbs>=R.extreme.limbs;
  let base=extreme?"익스트림 할리퀸":o.flank>=R.harlequin.flank&&o.limbs>=R.harlequin.limbs?"할리퀸":
    o.bars>=3?o.brokenBars?"브린들":"타이거":o.dorsal<R.patternless.dorsal&&o.flank<R.patternless.flank?"패턴리스":"플레임";
  const tricolor=t.color!=="회색"&&Math.min(o.baseArea,o.creamArea,o.secondaryArea)>=R.tricolor.minArea&&
    distance(t.palette.base,t.palette.secondary)>=R.tricolor.minColorDistance&&distance(t.palette.base,t.palette.cream)>=R.tricolor.minColorDistance&&distance(t.palette.secondary,t.palette.cream)>=R.tricolor.minColorDistance;
  if(tricolor)base="트라이컬러"+(base.includes("할리퀸")?" "+base:"");
  const features:string[]=[];
  const pinFull=o.pin.every(fullLine),quad=pinFull&&o.side.every(s=>s.coverage>=R.quadSide&&s.longestRun/s.length>=R.quadSide);
  if(quad)features.push("쿼드 핀스트라이프");else if(pinFull)features.push("풀 핀스트라이프");else if(o.pin.some(l=>l.coverage>=R.partialPin))features.push("파셜 핀스트라이프");
  if(o.drips>=R.drippy)features.push("드리피");if(o.wall>=R.whitewall)features.push("화이트월");
  const dal=o.spots>=R.superDalmatian?"슈퍼달마시안":o.spots>=R.dalmatian?"달마시안":"";
  if(dal){if(base==="패턴리스")base=dal;else features.push(dal);}
  const genetic=geneticMorphs.map(m=>m==="Lilly White"?"릴리화이트":m==="Axanthic"?"아잔틱":m).join(" + ");
  const primary=[genetic,t.color==="회색"?"":t.color,base].filter(Boolean).join(" ");
  return {primary,features,base,color:t.color,rulesVersion:1};
}
