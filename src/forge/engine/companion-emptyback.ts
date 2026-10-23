import { B_ORIGIN_01 as source } from './art/b-origin-01';
import { PINSTRIPE_RAILS } from './art/pinstripe-rails';
import { renderCompanionPhantom, companionPhantomParameters, createCompanionPhantomRenderer, DEFAULT_PHANTOM_PARAMETERS, type CompanionPhantomParameters } from './companion-phantom';
import { classifyCompanionPatterns, describeCompanionPatterns, COMPANION_PATTERNS_MODEL } from './companion-patterns';
import { emptyBackCopies } from './morph-extensions';
import { seededRandom } from './genetics';
import { patternlessTones, type Rgb } from './patternless';
import type { AppearanceRenderer, RenderInput } from './model';
import type { SpriteLayer } from '@/engine/model';

export const COMPANION_EMPTYBACK_RENDERER_ID = 'b-origin-01-companion-emptyback-1' as const;
export const COMPANION_EMPTYBACK_MODEL = {
  version: 1, singleStrength: .50, creamResistance: .20, lillySingleRetention: .68,
  cleanThreshold: .90, visibleContrast: 26,
  inheritance: 'Breeder-reported incomplete dominant extension N/N, N/Eb, Eb/Eb. Original three loci and 60 polygenic loci unchanged.',
  limits: 'Native dorsal appearance and game selection thresholds; not molecular proof or a breeder grading standard. No new mortality rules. C/C retains the existing super art.',
  source: 'https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=53',
} as const;
export interface CompanionEmptyBackParameters extends CompanionPhantomParameters {
  emptyBackCopies: 0 | 1 | 2 | null;
  /** Non-inherited art study coefficient; normal breeding always uses 1. */
  emptyBackExpression: number;
  emptyBackSeed: number;
}
export const DEFAULT_EMPTYBACK_PARAMETERS: Readonly<CompanionEmptyBackParameters> = {
  ...DEFAULT_PHANTOM_PARAMETERS, phantomCopies: 0, emptyBackCopies: 2, emptyBackExpression: 1, emptyBackSeed: 42,
};
const N = 9216, domain = new Uint8Array(N);
const rails = PINSTRIPE_RAILS.rails;
const spans = Array.from({length:96},(_,x)=>{
  const far=rails[0].pixels.filter(i=>i%96===x).map(i=>Math.floor(i/96));
  const near=rails[1].pixels.filter(i=>i%96===x).map(i=>Math.floor(i/96));
  return far.length&&near.length ? {top:Math.max(...far),bottom:Math.min(...near)} : null;
});
source.foreground.forEach((v,i)=>{const c=spans[i%96],y=Math.floor(i/96);if(v&&source.labels[i]===2&&!source.protection[i]&&c&&y>c.top&&y<c.bottom)domain[i]=255;});
export const EMPTYBACK_DORSAL_DOMAIN = domain.slice();
const mix=(a:Rgb,b:Rgb,t:number)=>a.map((v,c)=>Math.round(v+(b[c]-v)*t))as unknown as Rgb;
const rgb=(pixels:Uint8ClampedArray,i:number)=>Array.from(pixels.slice(i*4,i*4+3))as unknown as Rgb;
const distance=(a:Rgb,b:Rgb)=>Math.sqrt(a.reduce((s,v,c)=>s+(v-b[c])**2,0));
const tone=(i:number)=>source.shading[i]===1?'highlight':source.shading[i]===3?'shadow':'base';
export function buildEmptyBackMask(strength:number,seed:number) {
  if(!Number.isFinite(strength)||strength<0||strength>1||!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('등 비움 강도는 0~1, 시드는 uint32여야 합니다.');
  const mask=new Uint8Array(N);if(!strength)return mask;
  const rng=seededRandom(String(seed),'companion:empty-back-shape:1'),phase=rng()*Math.PI*2,phase2=rng()*Math.PI*2;
  domain.forEach((v,i)=>{if(!v)return;const x=i%96,c=spans[x]!,u=(Math.floor(i/96)-c.top)/(c.bottom-c.top),bend=Math.sin(x*.12+phase)*.10;
    const width=Math.min(1,Math.abs(u-.5-bend)*2),wave=.5+.32*Math.sin(x*.17+phase)+.18*Math.sin(x*.065+phase2);
    if(strength===1||.72*width+.28*wave<=strength)mask[i]=255;
  });
  return mask;
}
export function renderCompanionEmptyBack(p:CompanionEmptyBackParameters) {
  if(![null,0,1,2].includes(p.emptyBackCopies))throw Error('엠티백 사본은 0·1·2 또는 미기록이어야 합니다.');
  buildEmptyBackMask(p.emptyBackExpression,p.emptyBackSeed);
  const base=renderCompanionPhantom(p),active=!!p.emptyBackCopies&&p.cappuccinoCopies!==2;
  const strength=active?p.emptyBackExpression*(p.emptyBackCopies===2?1:COMPANION_EMPTYBACK_MODEL.singleStrength*(1-COMPANION_EMPTYBACK_MODEL.creamResistance*p.creamCoverage)*(p.lilly?COMPANION_EMPTYBACK_MODEL.lillySingleRetention:1)):0;
  const plan=buildEmptyBackMask(strength,p.emptyBackSeed),mask=new Uint8Array(N),albedo=new Uint8ClampedArray(N*4),pixels=base.sprite.pixels.slice();
  const visibleStripeMask=base.visibleStripeMask.slice(),visiblePatternMask=base.visiblePatternMask.slice(),whiteMask=base.whiteMask.slice();
  const skin=base.pigment.skin.resolved,white=base.pigment.white;
  const veil=base.veilMetrics.strength*(p.emptyBackCopies===2?0:.35);
  const eligible=Array.from(domain).flatMap((v,i)=>v&&!base.spotMask[i]&&!base.pinMask[i]&&!base.pinSpreadMask[i]?[i]:[]);
  for(const i of eligible)if(plan[i]){
    const t=tone(i),lit=mix(patternlessTones(skin)[t],patternlessTones(white)[t],veil);
    pixels.set([...lit,pixels[i*4+3]],i*4);albedo.set([...skin,255],i*4);mask[i]=255;visibleStripeMask[i]=0;visiblePatternMask[i]=0;whiteMask[i]=0;
  }
  const cleanPixels=eligible.filter(i=>distance(rgb(pixels,i),patternlessTones(skin)[tone(i)])<COMPANION_EMPTYBACK_MODEL.visibleContrast).length;
  const cleanCoverage=eligible.length?cleanPixels/eligible.length:0,cleared=mask.filter(Boolean).length;
  const classification=p.emptyBackCopies===null?'unrecorded':p.emptyBackCopies===0?'normal':p.cappuccinoCopies===2?'super-art-preserved':cleanCoverage>=COMPANION_EMPTYBACK_MODEL.cleanThreshold?'clean':'partial';
  const emptyBackMetrics={copies:p.emptyBackCopies,applied:cleared>0,strength,classification,
    dorsalPixels:eligible.length,clearedPixels:cleared,clearedCoverage:eligible.length?cleared/eligible.length:0,cleanPixels,cleanCoverage,
    remainingPatternPixels:eligible.length-cleanPixels,preservedDorsalSpots:domain.filter((v,i)=>v&&base.spotMask[i]).length,
    structuralPinCoverage:base.pinMetrics.coverage,lateralCoverage:base.patternMetrics.lateralCoverage,
    goal:!!p.emptyBackCopies&&p.cappuccinoCopies!==2&&cleanCoverage>=COMPANION_EMPTYBACK_MODEL.cleanThreshold&&base.pinMetrics.classification==='full'&&base.patternMetrics.lateralCoverage>=.5};
  // Unexpressed and zero-strength animals retain the previous RGBA and layers.
  if(!cleared)return {...base,sprite:{...base.sprite,version:COMPANION_EMPTYBACK_RENDERER_ID},emptyBackMask:mask,emptyBackAlbedo:albedo,emptyBackMetrics};
  const rows=Array.from({length:6},()=>new Set<number>());let stripePixels=0,contrast=0;
  visibleStripeMask.forEach((v,i)=>{if(!v)return;stripePixels++;
    contrast+=distance(rgb(pixels,i),mix(patternlessTones(skin)[tone(i)],patternlessTones(white)[tone(i)],base.veilMetrics.strength));
    if([2,3,4].includes(source.labels[i])&&base.stripeOwners[i])rows[base.stripeOwners[i]-1].add(Math.floor(i/96));
  });
  const tracks=rows.map(s=>{const ys=[...s].sort((a,b)=>a-b);let run=0,longest=0,prior=-2;for(const y of ys){run=y===prior+1?run+1:1;prior=y;longest=Math.max(longest,run);}const span=ys.length?ys.at(-1)!-ys[0]+1:0;return{rows:ys.length,span,longest,gaps:span-ys.length};});
  const good=tracks.filter(t=>t.rows>=5),span=good.reduce((s,t)=>s+t.span,0),fragmentation=span?good.reduce((s,t)=>s+t.gaps,0)/span:0,stripeContrast=stripePixels?contrast/stripePixels:0;
  const stripeClass=good.length<3||stripeContrast<COMPANION_PATTERNS_MODEL.stripe.minimumMeanContrast?'none':p.brindleStrength>=.55&&fragmentation>=.12?'brindle':'tiger';
  const observation={lateralCoverage:base.patternMetrics.lateralCoverage,upperCoverage:base.patternMetrics.upperCoverage,legCoverage:base.patternMetrics.legCoverage,stripeClass,clearTricolor:base.tricolorMetrics.clear,superForm:false}as const;
  const patternMetrics={...base.patternMetrics,...observation,...classifyCompanionPatterns(observation),tracks,fragmentation,stripePixels,stripeContrast,stripeQuality:Math.round(100*Math.min(1,stripeContrast/150)*Math.min(1,good.length/5))};
  const layer:SpriteLayer={name:'details',mask,pixels:pixels.slice()};
  return {...base,sprite:{...base.sprite,version:COMPANION_EMPTYBACK_RENDERER_ID,pixels,layers:[...base.sprite.layers,layer]},
    latentPatternMetrics:base.patternMetrics,whiteMask,visiblePatternMask,visibleStripeMask,patternMetrics,emptyBackMask:mask,emptyBackAlbedo:albedo,emptyBackMetrics,
    whiteMetrics:{...base.whiteMetrics,whitePixels:whiteMask.filter(Boolean).length}};
}
export function companionEmptyBackParameters(input:RenderInput,veilOverride?:number):CompanionEmptyBackParameters {
  return {...companionPhantomParameters(input,veilOverride),emptyBackCopies:emptyBackCopies(input.extensions),emptyBackExpression:1,
    emptyBackSeed:Math.floor(seededRandom(input.seed,'companion:empty-back-layout:1')()*0x100000000)};
}
export function describeCompanionEmptyBack(input:RenderInput,veilOverride?:number) {
  const parameters=companionEmptyBackParameters(input,veilOverride),r=renderCompanionEmptyBack(parameters),old=describeCompanionPatterns(input,veilOverride,()=>r);
  const label=parameters.emptyBackCopies===2?'슈퍼 엠티백':parameters.emptyBackCopies===1?'엠티백':'';
  return {...old,parameters,emptyBackMetrics:r.emptyBackMetrics,name:[label,parameters.phantomCopies===2?'팬텀':'',old.name].filter(Boolean).join(' · ')};
}
export function createCompanionEmptyBackRenderer(veilOverride?:number):AppearanceRenderer {
  createCompanionPhantomRenderer(veilOverride);
  return {id:veilOverride===undefined?COMPANION_EMPTYBACK_RENDERER_ID:`${COMPANION_EMPTYBACK_RENDERER_ID}:veil:${veilOverride}`,render:input=>renderCompanionEmptyBack(companionEmptyBackParameters(input,veilOverride)).sprite};
}
export const companionEmptyBackRenderer=createCompanionEmptyBackRenderer();
