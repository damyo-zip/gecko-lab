import { createCompanionPatternsFounder, createCompanionPatternsOffspring, importCompanionPatternsWorkspace, forecastPatterns } from './companion-patterns-breeding';
import { COMPANION_EMPTYBACK_RENDERER_ID } from './companion-emptyback';
import { withEmptyBackPair, withPhantomPair, forecastEmptyBack, type EmptyBackPair } from './morph-extensions';
import { emptyWorkspace } from './workspace';
import { editFeature } from './editing';
import type { FounderInput } from './individual';
import type { ColourPresetId } from './patternless-breeding';

export const EMPTYBACK_PRESETS = [
  {id:'full-pin',name:'풀 핀 할리퀸',base:'extreme-harlequin',colour:'brown'},
  {id:'partial-pin',name:'부분 핀 할리퀸',base:'select-harlequin',colour:'red'},
  {id:'tricolor',name:'트라이컬러 풀 핀',base:'tricolor-extreme',colour:'brown'},
  {id:'lilly',name:'릴리화이트 풀 핀',base:'tricolor-lilly',colour:'brown'},
  {id:'axanthic',name:'아잔틱 풀 핀',base:'tricolor-axanthic',colour:'charcoal'},
  {id:'dalmatian',name:'달마시안 풀 핀',base:'tricolor-dalmatian',colour:'brown'},
  {id:'phantom',name:'팬텀 풀 핀',base:'tricolor-full-pin',colour:'brown'},
  {id:'cappuccino',name:'카푸치노 풀 핀',base:'cappuccino-pinstripe',colour:'brown'},
]as const;
export type EmptyBackPresetId=typeof EMPTYBACK_PRESETS[number]['id'];
export function createCompanionEmptyBackFounder(input:Omit<FounderInput,'mendelian'>&{morph:EmptyBackPresetId;emptyBack:EmptyBackPair;colour?:ColourPresetId}) {
  const recipe=EMPTYBACK_PRESETS.find(r=>r.id===input.morph);if(!recipe)throw Error('지원하지 않는 엠티백 조합입니다.');
  const g=createCompanionPatternsFounder({...input,morph:recipe.base,colour:input.colour??recipe.colour});
  g.genome=editFeature(g.genome,'pinstripe',input.morph==='partial-pin'?2.25:4);
  g.extensions=withEmptyBackPair(withPhantomPair(undefined,input.morph==='phantom'?['ph','ph']:['N','N']),input.emptyBack);
  return g;
}
export const createCompanionEmptyBackOffspring=createCompanionPatternsOffspring;
export function emptyCompanionEmptyBackWorkspace() {
  const b=emptyWorkspace(COMPANION_EMPTYBACK_RENDERER_ID);b.settings.showB=false;b.offspringCount=6;b.breedingSeed='emptyback-cross-1';return b;
}
export function starterCompanionEmptyBackWorkspace() {
  const b=emptyCompanionEmptyBackWorkspace();
  const starts=[
    ['도토리','male','full-pin',['N','Eb']],['밤송이','female','full-pin',['N','Eb']],
    ['빈능선','male','full-pin',['Eb','Eb']],['붉은여백','female','partial-pin',['N','Eb']],
    ['세가지빛','male','tricolor',['Eb','Eb']],['하얀테두리','female','lilly',['Eb','Eb']],
    ['먹선','male','axanthic',['Eb','Eb']],['점박이','female','dalmatian',['N','N']],
  ]as const;
  b.individuals=starts.map(([name,sex,morph,emptyBack],n)=>createCompanionEmptyBackFounder({id:`E-${String(n+1).padStart(4,'0')}`,seed:`emptyback-founder-${n+1}`,name,sex,morph,emptyBack}));
  b.nextId=9;b.fatherId='E-0001';b.motherId='E-0002';b.selectedId='E-0003';return b;
}
export function importCompanionEmptyBackWorkspace(json:string) {
  const b=importCompanionPatternsWorkspace(json);b.rendererVersion=COMPANION_EMPTYBACK_RENDERER_ID;return b;
}
export function forecastCompanionEmptyBack(...parents:Parameters<typeof forecastPatterns>) {
  return {...forecastPatterns(...parents),emptyBack:forecastEmptyBack(parents[0].extensions,parents[1].extensions)};
}
