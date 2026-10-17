import type {Genome,Feature} from '@/genetics/advanced/model';
import {FEATURES} from '@/genetics/advanced/model';
import {inherit} from '@/genetics/advanced/inheritance';
import {inheritPoly,founderPoly} from '@/genetics/advanced/polygenic';
import {fixtureGenome,MORPHS,type MorphId} from '@/engine/regional/fixtures';
import {randomFor} from '@/engine/random';
import {bPhenotype,morphLabel} from './phenotype';
export const CORE_MORPHS=MORPHS.slice(0,6);
export const LEVELS=[{id:'low',label:'저발현'},{id:'typical',label:'일반 발현'},{id:'high',label:'고발현'}] as const;
export const CROSSINGS=[{id:'lilly',label:'릴리 × 노멀',description:'백색 피복과 체색의 연결감을 봅니다. 릴리 여부도 실제 상속 결과입니다.'},{id:'axanthic',label:'아잔틱 × 아잔틱',description:'두 부모의 밝기·무늬가 자손에서 어떻게 섞이는지 봅니다.'},{id:'complex',label:'카푸치노 × 하이웨이',description:'꼬리·등 특징의 분리와 복합 표현을 봅니다. 복합 외형은 잠정 게임 모델입니다.'}] as const;
export type CrossingId=typeof CROSSINGS[number]['id'];
export const CONDITIONS=[{id:'diverse',label:'다른 유전 배경 · 4마리'},{id:'brightness',label:'밝음 / 어두움'},{id:'pattern',label:'패턴 적음 / 많음'},{id:'seed',label:'같은 유전체 · 다른 배치'}] as const;
export type ConditionId=typeof CONDITIONS[number]['id'];
export interface Example {id:string;name:string;genome:Genome;seed:string;parents:readonly [string,string]|null;generation:number}
/** Independent legal fixture genomes, NOT edited player records or promises of
 * exact breeding grades. All six morphs share these same four modifier recipes. */
export function diverseGenome(morph:MorphId,n:number):Genome {
 const g=fixtureGenome('typical',morph),rng=randomFor('b-diversity-'+n,'legal-modifiers');
 const recipes:Record<Feature,readonly [number,number]>={red:n===1?[2,4]:[0,3],orange:n===1?[2,4]:[1,3],brightness:n===0?[0,2]:n===1?[2,4]:[1,3],cream:n===2?[3,4]:[1,3],dorsal:n===2?[3,4]:[1,4],flank:n===2?[2,4]:[0,4],harlequin:n===2?[2,4]:[0,4],pinstripe:n===2?[3,4]:[1,3],contrast:n===2?[3,4]:[1,4],spots:[0,1]};
 for(const f of FEATURES)for(let j=0;j<6;j++){const pool=recipes[f];g.polygenic.loci[f+'-'+j]=[pool[rng()<.5?0:1],pool[rng()<.5?0:1]];}
 return g;
}
export function conditionExamples(morph:MorphId,condition:ConditionId,seed:string){
 if(condition==='diverse')return Array.from({length:4},(_,n)=>({label:'개체 '+(n+1),genome:diverseGenome(morph,n),seed:seed+':variety-'+n}));
 if(condition==='seed')return Array.from({length:4},(_,n)=>({label:'배치 '+(n+1),genome:fixtureGenome('typical',morph),seed:seed+':placement-'+n}));
 return [0,4].map((allele,n)=>{
  const genome=fixtureGenome('typical',morph),features:Feature[]=condition==='brightness'?['brightness']:['cream','dorsal','flank','harlequin','pinstripe'];
  for(const f of features)for(let i=0;i<6;i++)genome.polygenic.loci[f+'-'+i]=[allele,allele];
  return {label:condition==='brightness'?(n?'밝은 개체':'어두운 개체'):(n?'패턴 많음':'패턴 적음'),genome,seed};
 });
}
const example=(id:string,genome:Genome,seed=id,generation=0,parents:Example['parents']=null):Example=>({id,name:morphLabel(genome),genome,seed,generation,parents});
/** Existing production transmission functions, invoked on transient lab data.
 * No reroll, pixel selection, target morph assignment or genotype averaging. */
export function childOf(father:Example,mother:Example,seed:string):Example {
 return example(seed,{version:1,mendelian:inherit(father.genome.mendelian,mother.genome.mendelian,seed),polygenic:inheritPoly(father.genome.polygenic,mother.genome.polygenic,seed)},seed,Math.max(father.generation,mother.generation)+1,[father.id,mother.id]);
}
export function family(id:CrossingId,seed='b-breeding-01'){
 const father=example(id+'-father',diverseGenome(id==='complex'?'cappuccino':id,0));
 const mother=example(id+'-mother',diverseGenome(id==='complex'?'highway':id==='lilly'?'normal':'axanthic',id==='axanthic'?1:2));
 if(id==='lilly'){father.genome.mendelian.loci.axanthic=['A','ax'];mother.genome.mendelian.loci.axanthic=['A','ax'];}
 return {father,mother,children:Array.from({length:4},(_,n)=>childOf(father,mother,seed+':'+id+':child-'+n))};
}
const score=(g:Genome)=>{const s=bPhenotype(g).scores;return s.cream*.35+s.dorsal*.25+s.pinstripe*.25+s.contrast*.15;};
export interface SelectionGeneration {generation:number;parents:Example[];children:Example[];selected:Example[];mean:number}
let selection:SelectionGeneration[]|undefined;
/** Fixed n/H at every displayed generation isolates modifier accumulation from
 * dosage changes. All children are kept in the evidence; only breeders selected
 * from a cohort are used as next parents. No mutation or strengthened alleles. */
export function selectionStudy(){
 if(selection)return selection;
 const founders=Array.from({length:12},(_,n)=>{
  const genome=fixtureGenome('typical','highway');genome.polygenic=founderPoly('B-selection-founder-'+n);
  return example('B-founder-'+n,genome);
 });
 const choose=(pool:Example[])=>pool.filter(g=>g.genome.mendelian.loci['cappuccino-complex'].includes('n')&&g.genome.mendelian.loci['cappuccino-complex'].includes('H')).toSorted((a,b)=>score(b.genome)-score(a.genome)).slice(0,2);
 let parents=choose(founders);const history:SelectionGeneration[]=[{generation:0,parents:[],children:founders,selected:parents,mean:founders.reduce((s,g)=>s+score(g.genome),0)/founders.length}];
 for(let generation=1;generation<=5;generation++){
  const children=Array.from({length:48},(_,n)=>childOf(parents[0],parents[1],'B-selection-g'+generation+'-child-'+n)),selected=choose(children);
  if(selected.length<2)throw Error('선별교배 표본에 n/H 두 마리가 필요합니다.');
  history.push({generation,parents,children,selected,mean:children.reduce((s,g)=>s+score(g.genome),0)/children.length});parents=selected;
 }
 selection=history;return selection;
}
