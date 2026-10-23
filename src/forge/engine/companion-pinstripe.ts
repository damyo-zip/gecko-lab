import {B_ORIGIN_01 as source} from './art/b-origin-01';
import {PINSTRIPE_RAILS} from './art/pinstripe-rails';
import {renderCompanionDalmatian, companionDalmatianParameters, describeCompanionDalmatian, createCompanionDalmatianRenderer, type CompanionDalmatianParameters} from './companion-dalmatian-v3';
import {patternlessTones,type Rgb} from './patternless';
import {seededRandom} from './genetics';
import type {AppearanceRenderer,RenderInput} from './model';
import type {SpriteLayer} from '@/engine/model';

export const COMPANION_PINSTRIPE_RENDERER_ID='b-origin-01-companion-pinstripe-1' as const;
export const COMPANION_PINSTRIPE_MODEL={version:1,scoreOffset:.1,scoreRange:.8,segmentsPerRail:7,
 pinColor:[255,255,247] as const,neutralPinColor:[250,251,255] as const,fullCoverage:1,nearFullCoverage:.9,
 value:{coverage:65,continuity:20,fullPremium:15},
 limits:'Game polygenic expression and collection value, not a Mendelian locus or market price. Both rails visible in this pose; opposite body side is not inferred.'} as const;
export const PINSTRIPE_COMPARISON=[{id:'none',name:'핀 없음',pinStrength:0},{id:'partial',name:'부분 핀',pinStrength:.4},{id:'full',name:'풀 핀',pinStrength:1}] as const;
export interface CompanionPinstripeParameters extends CompanionDalmatianParameters {pinStrength:number;pinSeed:number}
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export function pinstripeStrengthFromScore(score:number){return clamp((score-COMPANION_PINSTRIPE_MODEL.scoreOffset)/COMPANION_PINSTRIPE_MODEL.scoreRange);}
const columns=Array.from({length:54},(_,n)=>35+n),total=columns.length*2;
export type PinstripeClass='none'|'partial'|'near-full'|'full';
export const PINSTRIPE_LABELS={none:'핀 없음',partial:'부분 핀','near-full':'니어 풀 핀',full:'풀 핀'} as const;
const orders=new Map<number,{rail:number;x:number;priority:number}[]>();
function order(seed:number){
 const cached=orders.get(seed);if(cached)return cached;
 const entries=PINSTRIPE_RAILS.rails.flatMap((_,rail)=>{
  const rng=seededRandom(String(seed),`companion:pinstripe-segments:1:${rail}`);
  const chunks=Array.from({length:7},()=>({bias:rng(),center:.35+rng()*.3}));
  return columns.map((x,n)=>{const u=(n+.5)/54*7,c=chunks[Math.min(6,Math.floor(u))],distance=Math.abs(u%1-c.center)/Math.max(c.center,1-c.center);
   return {rail,x,priority:.7*distance+.3*c.bias+rail*.00001+n*.0000001};});
 }).sort((a,b)=>a.priority-b.priority);
 orders.set(seed,entries);if(orders.size>64)orders.delete(orders.keys().next().value!);return entries;
}
export function buildPinstripeMask(strength:number,seed:number){
 if(typeof strength!=='number'||!Number.isFinite(strength)||strength<0||strength>1)throw Error('핀 연결 강도는 0~1이어야 합니다.');
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('핀 시드는 uint32 정수여야 합니다.');
 const count=Math.floor(strength*total+1e-9),active=[new Set<number>(),new Set<number>()];
 order(seed).slice(0,count).forEach(p=>active[p.rail].add(p.x));
 const mask=new Uint8Array(9216),rails=PINSTRIPE_RAILS.rails.map((r,n)=>{
  r.pixels.forEach(i=>{if(active[n].has(i%96))mask[i]=255;});
  let longest=0,run=0,gaps=0,inGap=false;
  for(const x of columns){if(active[n].has(x)){longest=Math.max(longest,++run);inGap=false;}else{run=0;if(!inGap)gaps++;inGap=true;}}
  return {id:r.id,activeColumns:columns.filter(x=>active[n].has(x)),covered:active[n].size,total:54,coverage:active[n].size/54,longestRun:longest,longestRunRatio:longest/54,gaps};
 });
 const coverage=count/total,continuity=rails.reduce((s,r)=>s+r.longestRunRatio,0)/2;
 const classification:PinstripeClass=count===0?'none':count===total?'full':coverage>=.9?'near-full':'partial';
 const v=COMPANION_PINSTRIPE_MODEL.value,valueScore=Math.round(v.coverage*coverage+v.continuity*continuity+(classification==='full'?v.fullPremium:0));
 return {mask,metrics:{coverage,continuity,classification,valueScore,connectedColumns:count,totalColumns:total,missingColumns:total-count,rails}};
}
export function renderCompanionPinstripe(parameters:CompanionPinstripeParameters){
 const plan=buildPinstripeMask(parameters.pinStrength,parameters.pinSeed),base=renderCompanionDalmatian(parameters),pixels=base.sprite.pixels.slice();
 const m=COMPANION_PINSTRIPE_MODEL,t=base.pigment.suppression;
 const pin=m.pinColor.map((v,c)=>Math.round(v+(m.neutralPinColor[c]-v)*t)) as unknown as Rgb;
 const tones=patternlessTones(pin),white=patternlessTones(base.pigment.white),visible=plan.mask.slice();
 const layer:SpriteLayer={name:'details',mask:visible,pixels:new Uint8ClampedArray(pixels.length)};
 plan.mask.forEach((v,i)=>{if(!v)return;
  // Dark spots remain intact over the thin ridge pigment, including exact 1/4/5px shapes.
  if(base.spotMask[i]){visible[i]=0;return;}
  const tone=source.shading[i]===1?'highlight':source.shading[i]===3?'shadow':'base';let rgb:Rgb=tones[tone];
  if(parameters.lilly)rgb=rgb.map((v,c)=>Math.round(v+(white[tone][c]-v)*parameters.veilStrength)) as unknown as Rgb;
  pixels.set([...rgb,pixels[i*4+3]],i*4);layer.pixels.set(pixels.slice(i*4,i*4+4),i*4);
 });
 return {...base,sprite:{...base.sprite,version:COMPANION_PINSTRIPE_RENDERER_ID,pixels,layers:parameters.pinStrength?[...base.sprite.layers,layer]:base.sprite.layers},
  pinMask:plan.mask,visiblePinMask:visible,pinMetrics:{...plan.metrics,paintedPixels:visible.filter(Boolean).length,spotOccludedPixels:plan.mask.filter((v,i)=>v&&base.spotMask[i]).length}};
}
export function companionPinstripeParameters(input:RenderInput,veilOverride?:number):CompanionPinstripeParameters{
 return {...companionDalmatianParameters(input,veilOverride),pinStrength:pinstripeStrengthFromScore(input.phenotype.inheritedScores.pinstripe),
  pinSeed:Math.floor(seededRandom(input.seed,'companion:pinstripe-layout:1')()*0x100000000)};
}
export function describeCompanionPinstripe(input:RenderInput,veilOverride?:number){
 const original=describeCompanionDalmatian(input,veilOverride),parameters=companionPinstripeParameters(input,veilOverride),r=renderCompanionPinstripe(parameters);
 const alive=input.phenotype.observed['lilly-white']!=='Lilly 동형접합 비생존';
 return {...original,parameters,pinMetrics:r.pinMetrics,name:alive?`${original.name} · ${PINSTRIPE_LABELS[r.pinMetrics.classification]}`:original.name};
}
export function createCompanionPinstripeRenderer(veilOverride?:number):AppearanceRenderer{
 createCompanionDalmatianRenderer(veilOverride);
 return {id:veilOverride===undefined?COMPANION_PINSTRIPE_RENDERER_ID:`${COMPANION_PINSTRIPE_RENDERER_ID}:veil:${veilOverride}`,
  render:input=>renderCompanionPinstripe(companionPinstripeParameters(input,veilOverride)).sprite};
}
export const companionPinstripeRenderer=createCompanionPinstripeRenderer();
