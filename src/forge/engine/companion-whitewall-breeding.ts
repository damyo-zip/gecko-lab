import {createCompanionEmptyBackFounder,createCompanionEmptyBackOffspring,importCompanionEmptyBackWorkspace,forecastCompanionEmptyBack} from './companion-emptyback-breeding';
import {COMPANION_WHITEWALL_RENDERER_ID} from './companion-whitewall';
import {withWhiteoutPair,forecastWhiteout,type WhiteoutPair} from './morph-extensions';
import {emptyWorkspace} from './workspace';
import {editFeature} from './editing';
import type {FounderInput} from './individual';
import type {ColourPresetId} from './patternless-breeding';

export const WHITEWALL_PRESETS=[
  {id:'classic',name:'브라운 풀 핀',base:'partial-pin',colour:'brown'},
  {id:'phantom',name:'짙은 팬텀',base:'phantom',colour:'charcoal'},
  {id:'emptyback',name:'엠티백 풀 핀',base:'tricolor',colour:'brown'},
  {id:'red',name:'레드 풀 핀',base:'partial-pin',colour:'red'},
  {id:'lilly',name:'릴리화이트',base:'lilly',colour:'brown'},
  {id:'axanthic',name:'아잔틱',base:'axanthic',colour:'charcoal'},
  {id:'dalmatian',name:'작은 점 달마시안',base:'dalmatian',colour:'brown'},
  {id:'cappuccino',name:'카푸치노',base:'cappuccino',colour:'brown'},
  {id:'broken-pin',name:'부분 핀',base:'partial-pin',colour:'brown'},
]as const;
export type WhitewallPresetId=typeof WHITEWALL_PRESETS[number]['id'];
export type WallFoundation='low'|'medium'|'high';
export function createCompanionWhitewallFounder(input:Omit<FounderInput,'mendelian'>&{morph:WhitewallPresetId;whiteout:WhiteoutPair;colour?:ColourPresetId;wallFoundation?:WallFoundation}) {
  const recipe=WHITEWALL_PRESETS.find(r=>r.id===input.morph);if(!recipe)throw Error('지원하지 않는 화이트월 조합입니다.');
  const mean={low:1.5,medium:2.25,high:3.25}[input.wallFoundation??'high'];if(mean===undefined)throw Error('옆무늬 연결 바탕을 선택하세요.');
  const g=createCompanionEmptyBackFounder({...input,morph:recipe.base,colour:input.colour??recipe.colour,emptyBack:input.morph==='emptyback'?['Eb','Eb']:['N','N']});
  for(const feature of['flank','harlequin']as const)g.genome=editFeature(g.genome,feature,mean);
  g.genome=editFeature(g.genome,'pinstripe',input.morph==='broken-pin'?2.25:4);
  g.extensions=withWhiteoutPair(g.extensions,input.whiteout);return g;
}
export const createCompanionWhitewallOffspring=createCompanionEmptyBackOffspring;
export function emptyCompanionWhitewallWorkspace(){const b=emptyWorkspace(COMPANION_WHITEWALL_RENDERER_ID);b.settings.showB=false;b.offspringCount=6;b.breedingSeed='whitewall-cross-1';return b;}
export function starterCompanionWhitewallWorkspace() {
  const b=emptyCompanionWhitewallWorkspace();
  const starts=[
    ['밤구름','male','phantom',['N','Wo'],'high'],['새벽빛','female','phantom',['N','Wo'],'high'],
    ['하얀성벽','male','phantom',['Wo','Wo'],'high'],['조각구름','female','phantom',['Wo','Wo'],'low'],
    ['붉은담장','female','red',['Wo','Wo'],'high'],['빈등의성','female','emptyback',['Wo','Wo'],'high'],
    ['설벽','male','lilly',['Wo','Wo'],'high'],['콩점','female','dalmatian',['N','N'],'high'],
  ]as const;
  b.individuals=starts.map(([name,sex,morph,whiteout,wallFoundation],n)=>createCompanionWhitewallFounder({id:`W-${String(n+1).padStart(4,'0')}`,seed:`whitewall-founder-${n+1}`,name,sex,morph,whiteout,wallFoundation}));
  b.nextId=9;b.fatherId='W-0001';b.motherId='W-0002';b.selectedId='W-0003';return b;
}
export function importCompanionWhitewallWorkspace(json:string){const b=importCompanionEmptyBackWorkspace(json);b.rendererVersion=COMPANION_WHITEWALL_RENDERER_ID;return b;}
export function forecastCompanionWhitewall(...parents:Parameters<typeof forecastCompanionEmptyBack>){return {...forecastCompanionEmptyBack(...parents),whiteout:forecastWhiteout(parents[0].extensions,parents[1].extensions)};}
