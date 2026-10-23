import {B_ORIGIN_01 as source} from './art/b-origin-01';
import {renderCompanionBase} from './companion-base';
import {PINSTRIPE_RAILS} from './art/pinstripe-rails';
import {EMPTYBACK_DORSAL_DOMAIN as sourceDorsalDomain,COMPANION_EMPTYBACK_MODEL} from './companion-emptyback';
import {renderCompanionLaterals,companionLateralParameters,createCompanionLateralRenderer,type CompanionLateralParameters} from './companion-laterals';
import {classifyCompanionPatterns,describeCompanionPatterns,measureCompanionPatternTricolor} from './companion-patterns';
import {seededRandom} from './genetics';
import {patternlessTones,type Rgb} from './patternless';
import type {AppearanceRenderer,RenderInput} from './model';
import type {SpriteLayer} from '@/engine/model';

export const COMPANION_DORSAL_RENDERER_ID='b-origin-01-companion-dorsal-1' as const;
export const COMPANION_DORSAL_MODEL={version:1,
  reverse:{coverage:.80,contrast:26},superstripe:{coverage:.85,longestRun:.80,contrast:30,minimumBandPixels:16,minimumPinCoverage:.9},
  inheritance:'No new locus. Reverse Pinstripe uses existing tiger/pin/contrast traits. Superstripe is an experimental EB/pin/cream combination, not a claimed confirmed gene model.',
  limits:'Shared native side-view projection. No new ridge geometry, raised scale simulation, health rule or assertion of proven Superstripe inheritance.',
  references:['https://lmreptiles.com/fg-pt2-1/','https://www.coloradocresties.com/morph-traits']
}as const;
export interface CompanionDorsalParameters extends CompanionLateralParameters {reversePinStrength:number;superStripeStrength:number;dorsalSeed:number}
const roles=renderCompanionBase().materialMask,dorsalDomain=sourceDorsalDomain.slice();
const N=9216,clamp=(v:number)=>Math.max(0,Math.min(1,v));
const mix=(a:Rgb,b:Rgb,t:number)=>a.map((v,c)=>Math.round(v+(b[c]-v)*t))as unknown as Rgb;
const rgb=(a:Uint8ClampedArray,i:number)=>Array.from(a.slice(i*4,i*4+3))as unknown as Rgb;
const distance=(a:Rgb,b:Rgb)=>Math.sqrt(a.reduce((s,v,c)=>s+(v-b[c])**2,0));
const lum=(a:Rgb)=>a[0]*.2126+a[1]*.7152+a[2]*.0722;
const tone=(i:number)=>source.shading[i]===1?'highlight':source.shading[i]===3?'shadow':'base';
function unit(v:number){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1)throw Error('등줄 발현은 0~1이어야 합니다.');}
const rails=PINSTRIPE_RAILS.rails;
const spans=Array.from({length:96},(_,x)=>{
  const a=rails[0].pixels.filter(i=>i%96===x).map(i=>Math.floor(i/96)),b=rails[1].pixels.filter(i=>i%96===x).map(i=>Math.floor(i/96));
  if(!a.length||!b.length)return null;
  const top=Math.max(...a),bottom=Math.min(...b),ys=[];for(let y=top+1;y<bottom;y++)if(dorsalDomain[y*96+x])ys.push(y);
  if(!ys.length)return null;const centre=[...ys].sort((a,b)=>Math.abs(a-(top+bottom)/2)-Math.abs(b-(top+bottom)/2))[0];return{top,bottom,centre};
});
const reversePath=new Map<number,number>();
for(let x=42;x<=74;x++){
  const rows=rails[1].pixels.filter(i=>i%96===x).map(i=>Math.floor(i/96));if(!rows.length)continue;
  const root=Math.max(...rows),y=[root+3,root+2,root+4].find(y=>source.labels[y*96+x]===3&&!source.protection[y*96+x]&&!source.protection[(y-1)*96+x]&&source.foreground[(y-1)*96+x]);
  if(y!==undefined)reversePath.set(x,y*96+x);
}
export const REVERSE_PIN_DOMAIN=new Uint8Array(N);reversePath.forEach(i=>REVERSE_PIN_DOMAIN[i]=255);
export function buildDorsalDetails(reverseStrength:number,superStrength:number,seed:number){
  unit(reverseStrength);unit(superStrength);if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('등줄 시드는 uint32여야 합니다.');
  const reverse=new Uint8Array(N),bands=new Uint8Array(N),centre=new Uint8Array(N),rng=seededRandom(String(seed),'companion:dorsal-details:1'),phase=rng()*Math.PI*2;
  reversePath.forEach((i,x)=>{const priority=.08+.88*(.5+.5*Math.sin((x-42)*.24+phase));if(reverseStrength>=priority)reverse[i]=255;});
  if(superStrength)dorsalDomain.forEach((v,i)=>{if(!v)return;const x=i%96,y=Math.floor(i/96),s=spans[x];if(!s)return;
    const edge=Math.min(y-s.top,s.bottom-y)/Math.max(1,(s.bottom-s.top)/2),growth=superStrength===1?1:superStrength*(.9+.1*Math.sin(x*.14+phase));
    if(y===s.centre){if(superStrength>=.5)centre[i]=255;}
    else if(edge<=growth)bands[i]=255;
  });
  return{reverse,bands,centre};
}
function runRatio(columns:number[],visible:Set<number>){let longest=0,run=0;for(const x of columns){run=visible.has(x)?run+1:0;longest=Math.max(longest,run);}return columns.length?longest/columns.length:0;}
export function renderCompanionDorsal(p:CompanionDorsalParameters){
  const plan=buildDorsalDetails(p.reversePinStrength,p.superStripeStrength,p.dorsalSeed),base=renderCompanionLaterals(p);
  const mask=new Uint8Array(N),reverse=new Uint8Array(N),band=new Uint8Array(N),centre=new Uint8Array(N),albedo=new Uint8ClampedArray(N*4),pixels=base.sprite.pixels.slice();
  const visiblePatternMask=base.visiblePatternMask.slice(),visibleStripeMask=base.visibleStripeMask.slice(),materials=base.visibleTricolorMaterials.slice(),whiteMask=base.whiteMask.slice(),emptyBackMask=base.emptyBackMask.slice();
  const skin=base.pigment.skin.resolved,cream=base.pigment.pattern.resolved,warmInk=mix(p.stripeColor,[20,18,19],.75),neutralInk=Array(3).fill(Math.round(lum(warmInk)))as unknown as Rgb,ink=mix(skin,mix(warmInk,neutralInk,base.pigment.suppression),.68+.20*p.reversePinStrength),veil=base.veilMetrics.strength,veilTones=patternlessTones(base.pigment.white);
  const lit=(material:Rgb,i:number)=>mix(patternlessTones(material)[tone(i)],veilTones[tone(i)],veil);
  const allowed=(i:number)=>source.foreground[i]&&!source.protection[i]&&!base.spotMask[i]&&!base.pinMask[i]&&!base.pinSpreadMask[i]&&!base.forelegRefinementMask[i];
  const active=p.cappuccinoCopies!==2,reverseColumns=new Set<number>();
  const put=(i:number,material:Rgb,target:Uint8Array)=>{pixels.set([...lit(material,i),pixels[i*4+3]],i*4);albedo.set([...material,255],i*4);mask[i]=target[i]=255;visiblePatternMask[i]=visibleStripeMask[i]=0;materials[i]=target===centre?1:5;whiteMask[i]=target===band?255:0;if(target===band)emptyBackMask[i]=0;};
  if(active){
    plan.reverse.forEach((v,i)=>{if(!v||!allowed(i)||base.lateralMask[i]||base.whitewallMask[i])return;const x=i%96;if(!rails[1].pixels.some(j=>j%96===x&&base.pinMask[j]))return;
      // Dark pigment cannot lighten an already darker Tiger or skin pixel.
      if(lum(lit(ink,i))>=lum(rgb(base.sprite.pixels,i)))return;
      put(i,ink,reverse);if(distance(rgb(pixels,i),rgb(base.sprite.pixels,i))>=COMPANION_DORSAL_MODEL.reverse.contrast&&lum(rgb(pixels,i))<lum(rgb(base.sprite.pixels,i)))reverseColumns.add(x);
    });
    plan.bands.forEach((v,i)=>{if(v&&allowed(i))put(i,cream,band);});
    plan.centre.forEach((v,i)=>{if(v&&allowed(i))put(i,skin,centre);});
  }
  const columns=spans.flatMap((s,x)=>s?[x]:[]),visibleCentre=new Set<number>();let contrastSum=0;
  for(const x of columns){const s=spans[x]!,i=s.centre*96+x;if(!centre[i])continue;
    const middle=rgb(pixels,i),a=rgb(pixels,(s.centre-1)*96+x),b=rgb(pixels,(s.centre+1)*96+x),contrast=Math.min(lum(a)-lum(middle),lum(b)-lum(middle));
    if(contrast>=COMPANION_DORSAL_MODEL.superstripe.contrast&&distance(middle,lit(skin,i))<=12){visibleCentre.add(x);contrastSum+=contrast;}
  }
  const reverseCoverage=reversePath.size?reverseColumns.size/reversePath.size:0,centreCoverage=columns.length?visibleCentre.size/columns.length:0,centreRun=runRatio(columns,visibleCentre),bandsN=band.filter(Boolean).length;
  const reverseQualified=reverseCoverage>=COMPANION_DORSAL_MODEL.reverse.coverage;
  const superQualified=base.pinMetrics.coverage>=COMPANION_DORSAL_MODEL.superstripe.minimumPinCoverage&&bandsN>=COMPANION_DORSAL_MODEL.superstripe.minimumBandPixels&&centreCoverage>=COMPANION_DORSAL_MODEL.superstripe.coverage&&centreRun>=COMPANION_DORSAL_MODEL.superstripe.longestRun;
  const dorsalMetrics={reverse:{strength:p.reversePinStrength,paintedPixels:reverse.filter(Boolean).length,visibleColumns:reverseColumns.size,totalColumns:reversePath.size,coverage:reverseCoverage,qualified:reverseQualified},
    superstripe:{strength:p.superStripeStrength,bandPixels:bandsN,centrePixels:centre.filter(Boolean).length,visibleColumns:visibleCentre.size,totalColumns:columns.length,coverage:centreCoverage,longestRun:centreRun,meanContrast:visibleCentre.size?contrastSum/visibleCentre.size:0,qualified:superQualified},
    goal:superQualified&&base.pinMetrics.classification==='full'&&base.lateralMetrics.quad,
    reverseGoal:reverseQualified&&base.pinMetrics.classification==='full'&&base.lateralMetrics.quad};
  if(!mask.some(Boolean))return{...base,sprite:{...base.sprite,version:COMPANION_DORSAL_RENDERER_ID},dorsalDetailsMask:mask,reversePinMask:reverse,superStripeBandMask:band,superStripeCentreMask:centre,dorsalAlbedo:albedo,dorsalMetrics};
  // Re-observe occluded ordinary/tiger pattern and the genuinely clean EB area.
  const sideIndices=source.labels.flatMap((v,i)=>[3,4].includes(v)&&source.foreground[i]&&!source.protection[i]&&![1,2,3,5].includes(roles[i])&&!base.forelegRefinementMask[i]?[i]:[]),count=(label?:number)=>{const a=sideIndices.filter(i=>label===undefined||source.labels[i]===label);return a.length?a.filter(i=>visiblePatternMask[i]).length/a.length:0;};
  const lateralCoverage=count(),upperCoverage=count(3),tricolorMetrics=measureCompanionPatternTricolor(pixels,materials,p,lateralCoverage);
  const tracks=Array.from({length:6},(_,n)=>{const ys=[...new Set(Array.from(visibleStripeMask).flatMap((v,i)=>v&&base.stripeOwners[i]===n+1&&[2,3,4].includes(source.labels[i])?[Math.floor(i/96)]:[]))].sort((a,b)=>a-b),span=ys.length?ys.at(-1)!-ys[0]+1:0;let longest=0,run=0,prior=-2;for(const y of ys){run=y===prior+1?run+1:1;prior=y;longest=Math.max(longest,run);}return{rows:ys.length,span,longest,gaps:span-ys.length};});
  let stripePixels=0,stripeContrast=0;visibleStripeMask.forEach((v,i)=>{if(v){stripePixels++;stripeContrast+=distance(rgb(pixels,i),lit(skin,i));}});stripeContrast=stripePixels?stripeContrast/stripePixels:0;
  const good=tracks.filter(t=>t.rows>=5),span=good.reduce((s,t)=>s+t.span,0),fragmentation=span?good.reduce((s,t)=>s+t.gaps,0)/span:0,stripeClass=good.length<3||stripeContrast<55?'none':p.brindleStrength>=.55&&fragmentation>=.12?'brindle':'tiger';
  const observation={lateralCoverage,upperCoverage,legCoverage:base.patternMetrics.legCoverage,stripeClass,clearTricolor:tricolorMetrics.clear,superForm:false}as const;
  const rises=Array.from({length:96},(_,x)=>{const all=sideIndices.filter(i=>i%96===x).map(i=>Math.floor(i/96)),pattern=all.filter(y=>visiblePatternMask[y*96+x]);return all.length&&pattern.length?(Math.max(...all)-Math.min(...pattern)+1)/(Math.max(...all)-Math.min(...all)+1):0;});
  const patternMetrics={...base.patternMetrics,...observation,...classifyCompanionPatterns(observation),tracks,stripePixels,stripeContrast,fragmentation,maximumRise:Math.max(...rises),meanRise:rises.reduce((s,v)=>s+v,0)/rises.filter(Boolean).length||0,stripeQuality:Math.round(100*Math.min(1,stripeContrast/150)*Math.min(1,good.length/5))};
  const ebIndices=Array.from(dorsalDomain).flatMap((v,i)=>v&&allowed(i)?[i]:[]),clean=ebIndices.filter(i=>distance(rgb(pixels,i),patternlessTones(skin)[tone(i)])<COMPANION_EMPTYBACK_MODEL.visibleContrast).length,cleanCoverage=ebIndices.length?clean/ebIndices.length:0;
  const emptyBackMetrics={...base.emptyBackMetrics,cleanPixels:clean,cleanCoverage,clearedPixels:emptyBackMask.filter(Boolean).length,clearedCoverage:ebIndices.length?emptyBackMask.filter(Boolean).length/ebIndices.length:0,remainingPatternPixels:ebIndices.length-clean,classification:p.emptyBackCopies===null?'unrecorded':p.emptyBackCopies===0?'normal':cleanCoverage>=.9?'clean':'partial',lateralCoverage,goal:!!p.emptyBackCopies&&cleanCoverage>=.9&&base.pinMetrics.classification==='full'&&lateralCoverage>=.5};
  const layer:SpriteLayer={name:'details',mask,pixels:pixels.slice()};
  return{...base,sprite:{...base.sprite,version:COMPANION_DORSAL_RENDERER_ID,pixels,layers:[...base.sprite.layers,layer]},dorsalDetailsMask:mask,reversePinMask:reverse,superStripeBandMask:band,superStripeCentreMask:centre,dorsalAlbedo:albedo,dorsalMetrics,
    visiblePatternMask,visibleStripeMask,visibleTricolorMaterials:materials,whiteMask,emptyBackMask,emptyBackMetrics,whitewallMetrics:{...base.whitewallMetrics,emptyBackGoal:base.whitewallMetrics.qualified&&base.pinMetrics.classification==='full'&&!!p.emptyBackCopies&&cleanCoverage>=.9},patternMetrics,tricolorMetrics,latentEmptyBackMetrics:base.emptyBackMetrics,
    combinedVisibleLateralMask:visiblePatternMask.map((v,i)=>v||base.visibleLateralMask[i]||base.visibleWhitewallMask[i]?255:0),
    whiteMetrics:{...base.whiteMetrics,whitePixels:whiteMask.filter(Boolean).length,whiteLateralPixels:whiteMask.filter((v,i)=>v&&[3,4].includes(source.labels[i])).length,whiteLateralCoverage:whiteMask.filter((v,i)=>v&&[3,4].includes(source.labels[i])).length/sideIndices.length}};
}
export function companionDorsalParameters(input:RenderInput,veilOverride?:number):CompanionDorsalParameters {
  const p=companionLateralParameters(input,veilOverride),s=input.phenotype.inheritedScores,dose=p.emptyBackCopies===2?1:p.emptyBackCopies===1?.52:0;
  return{...p,reversePinStrength:p.stripeStrength*p.pinStrength*clamp((s.contrast-.3)/.4),superStripeStrength:dose*p.pinStrength*clamp((s.cream-.55)/.28),dorsalSeed:Math.floor(seededRandom(input.seed,'companion:dorsal-layout:1')()*0x100000000)};
}
export function describeCompanionDorsal(input:RenderInput,veilOverride?:number){const parameters=companionDorsalParameters(input,veilOverride),r=renderCompanionDorsal(parameters),old=describeCompanionPatterns(input,veilOverride,()=>r);
  return{...old,parameters,dorsalMetrics:r.dorsalMetrics,lateralMetrics:r.lateralMetrics,emptyBackMetrics:r.emptyBackMetrics,name:[r.dorsalMetrics.superstripe.qualified?'슈퍼스트라이프':r.dorsalMetrics.superstripe.bandPixels?(r.dorsalMetrics.superstripe.visibleColumns?'중앙줄 발현 중':'중앙줄 대비 낮음'):'',r.dorsalMetrics.reverse.qualified?'리버스 핀스트라이프':'',r.lateralMetrics.quad?'쿼드스트라이프':r.lateralMetrics.classification==='porthole'?'포트홀':'',r.whitewallMetrics.qualified?'화이트월':'',parameters.phantomCopies===2?'팬텀':'',old.name].filter(Boolean).join(' · ')};
}
export function createCompanionDorsalRenderer(veilOverride?:number):AppearanceRenderer{createCompanionLateralRenderer(veilOverride);return{id:veilOverride===undefined?COMPANION_DORSAL_RENDERER_ID:`${COMPANION_DORSAL_RENDERER_ID}:veil:${veilOverride}`,render:input=>renderCompanionDorsal(companionDorsalParameters(input,veilOverride)).sprite};}
export const companionDorsalRenderer=createCompanionDorsalRenderer();
