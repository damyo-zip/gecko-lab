import { B_ORIGIN_01 as source } from './art/b-origin-01';
import { renderCompanionBase } from './companion-base';
import { companionPigmentParameters, describeCompanionPigment, renderCompanionPigment, type CompanionPigmentParameters } from './companion-pigment';
import { seededRandom } from './genetics';
import { patternlessTones } from './patternless';
import type { AppearanceRenderer, RenderInput } from './model';
import type { SpriteLayer } from '@/engine/model';

export const COMPANION_DALMATIAN_RENDERER_ID = 'b-origin-01-companion-dalmatian-1' as const;
export const COMPANION_DALMATIAN_MODEL = {
  version: 1, maximumSpots: 48, gap: 1.1, minimumArea: 3, eightNeighborSeparation: true,
  densityOffset: .18, densityRange: .44, sizeOffset: .15, sizeRange: .7,
  countFeature: 'spots', sizeFeature: 'contrast',
  pigment: [27, 24, 22] as const, axanthicPigment: [25, 26, 29] as const,
  composition: 'independent dark material after flame, axanthic and Lilly veil; authored lighting once',
  limits: 'existing virtual polygenic traits, no new Mendelian locus or real causal size-gene claim',
} as const;
export const DALMATIAN_COMPARISON = [
  {id:'few-large',name:'큰 반점 소수형',spotDensity:.15,spotSize:.95},
  {id:'medium',name:'중간 밀도형',spotDensity:.5,spotSize:.5},
  {id:'dense',name:'고밀도형',spotDensity:.95,spotSize:.35},
] as const;
export interface CompanionDalmatianParameters extends CompanionPigmentParameters {
  spotDensity: number; spotSize: number; spotSeed: number;
}
interface Spot { x:number; y:number; radius:number; pixels:number[] }
const N=96*96, model=COMPANION_DALMATIAN_MODEL;
const materials=renderCompanionBase().materialMask;
const eligible=Uint8Array.from(source.foreground,(v,i)=>v&&!source.protection[i]&&source.labels[i]!==1&&![3,5].includes(materials[i])?1:0);
const near=(i:number)=>[i%96?i-1:-1,i%96<95?i+1:-1,i-96,i+96];
const around=(i:number)=>[...near(i),i-97,i-95,i+95,i+97].filter(j=>j>=0&&j<N&&Math.abs(j%96-i%96)<=1);
const centers=Array.from(eligible).flatMap((v,i)=>v&&near(i).every(j=>j>=0&&j<N&&eligible[j])?[i]:[]);
const plans=new Map<string,Spot[]>();
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
function unit(n:number) {if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>1)throw Error('반점의 수·크기는 0~1이어야 합니다.');}
function plan(seed:number,size:number) {
  const key=`${seed}:${size}`,cached=plans.get(key);if(cached)return cached;
  const rng=seededRandom(String(seed),'companion:dalmatian-plan:1'),ordered=centers.slice();
  for(let i=ordered.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[ordered[i],ordered[j]]=[ordered[j],ordered[i]];}
  const spots:Spot[]=[],occupied=new Set<number>();
  for(const i of ordered){
    const x=i%96,y=Math.floor(i/96),radius=1.05+size*(.5+rng()*.9),aspect=.85+rng()*.3;
    const offsetX=.2+rng()*.6,offsetY=.2+rng()*.6,phase=rng()*Math.PI*2;
    if(spots.some(s=>Math.hypot(x-s.x,y-s.y)<radius+s.radius+model.gap))continue;
    const pixels:number[]=[];let fits=true;
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
      const px=dx-offsetX,py=dy-offsetY,angle=Math.atan2(py,px);
      if((px/(radius*aspect))**2+(py/(radius/aspect))**2>1+.12*Math.sin(angle*3+phase))continue;
      const j=(y+dy)*96+x+dx;
      if(x+dx<0||x+dx>=96||y+dy<0||y+dy>=96||!eligible[j]||near(j).some(k=>k<0||k>=N||!source.foreground[k]||source.protection[k]))fits=false;
      pixels.push(j);
    }
    if(!fits||pixels.length<model.minimumArea||pixels.some(j=>occupied.has(j)||around(j).some(k=>occupied.has(k))))continue;
    pixels.forEach(j=>occupied.add(j));
    spots.push({x,y,radius,pixels});if(spots.length===model.maximumSpots)break;
  }
  plans.set(key,spots);if(plans.size>64)plans.delete(plans.keys().next().value!);return spots;
}
export function renderCompanionDalmatian(parameters:CompanionDalmatianParameters) {
  unit(parameters.spotDensity);unit(parameters.spotSize);
  if(!Number.isInteger(parameters.spotSeed)||parameters.spotSeed<0||parameters.spotSeed>0xffffffff)throw Error('반점 시드는 0~4294967295 정수여야 합니다.');
  const base=renderCompanionPigment(parameters),pixels=base.sprite.pixels.slice(),spotMask=new Uint8Array(N),spotIds=new Uint8Array(N);
  const requestedCount=Math.round(parameters.spotDensity*model.maximumSpots),available=requestedCount?plan(parameters.spotSeed,parameters.spotSize):[];
  const spots=available.slice(0,requestedCount),tones=patternlessTones(parameters.axanthic?model.axanthicPigment:model.pigment);
  const layer:SpriteLayer={name:'spots',mask:spotMask,pixels:new Uint8ClampedArray(pixels.length)};
  spots.forEach((s,n)=>s.pixels.forEach(i=>{
    const rgb=source.shading[i]===1?tones.highlight:source.shading[i]===3?tones.shadow:tones.base;
    spotMask[i]=255;spotIds[i]=n+1;pixels.set([...rgb,pixels[i*4+3]],i*4);layer.pixels.set(pixels.slice(i*4,i*4+4),i*4);
  }));
  const count=spotMask.filter(Boolean).length;
  return {...base,sprite:{...base.sprite,version:COMPANION_DALMATIAN_RENDERER_ID,pixels,
    layers:spots.length?[...base.sprite.layers,layer]:base.sprite.layers},spotMask,spotIds,
    spotMetrics:{requestedCount,count:spots.length,pixels:count,meanArea:spots.length?count/spots.length:0,
      bodyCoverage:count/source.foreground.filter(Boolean).length,
      regions:Object.fromEntries([2,3,4,5,6,7].map(label=>[label,spots.filter(s=>source.labels[s.y*96+s.x]===label).length]))}};
}
export function companionDalmatianParameters(input:RenderInput,veilOverride?:number):CompanionDalmatianParameters {
  const s=input.phenotype.inheritedScores;
  return {...companionPigmentParameters(input,veilOverride),spotDensity:clamp((s.spots-model.densityOffset)/model.densityRange),
    spotSize:clamp((s.contrast-model.sizeOffset)/model.sizeRange),
    spotSeed:Math.floor(seededRandom(input.seed,'companion:dalmatian-shape:1')()*0x100000000)};
}
export function describeCompanionDalmatian(input:RenderInput,veilOverride?:number) {
  const original=describeCompanionPigment(input,veilOverride),parameters=companionDalmatianParameters(input,veilOverride),r=renderCompanionDalmatian(parameters);
  const failed=input.phenotype.observed['lilly-white']==='Lilly 동형접합 비생존';
  return {...original,parameters,spotMetrics:r.spotMetrics,name:!failed&&r.spotMetrics.count?`${original.name} · ${parameters.spotDensity>=.78?'고밀도 달마시안':'달마시안'}`:original.name};
}
export function createCompanionDalmatianRenderer(veilOverride?:number):AppearanceRenderer {
  // Pigment parameter validation includes optional veil validation.
  if(veilOverride!==undefined)unit(veilOverride);
  return {id:veilOverride===undefined?COMPANION_DALMATIAN_RENDERER_ID:`${COMPANION_DALMATIAN_RENDERER_ID}:veil:${veilOverride}`,
    render:input=>renderCompanionDalmatian(companionDalmatianParameters(input,veilOverride)).sprite};
}
export const companionDalmatianRenderer=createCompanionDalmatianRenderer();
