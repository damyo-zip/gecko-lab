import { B_ORIGIN_01 as source } from './art/b-origin-01';
import { renderCompanionBase } from './companion-base';
import { companionPigmentParameters, describeCompanionPigment, renderCompanionPigment } from './companion-pigment';
import { seededRandom } from './genetics';
import { patternlessTones } from './patternless';
import type { CompanionDalmatianParameters } from './companion-dalmatian';
import type { AppearanceRenderer, RenderInput } from './model';
import type { SpriteLayer } from '@/engine/model';

export type { CompanionDalmatianParameters } from './companion-dalmatian';
export const COMPANION_DALMATIAN_RENDERER_ID = 'b-origin-01-companion-dalmatian-2' as const;
export const DALMATIAN_SPOT_SHAPES = {
  single: [[0, 0]],
  square: [[0, 0], [1, 0], [0, 1], [1, 1]],
  cross: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]],
} as const;
type Shape = keyof typeof DALMATIAN_SPOT_SHAPES;
export const COMPANION_DALMATIAN_MODEL = {
  version: 2, maximumSpots: 48, minimumArea: 1, maximumArea: 5, eightNeighborSeparation: true,
  faceInterval: 6, shapes: DALMATIAN_SPOT_SHAPES,
  densityOffset: .18, densityRange: .44, sizeOffset: .15, sizeRange: .7,
  countFeature: 'spots', sizeFeature: 'contrast',
  pigment: [27, 24, 22] as const, axanthicPigment: [25, 26, 29] as const,
  composition: 'independent dark material after flame, axanthic and Lilly veil; authored lighting once',
  limits: 'existing virtual polygenic traits, no new Mendelian locus or real causal size-gene claim',
} as const;
export const DALMATIAN_COMPARISON = [
  {id:'few-large',name:'작은 반점 소수형',spotDensity:.15,spotSize:.95},
  {id:'medium',name:'중간 밀도형',spotDensity:.5,spotSize:.5},
  {id:'dense',name:'고밀도형',spotDensity:.95,spotSize:.35},
] as const;
interface Spot { center: number; shape: Shape; pixels: number[] }
const N = 96 * 96, model = COMPANION_DALMATIAN_MODEL;
const materials = renderCompanionBase().materialMask;
// The head is eligible too; original protection still excludes eyes, mouth and nostrils.
const eligible = Uint8Array.from(source.foreground, (v,i) => v && !source.protection[i] && ![3,5].includes(materials[i]) ? 1 : 0);
const near = (i:number) => [i%96 ? i-1 : -1, i%96<95 ? i+1 : -1, i-96, i+96];
const around = (i:number) => [...near(i),i-97,i-95,i+95,i+97].filter(j => j>=0 && j<N && Math.abs(j%96-i%96)<=1);
const centers = Array.from(eligible).flatMap((v,i) => v && near(i).every(j => j>=0 && j<N && source.foreground[j] && !source.protection[j]) ? [i] : []);
const plans = new Map<string,Spot[]>();
const clamp = (n:number) => Math.max(0,Math.min(1,n));
function unit(n:number) { if(typeof n!=='number' || !Number.isFinite(n) || n<0 || n>1) throw Error('반점의 수·크기는 0~1이어야 합니다.'); }

function plan(seed:number, size:number) {
  const key = `${seed}:${size}`, cached = plans.get(key); if(cached) return cached;
  const rng = seededRandom(String(seed),'companion:dalmatian-plan:2'), ordered = centers.slice();
  for(let i=ordered.length-1;i>0;i--) { const j=Math.floor(rng()*(i+1)); [ordered[i],ordered[j]]=[ordered[j],ordered[i]]; }
  const face = ordered.filter(i => source.labels[i]===1), body = ordered.filter(i => source.labels[i]!==1);
  const spots:Spot[] = [], occupied = new Set<number>();
  function place(pool:number[], shape:Shape) {
    for(const center of pool) {
      const x=center%96, y=Math.floor(center/96), pixels:number[]=[];
      for(const [dx,dy] of DALMATIAN_SPOT_SHAPES[shape]) {
        const px=x+dx, py=y+dy, i=py*96+px;
        if(px<0 || px>=96 || py<0 || py>=96 || !eligible[i] ||
          near(i).some(j => j<0 || j>=N || !source.foreground[j] || source.protection[j]) ||
          occupied.has(i) || around(i).some(j => occupied.has(j))) break;
        pixels.push(i);
      }
      if(pixels.length!==DALMATIAN_SPOT_SHAPES[shape].length) continue;
      pixels.forEach(i => occupied.add(i)); spots.push({center,shape,pixels}); return true;
    }
    return false;
  }
  for(let n=0;n<model.maximumSpots;n++) {
    // Size changes the mixture of exact stencils, never their outlines or pixel count.
    const roll=rng(), shape:Shape=roll<1-.7*size ? 'single' : roll<1-.3*size ? 'square' : 'cross';
    const faceTurn=n%model.faceInterval===0;
    if(!place(faceTurn?face:body,shape) && !place(faceTurn?body:face,shape)) break;
  }
  plans.set(key,spots); if(plans.size>64) plans.delete(plans.keys().next().value!); return spots;
}

export function renderCompanionDalmatian(parameters:CompanionDalmatianParameters) {
  unit(parameters.spotDensity); unit(parameters.spotSize);
  if(!Number.isInteger(parameters.spotSeed) || parameters.spotSeed<0 || parameters.spotSeed>0xffffffff) throw Error('반점 시드는 0~4294967295 정수여야 합니다.');
  const base=renderCompanionPigment(parameters), pixels=base.sprite.pixels.slice(), spotMask=new Uint8Array(N), spotIds=new Uint8Array(N);
  const requestedCount=Math.round(parameters.spotDensity*model.maximumSpots);
  const spots=requestedCount ? plan(parameters.spotSeed,parameters.spotSize).slice(0,requestedCount) : [];
  const tones=patternlessTones(parameters.axanthic?model.axanthicPigment:model.pigment);
  const layer:SpriteLayer={name:'spots',mask:spotMask,pixels:new Uint8ClampedArray(pixels.length)};
  spots.forEach((s,n) => s.pixels.forEach(i => {
    const rgb=source.shading[i]===1?tones.highlight:source.shading[i]===3?tones.shadow:tones.base;
    spotMask[i]=255; spotIds[i]=n+1; pixels.set([...rgb,pixels[i*4+3]],i*4); layer.pixels.set(pixels.slice(i*4,i*4+4),i*4);
  }));
  const count=spotMask.filter(Boolean).length;
  return {...base,sprite:{...base.sprite,version:COMPANION_DALMATIAN_RENDERER_ID,pixels,
    layers:spots.length?[...base.sprite.layers,layer]:base.sprite.layers},spotMask,spotIds,
    spotMetrics:{requestedCount,count:spots.length,pixels:count,meanArea:spots.length?count/spots.length:0,
      bodyCoverage:count/source.foreground.filter(Boolean).length,
      faceCount:spots.filter(s => source.labels[s.center]===1).length,
      shapeCounts:{single:spots.filter(s=>s.shape==='single').length,square:spots.filter(s=>s.shape==='square').length,cross:spots.filter(s=>s.shape==='cross').length},
      regions:Object.fromEntries([1,2,3,4,5,6,7].map(label=>[label,spots.filter(s=>source.labels[s.center]===label).length]))}};
}
export function companionDalmatianParameters(input:RenderInput,veilOverride?:number):CompanionDalmatianParameters {
  const s=input.phenotype.inheritedScores;
  return {...companionPigmentParameters(input,veilOverride),spotDensity:clamp((s.spots-model.densityOffset)/model.densityRange),
    spotSize:clamp((s.contrast-model.sizeOffset)/model.sizeRange),
    spotSeed:Math.floor(seededRandom(input.seed,'companion:dalmatian-shape:1')()*0x100000000)};
}
export function describeCompanionDalmatian(input:RenderInput,veilOverride?:number) {
  const original=describeCompanionPigment(input,veilOverride), parameters=companionDalmatianParameters(input,veilOverride), r=renderCompanionDalmatian(parameters);
  const failed=input.phenotype.observed['lilly-white']==='Lilly 동형접합 비생존';
  return {...original,parameters,spotMetrics:r.spotMetrics,name:!failed&&r.spotMetrics.count?`${original.name} · ${parameters.spotDensity>=.78?'고밀도 달마시안':'달마시안'}`:original.name};
}
export function createCompanionDalmatianRenderer(veilOverride?:number):AppearanceRenderer {
  if(veilOverride!==undefined) unit(veilOverride);
  return {id:veilOverride===undefined?COMPANION_DALMATIAN_RENDERER_ID:`${COMPANION_DALMATIAN_RENDERER_ID}:veil:${veilOverride}`,
    render:input=>renderCompanionDalmatian(companionDalmatianParameters(input,veilOverride)).sprite};
}
export const companionDalmatianRenderer=createCompanionDalmatianRenderer();
