import {createCompanionWhitewallFounder,createCompanionWhitewallOffspring,importCompanionWhitewallWorkspace,forecastCompanionWhitewall} from './companion-whitewall-breeding';
import {COMPANION_LATERAL_RENDERER_ID} from './companion-laterals';
import {createLateralTraits,forecastLateralTraits,lateralTraitScores} from './lateral-genetics';
import {lateralTraits,withLateralTraits,type WhiteoutPair} from './morph-extensions';
import {emptyWorkspace} from './workspace';
import {editFeature} from './editing';
import type {FounderInput} from './individual';
import type {ColourPresetId} from './patternless-breeding';

export const LATERAL_PRESETS=[
  {id:'porthole',name:'포트홀',base:'classic',shape:1,continuity:.7,colour:'brown'},
  {id:'phantom-porthole',name:'팬텀 포트홀',base:'phantom',shape:1,continuity:.7,colour:'charcoal'},
  {id:'red-porthole',name:'레드 포트홀',base:'red',shape:1,continuity:.7,colour:'red'},
  {id:'axanthic-porthole',name:'아잔틱 포트홀',base:'axanthic',shape:1,continuity:.7,colour:'charcoal'},
  {id:'dalmatian-porthole',name:'작은 점 · 포트홀',base:'dalmatian',shape:1,continuity:.7,colour:'brown'},
  {id:'quad',name:'쿼드스트라이프',base:'classic',shape:0,continuity:1,colour:'brown'},
  {id:'dashed-quad',name:'이어지는 옆줄',base:'classic',shape:0,continuity:.6,colour:'orange'},
  {id:'emptyback-quad',name:'엠티백 쿼드',base:'emptyback',shape:0,continuity:1,colour:'brown'},
  {id:'lilly-quad',name:'릴리 쿼드 조합',base:'lilly',shape:0,continuity:1,colour:'brown'},
  {id:'mixed',name:'둥근 조각 · 옆줄 혼합',base:'classic',shape:.5,continuity:.8,colour:'red'},
]as const;
export type LateralPresetId=typeof LATERAL_PRESETS[number]['id'];
export function createCompanionLateralFounder(input:Omit<FounderInput,'mendelian'>&{morph:LateralPresetId;whiteout?:WhiteoutPair;colour?:ColourPresetId;shape?:number;continuity?:number}){
  const r=LATERAL_PRESETS.find(r=>r.id===input.morph);if(!r)throw Error('지원하지 않는 옆무늬 조합입니다.');
  const g=createCompanionWhitewallFounder({...input,morph:r.base,whiteout:input.whiteout??['N','N'],colour:input.colour??r.colour});
  // Low ordinary flame coverage leaves the lateral accents legible; this is
  // actual inherited founder background, never forced onto later offspring.
  g.genome=editFeature(editFeature(g.genome,'flank',1),'harlequin',1);
  g.extensions=withLateralTraits(g.extensions,createLateralTraits(g.creationSeed,input.shape??r.shape,input.continuity??r.continuity));
  return g;
}
export const createCompanionLateralOffspring=createCompanionWhitewallOffspring;
export function emptyCompanionLateralWorkspace(){const b=emptyWorkspace(COMPANION_LATERAL_RENDERER_ID);b.settings.showB=false;b.offspringCount=6;b.breedingSeed='laterals-cross-1';return b;}
export function starterCompanionLateralWorkspace(){
  const b=emptyCompanionLateralWorkspace();
  const starts=[
    ['밤진주','male','phantom-porthole',['N','Wo']],['붉은진주','female','red-porthole',['Wo','Wo']],
    ['네줄능선','male','quad',['N','N']],['이어질선','female','dashed-quad',['N','N']],
    ['창문구름','female','phantom-porthole',['Wo','Wo']],['은빛진주','male','axanthic-porthole',['Wo','Wo']],
    ['점과진주','female','dalmatian-porthole',['Wo','Wo']],['하얀능선','female','emptyback-quad',['N','N']],
    ['우유빛선','male','lilly-quad',['N','N']],['물결무늬','female','mixed',['N','Wo']],
  ]as const;
  b.individuals=starts.map(([name,sex,morph,whiteout],n)=>createCompanionLateralFounder({id:`L-${String(n+1).padStart(4,'0')}`,seed:`laterals-founder-${n+1}`,name,sex,morph,whiteout}));
  b.nextId=11;b.fatherId='L-0003';b.motherId='L-0004';b.selectedId='L-0005';return b;
}
export function importCompanionLateralWorkspace(json:string){const b=importCompanionWhitewallWorkspace(json);b.rendererVersion=COMPANION_LATERAL_RENDERER_ID;return b;}
export function forecastCompanionLaterals(...parents:Parameters<typeof forecastCompanionWhitewall>){return{...forecastCompanionWhitewall(...parents),lateral:forecastLateralTraits(lateralTraits(parents[0].extensions),lateralTraits(parents[1].extensions))};}
export function lateralTraitLabel(extensions:Parameters<typeof lateralTraits>[0]){
  const s=lateralTraitScores(lateralTraits(extensions));return s.shape===null||s.continuity===null?'옆무늬 미기록':`${s.shape>=.7?'둥근 성향':s.shape<=.3?'줄 성향':'혼합 성향'} · 연결 ${(s.continuity*100).toFixed(0)}%`;
}
