import { expandedGenotype } from "@/genetics/hardcore";
import type { Genotype } from "@/genetics/mendel";
import { cross } from "@/genetics/advanced/inheritance";
import {inherit,inheritPoly,founderPoly} from '@/forge';
import {founderForge,inheritForge} from './forge-genetics';
import { belief, childKnowledge, condition, inferFamily, priorCross, unknownKnowledge } from "@/genetics/advanced/inference";
import { LOCI, pairKey, wildGenome } from "@/genetics/advanced/loci";
import type { GeneticsRecord, Knowledge, Scores } from "@/genetics/advanced/model";
import { observedLoci } from "@/genetics/advanced/phenotype";
import { polyScores } from "@/genetics/advanced/polygenic";
import type { Gecko, HardcoreGame, Mating,TimedEgg } from "./model";
import { seededRandom } from '@/genetics/random';

/** Existing explicit loci remain recorded; missing Ax/virtual alleles are NOT reconstructed. */
export function legacyRecord(g:Pick<Gecko,"genotype">):GeneticsRecord {
  const knowledge=unknownKnowledge();for(const l of LOCI){const pair=g.genotype.loci[l.id];
    if(pair)knowledge.loci[l.id]=belief({[pairKey(pair,l)]:1},"legacy","이전 게임에 명시된 유전형 · 가상 외형 대립유전자는 복원 불가");
  }return {version:1,genome:null,knowledge,appearanceVersion:"legacy-1"};
}
export const publicKnowledge=(g:Gecko):Knowledge=>g.genetics?.knowledge??legacyRecord(g).knowledge;
export function founderRecord(genotype:Genotype,seed:string,subdued=false,appearanceVersion:"5.0"|"patterns-1"="patterns-1",forgeProfile?:number):GeneticsRecord {
  const mendelian=wildGenome();Object.assign(mendelian.loci,expandedGenotype(genotype).loci);
  const genome={version:1 as const,mendelian,polygenic:founderPoly(seed,subdued)},knowledge=unknownKnowledge();
  for(const l of LOCI)knowledge.loci[l.id]=belief({[pairKey(mendelian.loci[l.id],l)]:1},"seller","판매자 제공 게임 유전 기록");
  return {version:1,genome,knowledge,appearanceVersion,...(forgeProfile===undefined?{}:{forge:founderForge(seed,forgeProfile,subdued)})};
}
export function offspringRecord(father:GeneticsRecord,mother:GeneticsRecord,genotype:Genotype|null,seed:string,id:string,newPatterns=false,allowPartial=false,paletteVersion?:2|null):GeneticsRecord {
  const forge=inheritForge(father.forge,mother.forge,seed,paletteVersion);
  if(!father.genome||!mother.genome){
    if(!genotype)throw new Error('이전 부모의 기본 유전 상속 기록이 필요합니다.');
    const result=legacyRecord({genotype});if(forge)result.forge=forge;
    const seen:Record<string,string>={};for(const l of LOCI){const pair=genotype.loci[l.id];if(pair)seen[l.id]=l.phenotypes[pairKey(pair,l)];}
    if(allowPartial){
      const rng=seededRandom(seed,'advanced-locus:cappuccino-complex');
      const f=father.genome?.mendelian.loci['cappuccino-complex']??father.unresolvedComplex??[null,null];
      const m=mother.genome?.mendelian.loci['cappuccino-complex']??mother.unresolvedComplex??[null,null];
      result.unresolvedComplex=[f[rng()<.5?0:1],m[rng()<.5?0:1]];
      if(result.unresolvedComplex.every(a=>a!==null))seen['cappuccino-complex']=LOCI[2].phenotypes[pairKey(result.unresolvedComplex as readonly [string,string],LOCI[2])];
    }
    result.knowledge=genotype.loci['lilly-white'].every(a=>a==='Lw')?unknownKnowledge():childKnowledge(father.knowledge,mother.knowledge,seen,id);return result;
  }
  const genome={version:1 as const,mendelian:inherit(father.genome.mendelian,mother.genome.mendelian,seed),polygenic:inheritPoly(father.genome.polygenic,mother.genome.polygenic,seed)};
  const nonViable=LOCI.some(l=>l.nonViable.includes(pairKey(genome.mendelian.loci[l.id],l)));
  return {version:1,genome,...(forge?{forge}:{}),knowledge:nonViable?unknownKnowledge():childKnowledge(father.knowledge,mother.knowledge,observedLoci(genome),id),
    appearanceVersion:newPatterns||father.appearanceVersion==="patterns-1"||mother.appearanceVersion==="patterns-1"?"patterns-1":"5.0"};
}
export function cachedGenotype(record:GeneticsRecord,fallback:Genotype):Genotype {
  return record.genome?{modelVersion:1,loci:{"lilly-white":record.genome.mendelian.loci["lilly-white"],axanthic:record.genome.mendelian.loci.axanthic}}:fallback;
}
/** UI odds integrate only the player's beliefs. Unknown priors stay unknown. */
export function publicForecast(father:Knowledge,mother:Knowledge) {
  return LOCI.map(l=>{const f=father.loci[l.id].probabilities,m=mother.loci[l.id].probabilities;
    if(!f||!m)return {locus:l,outcomes:null};
    const p=priorCross(f,m,l),survival=Object.entries(p).filter(([k])=>!l.nonViable.includes(k)).reduce((s,[,v])=>s+v,0);
    return {locus:l,outcomes:Object.entries(p).map(([key,probability])=>({key,probability,phenotype:l.phenotypes[key],safe:!l.blocked.includes(key),viableProbability:l.nonViable.includes(key)||survival===0?0:probability/survival}))};
  });
}
export function advancedSafety(father:Gecko,mother:Gecko):string[] {
  const f=father.genetics?.genome,m=mother.genetics?.genome;
  if(f&&m&&cross(f.mendelian,m.mendelian).blockedProbability>0)return ["건강 위험 대립유전자 조합을 차단합니다. 잠정 좌위의 위험은 사망 확률이 아닙니다."];
  if((f&&!m&&f.mendelian.loci["cappuccino-complex"].some(a=>a!=="n"))||(m&&!f&&m.mendelian.loci["cappuccino-complex"].some(a=>a!=="n")))return ["이전 개체의 복합 좌위가 미확인입니다. 안전 정책에 따라 교배를 차단합니다."];
  return [];
}
/** Observe only successfully hatched, visible phenotypes, exactly once per clutch.
 * Parents are jointly enumerated within this family; separate families use current
 * marginal priors (not a claim of an exact full-pedigree Bayesian network).
 */
export function observeMating(game:HardcoreGame,mating:Mating,eggs:readonly TimedEgg[]=Object.values(game.eggs)):void {
  const log=mating.genetics;if(!log)return;
  const children=eggs.filter(e=>e.matingId===mating.id&&e.status==="hatched"&&!log.observedIds.includes(e.embryo.id));
  if(!children.length)return;
  const father=game.individuals[mating.parents.fatherId],mother=game.individuals[mating.parents.motherId];
  const before=[structuredClone(publicKnowledge(father)),structuredClone(publicKnowledge(mother))],after=structuredClone(before);
  const l=LOCI.find(l=>l.id==="axanthic")!,f=before[0].loci[l.id].probabilities,m=before[1].loci[l.id].probabilities;
  const observations=children.map(e=>e.embryo.genotype.loci.axanthic?.every(a=>a==="ax")?"Axanthic":"Normal");
  if(f&&m){
    const result=inferFamily(f,m,l,observations);
    [result.father,result.mother].forEach((p,i)=>after[i].loci[l.id]=belief(p,"offspring","부화한 자손 외형으로 베이즈 갱신 · 몇 번 미발현했다고 비보인자 확정하지 않음",[...new Set([...before[i].loci[l.id].evidenceIds,...children.map(e=>e.embryo.id)])].slice(-1000)));
  }
  else if(observations.includes("Axanthic")){
    [father,mother].forEach((parent,i)=>after[i].loci[l.id]=belief({[parent.genotype.loci.axanthic?.every(a=>a==="ax")?"ax/ax":"A/ax"]:1},"offspring","열성 외형 자손으로 열성 사본 확인",children.map(e=>e.embryo.id)));
  }
  if(f&&m||observations.includes("Axanthic"))[father,mother].forEach((parent,i)=>{parent.genetics??=legacyRecord(parent);parent.genetics.knowledge=after[i];log.updates.push({id:parent.id,before:before[i],after:structuredClone(after[i])});});
  log.observedIds.push(...children.map(e=>e.embryo.id));
}
export function traitForecast(father:Gecko,mother:Gecko):{min:Scores;max:Scores}|null {
  const f=father.genetics?.genome?.polygenic,m=mother.genetics?.genome?.polygenic;if(!f||!m)return null;
  const scores=Array.from({length:128},(_,i)=>polyScores(inheritPoly(f,m,"preview|"+father.id+"|"+mother.id+"|"+i)));
  const keys=Object.keys(scores[0]) as (keyof Scores)[];
  return {min:Object.fromEntries(keys.map(k=>[k,Math.min(...scores.map(s=>s[k]))])) as Scores,max:Object.fromEntries(keys.map(k=>[k,Math.max(...scores.map(s=>s[k]))])) as Scores};
}
export function inheritedPossibleHet(father:Knowledge,mother:Knowledge):number|null {
  const f=father.loci.axanthic.probabilities,m=mother.loci.axanthic.probabilities;
  if(!f||!m)return null;const p=priorCross(f,m,LOCI[1]);if(!(p["A/A"]||p["A/ax"]))return null;
  return condition(p,LOCI[1],"Normal")["A/ax"]??0;
}
