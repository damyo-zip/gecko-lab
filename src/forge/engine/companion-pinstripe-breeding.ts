import {createCompanionDalmatianFounder,createCompanionDalmatianOffspring,COMPANION_DALMATIAN_PRESETS,emptyCompanionDalmatianWorkspace,importCompanionDalmatianWorkspace,type CompanionDalmatianPresetId} from './companion-dalmatian-v3-breeding';
import {COMPANION_PINSTRIPE_RENDERER_ID,pinstripeStrengthFromScore,buildPinstripeMask} from './companion-pinstripe';
import {importWorkspace} from './workspace';
import {POLY_CONFIG,seededRandom} from './genetics';
import {viability,type FounderInput} from './individual';
import type {ForgeGecko} from './model';
import type {ColourPresetId} from './patternless-breeding';
const recipes=[
 {id:'partial-pinstripe',name:'부분 핀',colour:'orange',base:'flame',total:36},
 {id:'near-full-pinstripe',name:'니어 풀 핀',colour:'orange',base:'flame',total:42},
 {id:'full-pinstripe',name:'풀 핀',colour:'orange',base:'flame',total:46},
 {id:'harlequin-pinstripe',name:'할리퀸 핀스트라이프',colour:'orange',base:'harlequin',total:40},
 {id:'dalmatian-pinstripe',name:'달마시안 핀스트라이프',colour:'yellow',base:'dalmatian',total:40},
 {id:'axanthic-pinstripe',name:'아잔틱 핀스트라이프',colour:'orange',base:'axanthic',total:40},
 {id:'lilly-pinstripe',name:'릴리 핀스트라이프',colour:'orange',base:'lilly',total:40},
] as const;
export const COMPANION_PINSTRIPE_PRESETS=[...COMPANION_DALMATIAN_PRESETS,...recipes] as const;
export type CompanionPinstripePresetId=typeof COMPANION_PINSTRIPE_PRESETS[number]['id'];
function setPinAlleles(g:ForgeGecko,total:number){
 const indices=[0,1,2,3,4,5],rng=seededRandom(g.creationSeed,'companion:pinstripe-founder:1');
 for(let i=5;i>0;i--){const j=Math.floor(rng()*(i+1));[indices[i],indices[j]]=[indices[j],indices[i]];}
 for(const [rank,n] of indices.entries())g.genome.polygenic.loci[`pinstripe-${n}`]=total>=42?(rank<total-42?[4,4]:[3,4]):(rank<total-36?[3,4]:[3,3]);
}
export function createCompanionPinstripeFounder(input:Omit<FounderInput,'mendelian'>&{morph:CompanionPinstripePresetId;colour?:ColourPresetId}){
 const recipe=recipes.find(r=>r.id===input.morph),g=createCompanionDalmatianFounder({...input,morph:(recipe?.base??input.morph) as CompanionDalmatianPresetId,colour:input.colour??recipe?.colour});
 if(recipe)setPinAlleles(g,recipe.total);return g;
}
export const createCompanionPinstripeOffspring=createCompanionDalmatianOffspring;
export function emptyCompanionPinstripeWorkspace(){const b=emptyCompanionDalmatianWorkspace();b.rendererVersion=COMPANION_PINSTRIPE_RENDERER_ID;b.breedingSeed='pinstripe-cross-1';return b;}
export function starterCompanionPinstripeWorkspace(){
 const b=emptyCompanionPinstripeWorkspace();b.individuals=[
  createCompanionPinstripeFounder({id:'C-0001',seed:'pinstripe-gold-1',morph:'near-full-pinstripe',sex:'male',name:'금실'}),
  createCompanionPinstripeFounder({id:'C-0002',seed:'pinstripe-silk-1',morph:'near-full-pinstripe',sex:'female',name:'비단',colour:'brown'}),
  createCompanionPinstripeFounder({id:'C-0003',seed:'pinstripe-piece-1',morph:'partial-pinstripe',sex:'male',name:'조각',colour:'yellow'}),
  createCompanionPinstripeFounder({id:'C-0004',seed:'pinstripe-pepper-1',morph:'dalmatian-pinstripe',sex:'female',name:'후추'}),
  createCompanionPinstripeFounder({id:'C-0005',seed:'pinstripe-silver-1',morph:'axanthic-pinstripe',sex:'male',name:'은실'}),
  createCompanionPinstripeFounder({id:'C-0006',seed:'pinstripe-snow-1',morph:'lilly-pinstripe',sex:'female',name:'설백'}),
 ];setPinAlleles(b.individuals[1],44);b.nextId=7;b.selectedId=b.fatherId='C-0001';b.motherId='C-0002';return b;
}
export function importCompanionPinstripeWorkspace(json:string){
 const parsed=importWorkspace(json),b=parsed.rendererVersion===COMPANION_PINSTRIPE_RENDERER_ID
  ?importCompanionDalmatianWorkspace(JSON.stringify({...parsed,rendererVersion:'b-origin-01-companion-dalmatian-3'})):importCompanionDalmatianWorkspace(json);
 b.rendererVersion=COMPANION_PINSTRIPE_RENDERER_ID;return b;
}
/** Exact DP over the 4 equally likely copy choices at each of six existing loci. */
export function forecastPinstripe(father:ForgeGecko,mother:ForgeGecko){
 if(!viability(father.genome).viable||!viability(mother.genome).viable||father.sex!=='male'||mother.sex!=='female'||father.id===mother.id)throw Error('생존 수컷·암컷 부모를 선택하세요.');
 let distribution=new Map([[0,1]]);
 for(let n=0;n<6;n++){
  const next=new Map<number,number>();for(const [sum,p] of distribution)for(const f of father.genome.polygenic.loci[`pinstripe-${n}`])for(const m of mother.genome.polygenic.loci[`pinstripe-${n}`]){
   const value=sum+POLY_CONFIG.alleleEffects[f]+POLY_CONFIG.alleleEffects[m];next.set(value,(next.get(value)??0)+p/4);
  }distribution=next;
 }
 const outcomes=[...distribution].sort((a,b)=>a[0]-b[0]).map(([effect,p])=>{
  const score=1/(1+Math.exp(-(POLY_CONFIG.intercept.pinstripe+POLY_CONFIG.additiveScale*effect/Math.sqrt(12)))),strength=pinstripeStrengthFromScore(score),metrics=buildPinstripeMask(strength,0).metrics;
  return {effect,probability:p,strength,coverage:metrics.coverage,classification:metrics.classification};
 });
 return {outcomes,fullProbability:outcomes.filter(o=>o.classification==='full').reduce((s,o)=>s+o.probability,0),
  meanCoverage:outcomes.reduce((s,o)=>s+o.coverage*o.probability,0),minimumCoverage:outcomes[0].coverage,maximumCoverage:outcomes.at(-1)!.coverage};
}
