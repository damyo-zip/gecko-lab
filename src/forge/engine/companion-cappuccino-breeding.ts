import {createCompanionPinstripeFounder,COMPANION_PINSTRIPE_PRESETS,type CompanionPinstripePresetId,forecastPinstripe} from './companion-pinstripe-breeding';
import {COMPANION_CAPPUCCINO_RENDERER_ID} from './companion-cappuccino';
import {createOffspring,validateGenome,viability,type FounderInput} from './individual';
import {emptyWorkspace,importWorkspace} from './workspace';
import {cross,type Genome} from './genetics';
import type {ColourPresetId} from './patternless-breeding';
import type {ForgeGecko} from './model';
const recipes=[
 {id:'cappuccino',name:'카푸치노',colour:'brown',base:'flame',lilly:false,axanthic:false},
 {id:'frappuccino',name:'프라푸치노',colour:'brown',base:'lilly',lilly:true,axanthic:false},
 {id:'cappuccino-pinstripe',name:'카푸치노 핀스트라이프',colour:'brown',base:'near-full-pinstripe',lilly:false,axanthic:false},
 {id:'frappuccino-pinstripe',name:'프라푸치노 핀스트라이프',colour:'brown',base:'near-full-pinstripe',lilly:true,axanthic:false},
 {id:'cappuccino-dalmatian',name:'카푸치노 달마시안',colour:'orange',base:'dalmatian-pinstripe',lilly:false,axanthic:false},
 {id:'cappuccino-axanthic',name:'아잔틱 카푸치노',colour:'brown',base:'near-full-pinstripe',lilly:false,axanthic:true},
] as const;
export const COMPANION_CAPPUCCINO_PRESETS=[...COMPANION_PINSTRIPE_PRESETS,...recipes] as const;
export type CompanionCappuccinoPresetId=typeof COMPANION_CAPPUCCINO_PRESETS[number]['id'];
export function cappuccinoCopies(g:ForgeGecko){return g.genome.mendelian.loci['cappuccino-complex'].filter(a=>a==='C').length;}
export function assertCompanionCappuccinoGenome(genome:Genome){
 validateGenome(genome);if(genome.mendelian.loci['cappuccino-complex'].some(a=>a!=='n'&&a!=='C'))throw Error('카푸치노 교배판은 n/C 사본을 지원합니다. 세이블·하이웨이 조합은 별도 렌더가 필요합니다.');
}
export function createCompanionCappuccinoFounder(input:Omit<FounderInput,'mendelian'>&{morph:CompanionCappuccinoPresetId;colour?:ColourPresetId}){
 const recipe=recipes.find(r=>r.id===input.morph),g=createCompanionPinstripeFounder({...input,morph:(recipe?.base??input.morph) as CompanionPinstripePresetId,colour:input.colour??recipe?.colour});
 if(recipe){g.genome.mendelian.loci['cappuccino-complex']=['n','C'];if(recipe.lilly)g.genome.mendelian.loci['lilly-white']=['n','Lw'];if(recipe.axanthic)g.genome.mendelian.loci.axanthic=['ax','ax'];}
 return g;
}
export function createCompanionCappuccinoOffspring(father:ForgeGecko,mother:ForgeGecko,input:Parameters<typeof createOffspring>[2]){
 assertCompanionCappuccinoGenome(father.genome);assertCompanionCappuccinoGenome(mother.genome);return createOffspring(father,mother,input);
}
export function emptyCompanionCappuccinoWorkspace(){const b=emptyWorkspace(COMPANION_CAPPUCCINO_RENDERER_ID);b.settings.showB=false;b.offspringCount=6;b.breedingSeed='cappuccino-cross-1';return b;}
export function starterCompanionCappuccinoWorkspace(){
 const b=emptyCompanionCappuccinoWorkspace();b.individuals=[
  createCompanionCappuccinoFounder({id:'C-0001',seed:'cappuccino-espresso-1',morph:'cappuccino-pinstripe',sex:'male',name:'에스프레소'}),
  createCompanionCappuccinoFounder({id:'C-0002',seed:'cappuccino-vanilla-1',morph:'near-full-pinstripe',sex:'female',name:'바닐라',colour:'orange'}),
  createCompanionCappuccinoFounder({id:'C-0003',seed:'cappuccino-caramel-1',morph:'cappuccino',sex:'male',name:'카라멜',colour:'yellow'}),
  createCompanionCappuccinoFounder({id:'C-0004',seed:'cappuccino-mocha-1',morph:'frappuccino-pinstripe',sex:'female',name:'모카'}),
  createCompanionCappuccinoFounder({id:'C-0005',seed:'cappuccino-pepper-1',morph:'cappuccino-dalmatian',sex:'male',name:'후추'}),
  createCompanionCappuccinoFounder({id:'C-0006',seed:'cappuccino-black-sugar-1',morph:'cappuccino-axanthic',sex:'female',name:'흑당'}),
 ];
 const mother=b.individuals[1];mother.genome.mendelian.loci['lilly-white']=['n','Lw'];for(let n=0;n<2;n++)mother.genome.polygenic.loci[`pinstripe-${n}`]=[4,4];
 b.nextId=7;b.selectedId=b.fatherId='C-0001';b.motherId='C-0002';return b;
}
export function importCompanionCappuccinoWorkspace(json:string){
 const b=importWorkspace(json);b.individuals.forEach(g=>assertCompanionCappuccinoGenome(g.genome));
 for(const id of [b.fatherId,b.motherId])if(id&&!viability(b.individuals.find(g=>g.id===id)!.genome).viable)throw Error('비생존 결과는 부모로 선택할 수 없습니다.');
 b.rendererVersion=COMPANION_CAPPUCCINO_RENDERER_ID;return b;
}
export function forecastCappuccino(father:ForgeGecko,mother:ForgeGecko){
 assertCompanionCappuccinoGenome(father.genome);assertCompanionCappuccinoGenome(mother.genome);
 const pin=forecastPinstripe(father,mother),mendel=cross(father.genome.mendelian,mother.genome.mendelian);
 const outcomes=mendel.outcomes.map(o=>{const copies=o.loci['cappuccino-complex'].filter(a=>a==='C').length,lilly=o.loci['lilly-white'].filter(a=>a==='Lw').length;
  return {...o,copies,lilly,morph:!o.viable?'failed':copies===2?(lilly===1?'sorak':'super'):copies===1?(lilly===1?'frappuccino':'cappuccino'):lilly===1?'lilly':'normal'};});
 const probability=(morph:string)=>outcomes.filter(o=>o.morph===morph).reduce((s,o)=>s+o.probability,0),viableProbability=1-mendel.nonViableProbability;
 return {outcomes,pin,viableProbability,frappuccinoProbability:probability('frappuccino'),cappuccinoProbability:probability('cappuccino'),
  superGenotypeProbability:outcomes.filter(o=>o.copies===2).reduce((s,o)=>s+o.probability,0),
  cappuccinoFullPinProbability:probability('cappuccino')*pin.fullProbability,
  frappuccinoFullPinProbability:probability('frappuccino')*pin.fullProbability,
  viableFrappuccinoFullPinProbability:viableProbability?probability('frappuccino')*pin.fullProbability/viableProbability:0};
}
