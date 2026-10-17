import type {Genome,Feature} from '@/genetics/advanced/model';
import {fixtureGenome} from '@/engine/regional/fixtures';
import {founderPoly,inheritPoly} from '@/genetics/advanced/polygenic';
import {inherit} from '@/genetics/advanced/inheritance';
import {LOCI,pairKey} from '@/genetics/advanced/loci';
import {idealTraits,type Expression} from './traits';
import type {Morph,Channel} from './art';
export const LAB_SEED='b-ideal-inverse-01';
export const LEVELS=['이상형에 매우 가까움','일부 특징 부족','중간 발현','여러 특징 부족','낮은 표현 강도'] as const;
const pattern:Feature[]=['cream','dorsal','flank','harlequin','contrast','pinstripe'];
type Pair=readonly [number,number];
function set(g:Genome,features:readonly Feature[],pair:Pair,start=0,end=6){for(const f of features)for(let i=start;i<end;i++)g.polygenic.loci[f+'-'+i]=[...pair];return g;}
/** These are explanatory legal allele recipes, NOT edited offspring, estimated
 * natural percentiles or a hidden renderer-only quality parameter. */
export function controlGenome(morph:Morph,level:number):Genome {
 const pairs:readonly Pair[]=[[4,4],[3,4],[3,3],[2,3],[1,2]];if(!pairs[level])throw Error('Unknown control level');
 return set(fixtureGenome('typical',morph),pattern,pairs[level]);
}
export function deficitExamples(morph:Morph){
 const make=(label:string,apply:(g:Genome)=>void)=>{const genome=controlGenome(morph,0);apply(genome);return {label,genome,seed:LAB_SEED+':deficits'};};
 return [
  make(morph==='sable'?'크라운 부족':morph==='cappuccino'?'꼬리 대비 부족':'피복 범위 부족',g=>{if(morph==='sable')set(g,['cream'],[0,1],3);else if(morph==='cappuccino')set(g,['contrast'],[0,1],3);else set(g,['cream','flank'],[1,2]);}),
  make(morph==='lilly'?'피복은 높고 연결은 약함':'연결 단절',g=>{set(g,['harlequin'],[0,1],0,3);set(g,['pinstripe'],[0,1]);}),
  make('대비 부족',g=>{set(g,['contrast'],[0,1]);}),
  make('서로 다른 특징의 복합 부족',g=>{set(g,['cream','dorsal'],[2,2]);set(g,['flank','harlequin','pinstripe'],[1,2]);set(g,['contrast'],[2,3]);})
 ];
}
export function brightnessExamples(morph:Morph){return [0,4].map((n,i)=>({label:i?'밝은 명도':'어두운 명도',genome:set(controlGenome(morph,1),['brightness'],[n,n]),seed:LAB_SEED+':lightness'}));}
export interface LabIndividual {id:string;genome:Genome;seed:string;generation:number;parents:readonly [string,string]|null;viable:boolean}
function individual(genome:Genome,id:string,generation=0,parents:LabIndividual['parents']=null):LabIndividual {
 const viable=LOCI.every(l=>!l.nonViable.includes(pairKey(genome.mendelian.loci[l.id],l)));
 return {id,genome,seed:id,generation,parents,viable};
}
/** The real, unmodified transmission functions. No retries to improve a child,
 * genotype averaging, mutation, skipped weak siblings or assigned morph names. */
export function offspring(father:LabIndividual,mother:LabIndividual,seed:string){
 return individual({version:1,mendelian:inherit(father.genome.mendelian,mother.genome.mendelian,seed),polygenic:inheritPoly(father.genome.polygenic,mother.genome.polygenic,seed)},seed,Math.max(father.generation,mother.generation)+1,[father.id,mother.id]);
}
export function inheritanceFamily(morph:Morph,seed=LAB_SEED){
 const fatherGenome=controlGenome(morph,1),motherGenome=controlGenome(morph==='lilly'?'normal':morph,3);
 // Heterozygous modifier pairs leave visible segregation in the first siblings.
 set(fatherGenome,['cream','flank'],[2,4]);set(motherGenome,['dorsal','contrast'],[1,4]);
 const father=individual(fatherGenome,seed+':'+morph+':father'),mother=individual(motherGenome,seed+':'+morph+':mother');
 return {father,mother,children:Array.from({length:6},(_,n)=>offspring(father,mother,seed+':'+morph+':sibling-'+n))};
}
export const TARGET_CHANNELS:Record<Morph,readonly (Channel|'contrast')[]>={normal:['cream','dorsal','flank','bridge','tail'],lilly:['cream','flank','face','bridge','balance'],axanthic:['contrast','dorsal','flank','bridge'],cappuccino:['tail','contrast','dorsal'],highway:['dorsal','stripe','tail'],sable:['crown','cream','contrast','flank']};
/** Fitness is used ONLY by the simulated breeder to select parents. Rendering
 * never reads this scalar; it separately reads every trait and region. */
export function selectionValue(expression:Expression,morph:Morph){const values=TARGET_CHANNELS[morph].map(k=>expression[k]);return values.reduce((a,b)=>a+b,0)/values.length*.8+Math.min(...values)*.2;}
export interface Generation {generation:number;parents:LabIndividual[];children:LabIndividual[];selected:LabIndividual[];eligible:number;nonViable:number;mean:number;min:number;max:number}
const selectionCache=new Map<string,Generation[]>();
export function breedingHistory(morph:Morph,seed=LAB_SEED){
 const key=morph+':'+seed,old=selectionCache.get(key);if(old)return old;
 const founders=Array.from({length:20},(_,n)=>{const genome=fixtureGenome('typical',morph);genome.polygenic=founderPoly(seed+':'+morph+':founder-'+n);return individual(genome,seed+':'+morph+':founder-'+n);});
 const eligible=(g:LabIndividual)=>g.viable&&idealTraits(g.genome).morph===morph;
 const score=(g:LabIndividual)=>selectionValue(idealTraits(g.genome).expression,morph);
 const record=(generation:number,parents:LabIndividual[],children:LabIndividual[]):Generation=>{
  const pool=children.filter(eligible),ranked=pool.toSorted((a,b)=>score(b)-score(a)),values=pool.map(score);
  if(pool.length<2)throw Error('Two eligible parents needed for lab selection');
  return {generation,parents,children,selected:ranked.slice(0,2),eligible:pool.length,nonViable:children.filter(g=>!g.viable).length,mean:values.reduce((a,b)=>a+b,0)/values.length,min:Math.min(...values),max:Math.max(...values)};
 };
 const history:Generation[]=[record(0,[],founders)];
 for(let generation=1;generation<=6;generation++){const parents=history.at(-1)!.selected,children=Array.from({length:48},(_,n)=>offspring(parents[0],parents[1],seed+':'+morph+':g'+generation+':child-'+n));history.push(record(generation,parents,children));}
 selectionCache.set(key,history);if(selectionCache.size>8)selectionCache.delete(selectionCache.keys().next().value!);return history;
}
