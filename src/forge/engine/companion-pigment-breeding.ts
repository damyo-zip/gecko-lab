import { createCompanionLillyFounder, COMPANION_LILLY_PRESETS } from './companion-lilly-breeding';
import { emptyCompanionLillyVeilWorkspace, importCompanionLillyVeilWorkspace } from './companion-lilly-veil-breeding';
import { COMPANION_PIGMENT_RENDERER_ID } from './companion-pigment';
import { createOffspring, validateGenome, viability, type FounderInput } from './individual';
import { importWorkspace } from './workspace';
import type { Genome } from './genetics';
import type { ColourPresetId } from './patternless-breeding';

export const COMPANION_PIGMENT_PRESETS=[...COMPANION_LILLY_PRESETS,
  {id:'het-axanthic',name:'아잔틱 het',colour:'orange'},
  {id:'axanthic',name:'아잔틱',colour:'orange'},
  {id:'lilly-het-axanthic',name:'릴리화이트 · 아잔틱 het',colour:'orange'},
  {id:'lilly-axanthic',name:'릴리 아잔틱',colour:'orange'}] as const;
export type CompanionPigmentPresetId=typeof COMPANION_PIGMENT_PRESETS[number]['id'];
export function assertCompanionPigmentGenome(genome:Genome) {
  validateGenome(genome);
  if(genome.mendelian.loci['cappuccino-complex'].some(a=>a!=='n')) throw Error('색소 교배판은 일반형·릴리화이트·아잔틱을 지원합니다.');
}
export function createCompanionPigmentFounder(input:Omit<FounderInput,'mendelian'>&{morph:CompanionPigmentPresetId;colour?:ColourPresetId}) {
  if(!COMPANION_PIGMENT_PRESETS.some(p=>p.id===input.morph))throw Error('지원하지 않는 색소 모프입니다.');
  const morph=input.morph==='het-axanthic'?'flame':input.morph==='axanthic'?'harlequin':(input.morph==='lilly-het-axanthic'||input.morph==='lilly-axanthic')?'lilly':input.morph;
  const g=createCompanionLillyFounder({...input,morph});
  if(input.morph.includes('axanthic'))g.genome.mendelian.loci.axanthic=input.morph.includes('het')?['A','ax']:['ax','ax'];
  return g;
}
export function createCompanionPigmentOffspring(father:Parameters<typeof createOffspring>[0],mother:Parameters<typeof createOffspring>[1],input:Parameters<typeof createOffspring>[2]) {
  assertCompanionPigmentGenome(father.genome);assertCompanionPigmentGenome(mother.genome);return createOffspring(father,mother,input);
}
export function emptyCompanionPigmentWorkspace() {
  const b=emptyCompanionLillyVeilWorkspace();b.rendererVersion=COMPANION_PIGMENT_RENDERER_ID;b.breedingSeed='axanthic-cross-1';return b;
}
export function starterCompanionPigmentWorkspace() {
  const b=emptyCompanionPigmentWorkspace();
  b.individuals=[
    createCompanionPigmentFounder({id:'C-0001',seed:'companion-amber-13',morph:'het-axanthic',sex:'male',name:'호박'}),
    createCompanionPigmentFounder({id:'C-0002',seed:'companion-sand-39',morph:'lilly-het-axanthic',sex:'female',name:'설화'}),
    createCompanionPigmentFounder({id:'C-0003',seed:'pigment-graphite-1',morph:'axanthic',sex:'male',name:'흑연'}),
    createCompanionPigmentFounder({id:'C-0004',seed:'pigment-silver-1',morph:'lilly-axanthic',sex:'female',name:'백은'}),
  ];
  b.nextId=5;b.selectedId='C-0003';b.fatherId='C-0001';b.motherId='C-0002';return b;
}
export function importCompanionPigmentWorkspace(json:string) {
  let b=importWorkspace(json);
  if(b.rendererVersion!==COMPANION_PIGMENT_RENDERER_ID){b=importCompanionLillyVeilWorkspace(json);b.rendererVersion=COMPANION_PIGMENT_RENDERER_ID;}
  b.individuals.forEach(g=>assertCompanionPigmentGenome(g.genome));
  for(const id of [b.fatherId,b.motherId])if(id&&!viability(b.individuals.find(g=>g.id===id)!.genome).viable)throw Error('비생존 결과는 부모로 선택할 수 없습니다.');
  return b;
}
