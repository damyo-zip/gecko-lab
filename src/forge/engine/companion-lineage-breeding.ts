import { createCompanionLateralFounder, type LateralPresetId } from './companion-lateral-breeding';
import { createOffspring, viability, validateGenome, type FounderInput } from './individual';
import { COMPANION_LINEAGE_RENDERER_ID } from './companion-lineage';
import { withVeilTraits, veilTraits, withEmptyBackPair } from './morph-extensions';
import { createVeilTraits, forecastVeilDensity } from './veil-genetics';
import { emptyWorkspace, importWorkspace } from './workspace';
import { cross } from './genetics';
import { editFeature } from './editing';
import type { ForgeGecko } from './model';
import type { ColourPresetId } from './patternless-breeding';

export const LINEAGE_PRESETS = [
  { id:'sable', name:'세이블', base:'quad', allele:'S', lilly:false, colour:'brown' },
  { id:'sable-lilly', name:'세이블 릴리', base:'lilly-quad', allele:'S', lilly:true, colour:'brown' },
  { id:'sable-axanthic', name:'아잔틱 세이블', base:'axanthic-porthole', allele:'S', lilly:false, colour:'charcoal' },
  { id:'highway', name:'하이웨이', base:'quad', allele:'H', lilly:false, colour:'brown' },
  { id:'highway-lilly', name:'하이웨이 릴리', base:'lilly-quad', allele:'H', lilly:true, colour:'brown' },
  { id:'highway-axanthic', name:'아잔틱 하이웨이', base:'axanthic-porthole', allele:'H', lilly:false, colour:'charcoal' },
  { id:'lilly-line', name:'릴리 · 베일 선별', base:'lilly-quad', allele:'n', lilly:true, colour:'brown' },
  { id:'normal-line', name:'일반 · 베일 성향 전달', base:'quad', allele:'n', lilly:false, colour:'brown' },
  { id:'cappuccino', name:'카푸치노', base:'quad', allele:'C', lilly:false, colour:'brown' },
  { id:'frappuccino', name:'프라푸치노', base:'lilly-quad', allele:'C', lilly:true, colour:'brown' },
] as const;
export type LineagePresetId = typeof LINEAGE_PRESETS[number]['id'];
export function createCompanionLineageFounder(input: Omit<FounderInput,'mendelian'> & { morph:LineagePresetId; colour?:ColourPresetId; veilDensity?:number }) {
  const r=LINEAGE_PRESETS.find(r=>r.id===input.morph);if(!r)throw Error('지원하지 않는 계통 프리셋입니다.');
  const g=createCompanionLateralFounder({...input,morph:r.base as LateralPresetId,colour:input.colour??r.colour,shape:0,continuity:.90});
  g.genome.mendelian.loci['cappuccino-complex']=['n',r.allele];
  g.genome.mendelian.loci['lilly-white']=['n',r.lilly?'Lw':'n'];
  g.genome=editFeature(g.genome,'dorsal',r.allele==='H'?3.5:2.7);
  g.genome=editFeature(g.genome,'cream',3.3);
  g.extensions=withVeilTraits(withEmptyBackPair(g.extensions,['N','N']),createVeilTraits(g.creationSeed,input.veilDensity??.60));
  return g;
}
export function createCompanionLineageOffspring(father:ForgeGecko,mother:ForgeGecko,input:Parameters<typeof createOffspring>[2]) {
  validateGenome(father.genome);validateGenome(mother.genome);return createOffspring(father,mother,input);
}
export function emptyCompanionLineageWorkspace() {
  const b=emptyWorkspace(COMPANION_LINEAGE_RENDERER_ID);b.settings.showB=false;b.offspringCount=6;b.breedingSeed='lineage-cross-1';return b;
}
export function starterCompanionLineageWorkspace() {
  const b=emptyCompanionLineageWorkspace(),starts=[
    ['서리','male','lilly-line',.55],['안개','female','normal-line',.55],
    ['밤서리','male','sable',.6],['크림길','female','highway',.6],
    ['흰밤','female','sable-lilly',.85],['우윳길','male','highway-lilly',.85],
    ['은서리','male','sable-axanthic',.6],['은빛길','female','highway-axanthic',.6],
    ['옅은눈','female','lilly-line',.15],['깊은눈','male','lilly-line',.95],
    ['커피','male','cappuccino',.6],['우유커피','female','frappuccino',.8],
  ] as const;
  b.individuals=starts.map(([name,sex,morph,veilDensity],n)=>createCompanionLineageFounder({id:`G-${String(n+1).padStart(4,'0')}`,seed:`lineage-founder-${n+1}`,name,sex,morph,veilDensity}));
  b.nextId=13;b.fatherId='G-0001';b.motherId='G-0002';b.selectedId='G-0003';return b;
}
export function importCompanionLineageWorkspace(json:string) {
  const b=importWorkspace(json);b.rendererVersion=COMPANION_LINEAGE_RENDERER_ID;return b;
}
/** Explicitly records fictional modifiers in a copy; unknown legacy ancestry stays unknown until requested. */
export function copyCompanionVeilTraits(g:ForgeGecko,input:{id:string;density:number}) {
  const copy={...structuredClone(g),id:input.id,origin:'edited' as const,derivedFrom:g.id};
  copy.extensions=withVeilTraits(copy.extensions,createVeilTraits(copy.creationSeed,input.density));return copy;
}
export function forecastCompanionLineage(father:ForgeGecko,mother:ForgeGecko) {
  if(father.id===mother.id||father.sex!=='male'||mother.sex!=='female'||!viability(father.genome).viable||!viability(mother.genome).viable)throw Error('서로 다른 생존 수컷·암컷 부모를 선택하세요.');
  const mendel=cross(father.genome.mendelian,mother.genome.mendelian);
  const probability=(a:string)=>mendel.outcomes.filter(o=>o.loci['cappuccino-complex'].includes(a)).reduce((s,o)=>s+o.probability,0);
  return {mendel,veil:forecastVeilDensity(veilTraits(father.extensions),veilTraits(mother.extensions)),viableProbability:1-mendel.nonViableProbability,
    sableProbability:probability('S'),highwayProbability:probability('H'),lillyProbability:mendel.outcomes.filter(o=>o.loci['lilly-white'].filter(a=>a==='Lw').length===1).reduce((s,o)=>s+o.probability,0)};
}
