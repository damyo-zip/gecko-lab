import type {Genome,Feature} from '@/genetics/advanced/model';
import {polyScores,POLY_CONFIG} from '@/genetics/advanced/polygenic';
import {regionalPhenotype} from '@/engine/regional/phenotype';
import {fixtureGenome} from '@/engine/regional/fixtures';
import type {Channel,Morph} from './art';
export const unit=(v:number)=>Math.max(0,Math.min(1,v));
const range=(v:number,a=.1,b=.9)=>unit((v-a)/(b-a));
const ref=polyScores(fixtureGenome('typical','normal').polygenic);
export type Expression=Record<Channel,number>&{brightness:number;contrast:number;red:number;orange:number};
export const IDEAL_EXPRESSION:Expression={cream:1,dorsal:1,flank:1,limbs:1,bridge:1,stripe:1,face:1,crown:1,tail:1,balance:1,brightness:.5,contrast:1,red:0,orange:0};
/** Existing virtual alleles only. Pleiotropic subgroups are explicit VISUAL
 * hypotheses, not identified face/bridge/crown genes. No phenotype name, seed
 * or whole-genome distance enters these independent feature channels. */
export function idealTraits(genome:Genome){
 const p=regionalPhenotype(genome),s=p.scores;
 const subgroup=(f:Feature,start:number,end:number)=>{
  let n=0;for(let i=start;i<end;i++)for(const a of genome.polygenic.loci[f+'-'+i])n+=POLY_CONFIG.alleleEffects[a];
  return 1/(1+Math.exp(-n*1.3/Math.sqrt(2*(end-start))));
 };
 const expression:Expression={cream:range(s.cream,.06,.79),dorsal:range(s.dorsal,.12,.9),flank:range(s.flank,.08,.84),
  limbs:range(s.harlequin*.65+s.flank*.35,.08,.9),bridge:range(subgroup('harlequin',0,3)),stripe:range(s.pinstripe,.12,.9),
  face:range(subgroup('cream',0,3),.1,.92),crown:range(subgroup('cream',3,6)*.65+s.dorsal*.35,.15,.9),
  tail:range(subgroup('contrast',3,6)*.5+s.dorsal*.5),balance:range(subgroup('flank',3,6)),
  brightness:s.brightness,contrast:range(s.contrast,.12,.9),red:s.red-ref.red,orange:s.orange-ref.orange};
 const e=p.expressed;
 const morph:Morph=e.lilly?'lilly':e.axanthic?'axanthic':e.sable?'sable':e.highway?'highway':e.cappuccino?'cappuccino':'normal';
 return {expression,morph,expressed:e,scores:s,composite:Object.values(e).filter(Boolean).length>1};
}
