import {createVeilTraits,withVeilTraits} from '@/forge';
import {forgeReferenceGecko} from './challenge-previews';
import {inspectChallenge} from './challenge-observation';
import type {CurrentChallengeId} from './challenge-rules';
import {cachedGenotype} from './genetics';
import {polyScores} from '@/genetics/advanced/polygenic';
import {legacyTraits} from '@/genetics/advanced/phenotype';
import type {Gecko} from './model';

export interface ChallengeExample {gecko:Gecko;accepted:boolean;reason:string}
const cache=new Map<CurrentChallengeId,ChallengeExample[]>();
/** View-only examples. No save, new animal, breeding action or player RNG. */
export function challengeExamples(id:CurrentChallengeId):ChallengeExample[]{
 const previous=cache.get(id);if(previous)return previous;
 const g=forgeReferenceGecko(id),examples:ChallengeExample[]=[{gecko:g,accepted:true,reason:'목표 외형'}];
 for(let n=0;n<24;n++){
  const other=structuredClone(g);other.visualSeed+=':accepted:'+n;
  if(inspectChallenge(other,id).passed){examples.push({gecko:other,accepted:true,reason:'다른 무늬 배치도 인정'});break;}
 }
 for(let n=0;n<2;n++){
  const bad=structuredClone(g),genome=bad.genetics!.genome!;
  const feature=(name:string,a:number)=>{for(let i=0;i<6;i++)genome.polygenic.loci[name+'-'+i]=[a,a];};
  const veil=(density:number)=>{bad.genetics!.forge!.extensions=withVeilTraits(bad.genetics!.forge!.extensions,createVeilTraits('challenge-example:'+id,density));};
  switch(id){
   case 'lilly-dalmatian':if(n===0)feature('spots',0);else veil(.5);break;
   case 'halloween':if(n===0)feature('brightness',3);else bad.genetics!.forge!.patternColour!.warmth=Array.from({length:6},()=>[0,0]);break;
   case 'red-tricolor':if(n===0)genome.mendelian.loci.axanthic=['ax','ax'];else {feature('red',0);feature('orange',1);}break;
   case 'sable-lilly':if(n===0)veil(1);else genome.mendelian.loci['cappuccino-complex']=['n','n'];break;
   case 'gold-tiger':if(n===0)feature('dorsal',0);else {feature('red',4);feature('orange',4);}break;
   case 'red-superdalmatian':if(n===0)feature('spots',0);else genome.mendelian.loci.axanthic=['ax','ax'];break;
   case 'frappuccino':if(n===0)veil(1);else genome.mendelian.loci['cappuccino-complex']=['n','n'];break;
   case 'tricolor-superstripe':if(n===0)feature('pinstripe',0);else bad.genetics!.forge!.patternColour!.warmth=Array.from({length:6},()=>[4,4]);break;
  }
  bad.genotype=cachedGenotype(bad.genetics!,bad.genotype);bad.potential=legacyTraits(polyScores(genome.polygenic));
  const result=inspectChallenge(bad,id);
  if(result.passed)throw new Error('불인정 예시가 도전 기준을 통과했습니다: '+id);
  examples.push({gecko:bad,accepted:false,reason:result.checks.filter(c=>!c.passed).map(c=>c.label).join(' · ')});
 }
 cache.set(id,examples);return examples;
}
