import { createCompanionPigmentFounder, createCompanionPigmentOffspring, COMPANION_PIGMENT_PRESETS, assertCompanionPigmentGenome, emptyCompanionPigmentWorkspace, importCompanionPigmentWorkspace, type CompanionPigmentPresetId } from './companion-pigment-breeding';
import { COMPANION_DALMATIAN_RENDERER_ID } from './companion-dalmatian';
import { importWorkspace } from './workspace';
import { seededRandom } from './genetics';
import { editFeature } from './editing';
import { viability, type FounderInput } from './individual';
import type { ColourPresetId } from './patternless-breeding';

const recipes=[
  {id:'dalmatian-large',name:'큰 반점 소수형',colour:'orange',density:2.7,size:3.8,base:'base'},
  {id:'dalmatian',name:'달마시안',colour:'yellow',density:3.35,size:2.0,base:'base'},
  {id:'super-dalmatian',name:'고밀도 달마시안',colour:'orange',density:3.95,size:1.6,base:'base'},
  {id:'lilly-dalmatian',name:'릴리 달마시안',colour:'orange',density:3.35,size:2.0,base:'lilly'},
  {id:'axanthic-dalmatian',name:'아잔틱 달마시안',colour:'orange',density:3.35,size:2.0,base:'axanthic'},
  {id:'lilly-axanthic-dalmatian',name:'릴리 아잔틱 달마시안',colour:'orange',density:3.35,size:2.0,base:'lilly-axanthic'},
] as const;
export const COMPANION_DALMATIAN_PRESETS=[...COMPANION_PIGMENT_PRESETS,...recipes] as const;
export type CompanionDalmatianPresetId=typeof COMPANION_DALMATIAN_PRESETS[number]['id'];
export function createCompanionDalmatianFounder(input:Omit<FounderInput,'mendelian'>&{morph:CompanionDalmatianPresetId;colour?:ColourPresetId}) {
  const recipe=recipes.find(p=>p.id===input.morph);
  const g=createCompanionPigmentFounder({...input,morph:recipe?.base??input.morph as CompanionPigmentPresetId,colour:input.colour??recipe?.colour??'orange'});
  if(recipe){
    g.genome=editFeature(editFeature(g.genome,'flank',0),'harlequin',0);
    for(const [feature,mean] of [['spots',recipe.density],['contrast',recipe.size]] as const)for(let n=0;n<6;n++){
      const rng=seededRandom(input.seed,`companion:dalmatian-founder:${feature}-${n}`),allele=()=>Math.max(0,Math.min(4,Math.round(mean+(rng()-.5)*1.4)));
      g.genome.polygenic.loci[`${feature}-${n}`]=[allele(),allele()];
    }
  }else g.genome=editFeature(g.genome,'spots',0);
  return g;
}
export const createCompanionDalmatianOffspring=createCompanionPigmentOffspring;
export function emptyCompanionDalmatianWorkspace(){const b=emptyCompanionPigmentWorkspace();b.rendererVersion=COMPANION_DALMATIAN_RENDERER_ID;b.breedingSeed='dalmatian-cross-1';return b;}
export function starterCompanionDalmatianWorkspace(){
  const b=emptyCompanionDalmatianWorkspace();
  b.individuals=[
    createCompanionDalmatianFounder({id:'C-0001',seed:'dalmatian-cocoa-1',morph:'dalmatian-large',sex:'male',name:'코코'}),
    createCompanionDalmatianFounder({id:'C-0002',seed:'dalmatian-pepper-1',morph:'dalmatian',sex:'female',name:'후추'}),
    createCompanionDalmatianFounder({id:'C-0003',seed:'dalmatian-dense-1',morph:'super-dalmatian',sex:'male',name:'깨비'}),
    createCompanionDalmatianFounder({id:'C-0004',seed:'dalmatian-milk-1',morph:'lilly-dalmatian',sex:'female',name:'우유'}),
    createCompanionDalmatianFounder({id:'C-0005',seed:'dalmatian-ink-1',morph:'axanthic-dalmatian',sex:'male',name:'잉크'}),
    createCompanionDalmatianFounder({id:'C-0006',seed:'dalmatian-chalk-1',morph:'lilly-axanthic-dalmatian',sex:'female',name:'백묵'}),
  ];
  b.nextId=7;b.selectedId=b.fatherId='C-0001';b.motherId='C-0002';return b;
}
export function importCompanionDalmatianWorkspace(json:string){
  let b=importWorkspace(json);
  if(b.rendererVersion!==COMPANION_DALMATIAN_RENDERER_ID){b=importCompanionPigmentWorkspace(json);b.rendererVersion=COMPANION_DALMATIAN_RENDERER_ID;}
  b.individuals.forEach(g=>assertCompanionPigmentGenome(g.genome));
  for(const id of [b.fatherId,b.motherId])if(id&&!viability(b.individuals.find(g=>g.id===id)!.genome).viable)throw Error('비생존 결과는 부모로 선택할 수 없습니다.');
  return b;
}
