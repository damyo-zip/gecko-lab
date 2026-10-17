import {regionalPhenotype} from '@/engine/regional/phenotype';
import {fixtureGenome} from '@/engine/regional/fixtures';
import type {Genome} from '@/genetics/advanced/model';
const reference=regionalPhenotype(fixtureGenome('typical','normal')).scores;
export const unit=(v:number)=>Math.max(0,Math.min(1,v));
/** Read existing alleles and scores. All spatial coefficients below are a
 * provisional visual model for B, never real-world penetrance or new genes. */
export function bPhenotype(genome:Genome){
 const p=regionalPhenotype(genome),s=p.scores;
 const coverage=s.cream*.35+s.flank*.30+s.harlequin*.20+s.dorsal*.15;
 const origin=reference.cream*.35+reference.flank*.30+reference.harlequin*.20+reference.dorsal*.15;
 return {...p,coverage,coverageDelta:coverage-origin,lightness:s.brightness-reference.brightness,
  warmth:{red:s.red-reference.red,orange:s.orange-reference.orange},
  white:p.expressed.lilly?p.strength.lilly:0,dorsal:s.dorsal,pin:s.pinstripe,
  features:[p.expressed.lilly?'부위별 백색':null,p.expressed.axanthic?'무채색·명도 차이':null,p.expressed.cappuccino?'밝은 꼬리 기부 · 어두운 꼬리 끝':null,p.expressed.highway?'안쪽으로 넓어지는 등 · 적은 측면':null,p.expressed.sable?'밝은 크라운 군집 · 어두운 바탕':null].filter(Boolean) as string[]};
}
export const morphLabel=(g:Genome)=>{const e=bPhenotype(g).expressed;return [e.lilly?'릴리화이트':'',e.axanthic?'아잔틱':'',e.cappuccino?'카푸치노':'',e.highway?'하이웨이':'',e.sable?'세이블':''].filter(Boolean).join(' + ')||'노멀';};
