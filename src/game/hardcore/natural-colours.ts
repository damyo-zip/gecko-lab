import {companionLineageParameters,renderCompanionLineage,type RenderInput} from '@/forge';
import type {describeCompanionLineage} from '@/forge';
import type {Scores} from '@/genetics/advanced/model';
import {PATTERN_LABELS} from '@/forge/engine/companion-patterns';
import type {Rgb} from '@/forge/engine/patternless';
import {forgeComplexMorphName} from './forge-display-name';
import {patternColourWarmth,type PatternColourTraits} from './colour-genetics';

/** A versioned GAME palette, informed by observed colour families, not a claim
 * that crested geckos have a single red, brightness or orange gene. The actual
 * existing polygenic copies, inheritance and RNG domains stay unchanged. */
export const NATURAL_COLOUR_MODEL={
 version:2,redIntercept:-.6,redGain:.22,orangeGain:.34,valueGain:.6,secondaryGain:.5,
 dark:['#393432','#38372C','#3D352B','#403424','#412F24','#462A28'],
 middle:['#7A747C','#7D7A50','#A28C69','#BDA04C','#C77737','#A14938'],
 light:['#ACA4A6','#B0AD87','#C6B28D','#D7BE75','#BD926E','#C58F7A'],
 pattern:['#F2EEE2','#F0E4C9','#E8D1A4','#E5C678','#D9A269','#CF863C'],
 secondary:['#D9A269','#CF863C','#BD693B'],
}as const;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const rgb=(hex:string):Rgb=>[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16))as unknown as Rgb;
const mix=(a:Rgb,b:Rgb,t:number):Rgb=>a.map((v,n)=>Math.round(v+(b[n]-v)*t))as unknown as Rgb;
const logit=(n:number)=>Math.log(Math.max(1e-9,n)/Math.max(1e-9,1-n));
function ramp(values:readonly string[],t:number):Rgb{
 const position=clamp(t)*(values.length-1),index=Math.min(values.length-2,Math.floor(position));
 return mix(rgb(values[index]),rgb(values[index+1]),position-index);
}
function firedDown(c:Rgb):Rgb{
 const neutral=Math.round(c[0]*.2126+c[1]*.7152+c[2]*.0722);
 return mix(mix(c,[neutral,neutral,neutral],.18),[231,225,210],.16);
}
/** Only independently inherited colour traits affect these materials. In
 * particular, cream still controls area and never chooses the pattern hue. */
export function naturalColours(scores:Pick<Scores,'red'|'brightness'|'orange'>,fire:'up'|'down'='up',patternWarmth=.375){
 for(const key of['red','brightness','orange']as const){const value=scores[key];if(!Number.isFinite(value)||value<0||value>1)throw Error('발색 점수는 0~1이어야 합니다.');}
 if(fire!=='up'&&fire!=='down')throw Error('파이어 설정 오류');
 if(!Number.isFinite(patternWarmth)||patternWarmth<0||patternWarmth>1)throw Error('무늬 발색 점수는 0~1이어야 합니다.');
 const m=NATURAL_COLOUR_MODEL,hue=clamp(.5+(logit(scores.red)-m.redIntercept)*m.redGain+logit(scores.orange)*m.orangeGain);
 const value=clamp(.5+logit(scores.brightness)*m.valueGain),warmth=clamp(.5+logit(scores.orange)*m.secondaryGain);
 const body=value<.5?mix(ramp(m.dark,hue),ramp(m.middle,hue),value*2):mix(ramp(m.middle,hue),ramp(m.light,hue),(value-.5)*2);
 const pattern=ramp(m.pattern,patternWarmth),secondary=ramp(m.secondary,warmth);
 return{body:fire==='down'?firedDown(body):body,pattern:fire==='down'?firedDown(pattern):pattern,
  secondary:fire==='down'?firedDown(secondary):secondary};
}

/** Keep all 62 approved Forge source files and their old renderer contracts
 * intact. This adapter supplies new materials to the same native compositor. */
export function describeNaturalColours(input:RenderInput,patternColour?:PatternColourTraits):ReturnType<typeof describeCompanionLineage>{
 const old=companionLineageParameters(input),colours=naturalColours(input.phenotype.inheritedScores,input.fire,patternColourWarmth(patternColour));
 const parameters:ReturnType<typeof companionLineageParameters>={...old,bodyColor:colours.body,detailColor:colours.pattern,orangeColor:colours.secondary,
  stripeBodyColor:colours.body,stripeColor:mix(colours.body,[37,30,27],.78)};
 const result=renderCompanionLineage(parameters);
 const description:ReturnType<typeof describeCompanionLineage>=Object.assign({},result,{parameters,name:''});
 description.name=input.phenotype.observed['lilly-white']==='Lilly 동형접합 비생존'?'릴리 동형접합 비생존':[
  forgeComplexMorphName(description,true),parameters.lilly?'릴리화이트':'',parameters.axanthic?'아잔틱':'',parameters.phantomCopies===2?'팬텀':'',
  result.dorsalMetrics.superstripe.qualified?'슈퍼스트라이프':'',result.lateralMetrics.quad?'쿼드스트라이프':'',
  PATTERN_LABELS[result.patternMetrics.classification],result.spotMetrics.count?'달마시안':'',result.pinMetrics.classification==='full'?'풀 핀':'',
 ].filter(Boolean).join(' · ');
 return description;
}
