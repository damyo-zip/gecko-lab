import {B_ORIGIN_01 as source} from './art/b-origin-01';
import {renderCompanionBase} from './companion-base';
import {renderCompanionEmptyBack,companionEmptyBackParameters,createCompanionEmptyBackRenderer,DEFAULT_EMPTYBACK_PARAMETERS,type CompanionEmptyBackParameters} from './companion-emptyback';
import {classifyCompanionPatterns,describeCompanionPatterns,measureCompanionPatternTricolor} from './companion-patterns';
import {whiteoutCopies} from './morph-extensions';
import {seededRandom} from './genetics';
import {patternlessTones,type Rgb} from './patternless';
import type {AppearanceRenderer,RenderInput} from './model';
import type {SpriteLayer} from '@/engine/model';

export const COMPANION_WHITEWALL_RENDERER_ID='b-origin-01-companion-whitewall-1' as const;
export const COMPANION_WHITEWALL_MODEL={version:1,singleExpression:.46,
  thresholds:{coverage:.45,columnCoverage:.85,longestRun:.80,minimumColumnPixels:2,visibleContrast:26,meanContrast:40},
  inheritance:'Breeder-reported Whiteout incomplete dominance; Whitewall is observed coverage and continuity, not an inherited name. Existing flank/harlequin are game modifiers, not a proven lateral-stripe locus.',
  limits:'Native lower-lateral material model. No new mortality. Raised scale relief, Portholes, growth and all line interactions are not simulated. C/C keeps existing super art.',
  references:['https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=44','https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=54'],
}as const;
export interface CompanionWhitewallParameters extends CompanionEmptyBackParameters {
  whiteoutCopies:0|1|2|null;
  /** Independent non-inherited art coefficient; actual animals always use 1. */
  whitewallExpression:number;
  /** Game modifier derived from existing flank/harlequin alleles. */
  wallContinuity:number;
  whitewallColor:Rgb;
  whitewallSeed:number;
}
export const DEFAULT_WHITEWALL_PARAMETERS:Readonly<CompanionWhitewallParameters>={...DEFAULT_EMPTYBACK_PARAMETERS,emptyBackCopies:0,whiteoutCopies:2,whitewallExpression:1,wallContinuity:1,whitewallColor:[254,249,230],whitewallSeed:42};
const N=9216,roles=renderCompanionBase().materialMask;
const side=(i:number)=>[3,4].includes(source.labels[i]);
const columns=Array.from({length:96},(_,x)=>{const ys=source.labels.flatMap((_,i)=>i%96===x&&side(i)?[Math.floor(i/96)]:[]);return ys.length?{top:Math.min(...ys),bottom:Math.max(...ys)}:null;});
const tone=(i:number)=>source.shading[i]===1?'highlight':source.shading[i]===3?'shadow':'base';
const mix=(a:Rgb,b:Rgb,t:number)=>a.map((v,c)=>Math.round(v+(b[c]-v)*t))as unknown as Rgb;
const rgb=(pixels:Uint8ClampedArray,i:number)=>Array.from(pixels.slice(i*4,i*4+3))as unknown as Rgb;
const distance=(a:Rgb,b:Rgb)=>Math.sqrt(a.reduce((s,v,c)=>s+(v-b[c])**2,0));
const unit=(v:number)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1)throw Error('화이트월 발현과 연결 바탕은 0~1이어야 합니다.');};
const domain=new Uint8Array(N);
// Begin behind the foreleg root, keeping the approved rear-armpit area quiet.
source.foreground.forEach((v,i)=>{const x=i%96,c=columns[x];if(v&&side(i)&&!source.protection[i]&&![1,2,3,5].includes(roles[i])&&x>=42&&x<=74&&c&&Math.floor(i/96)<c.bottom)domain[i]=255;});
export const WHITEWALL_LATERAL_DOMAIN=domain.slice();
export function buildWhitewallMask(expression:number,continuity:number,seed:number) {
  unit(expression);unit(continuity);if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('화이트월 시드는 uint32여야 합니다.');
  const mask=new Uint8Array(N);if(!expression)return mask;
  const rng=seededRandom(String(seed),'companion:whitewall-shape:1'),phase=rng()*Math.PI*2,phase2=rng()*Math.PI*2;
  const allowed=new Uint8Array(96);
  for(let x=35;x<=77;x++){const wave=.5+.5*Math.sin((x-35)/42*Math.PI*3+phase);if(wave<=Math.min(1,.14+.82*continuity+.10*expression))allowed[x]=1;}
  // Low-connection foundations yield a few broad blocks, never scattered scales.
  for(let x=35;x<=77;){if(!allowed[x]){x++;continue;}const start=x;while(x<=77&&allowed[x])x++;if(x-start<3)allowed.fill(0,start,x);}
  domain.forEach((v,i)=>{const x=i%96;if(!v||!allowed[x])return;const c=columns[x]!,depth=(c.bottom-Math.floor(i/96))/Math.max(1,c.bottom-c.top);
    const scallop=Math.sin(x*.24+phase2)*(.025+.075*(1-continuity));
    const height=expression*(.65+.12*continuity+scallop);
    if(depth<=height)mask[i]=255;
  });
  return mask;
}
export function renderCompanionWhitewall(p:CompanionWhitewallParameters) {
  if(![null,0,1,2].includes(p.whiteoutCopies))throw Error('화이트아웃 사본은 0·1·2 또는 미기록이어야 합니다.');
  unit(p.whitewallExpression);patternlessTones(p.whitewallColor);
  const base=renderCompanionEmptyBack(p),active=!!p.whiteoutCopies&&p.cappuccinoCopies!==2;
  const expression=active?p.whitewallExpression*(p.whiteoutCopies===1?COMPANION_WHITEWALL_MODEL.singleExpression:1):0;
  const plan=buildWhitewallMask(expression,p.wallContinuity,p.whitewallSeed),mask=new Uint8Array(N),visibleMask=new Uint8Array(N),albedo=new Uint8ClampedArray(N*4),pixels=base.sprite.pixels.slice();
  const visiblePatternMask=base.visiblePatternMask.slice(),visibleStripeMask=base.visibleStripeMask.slice(),materials=base.visibleTricolorMaterials.slice(),whiteMask=base.whiteMask.slice();
  const white=mix(p.whitewallColor,[248,251,255],base.pigment.suppression),tones=patternlessTones(white),skinTones=patternlessTones(base.pigment.skin.resolved),veilTones=patternlessTones(base.pigment.white),veil=base.veilMetrics.strength;
  const sideIndices=source.labels.flatMap((_,i)=>side(i)&&source.foreground[i]&&!source.protection[i]&&![1,2,3,5].includes(roles[i])&&!base.forelegRefinementMask[i]?[i]:[]);
  const columnCounts=new Map<number,number>(),domainColumns=[...new Set(sideIndices.filter(i=>domain[i]&&columns[i%96]!.bottom-columns[i%96]!.top>=3).map(i=>i%96))].sort((a,b)=>a-b);
  let contrastSum=0;
  for(const i of sideIndices)if(plan[i]&&!base.spotMask[i]&&!base.pinMask[i]&&!base.pinSpreadMask[i]) {
    const t=tone(i),colour=mix(tones[t],veilTones[t],veil),substrate=mix(skinTones[t],veilTones[t],veil);
    pixels.set([...colour,pixels[i*4+3]],i*4);albedo.set([...white,255],i*4);mask[i]=255;whiteMask[i]=255;
    visiblePatternMask[i]=visibleStripeMask[i]=0;materials[i]=5;
    const contrast=distance(colour,substrate);
    if(contrast>=COMPANION_WHITEWALL_MODEL.thresholds.visibleContrast){visibleMask[i]=255;contrastSum+=contrast;columnCounts.set(i%96,(columnCounts.get(i%96)??0)+1);}
  }
  const t=COMPANION_WHITEWALL_MODEL.thresholds,visiblePixels=visibleMask.filter(Boolean).length;
  const connected=domainColumns.filter(x=>(columnCounts.get(x)??0)>=t.minimumColumnPixels);
  let longest=0,run=0,prior=-2;for(const x of connected){run=x===prior+1?run+1:1;prior=x;longest=Math.max(longest,run);}
  const wallLateralPixels=sideIndices.filter(i=>!base.spotMask[i]&&!base.pinMask[i]&&!base.pinSpreadMask[i]).length;
  const coverage=wallLateralPixels?visiblePixels/wallLateralPixels:0,columnCoverage=domainColumns.length?connected.length/domainColumns.length:0,longestRun=domainColumns.length?longest/domainColumns.length:0,meanContrast=visiblePixels?contrastSum/visiblePixels:0;
  const qualified=active&&coverage>=t.coverage&&columnCoverage>=t.columnCoverage&&longestRun>=t.longestRun&&meanContrast>=t.meanContrast;
  const classification=p.whiteoutCopies===null?'unrecorded':!active?'none':qualified?'whitewall':visiblePixels?'whiteout':'masked';
  const whitewallMetrics={copies:p.whiteoutCopies,expression,wallContinuity:p.wallContinuity,applied:mask.some(Boolean),classification,qualified,
    paintedPixels:mask.filter(Boolean).length,visiblePixels,lateralPixels:wallLateralPixels,coverage,columnCoverage,longestRun,longestColumns:longest,totalColumns:domainColumns.length,meanContrast,
    goal:qualified&&base.pinMetrics.classification==='full',
    emptyBackGoal:qualified&&base.pinMetrics.classification==='full'&&base.emptyBackMetrics.cleanCoverage>=.90&&!!p.emptyBackCopies};
  if(!mask.some(Boolean))return {...base,sprite:{...base.sprite,version:COMPANION_WHITEWALL_RENDERER_ID},whitewallMask:mask,visibleWhitewallMask:visibleMask,whitewallAlbedo:albedo,whitewallColor:white,whitewallMetrics};
  // Ordinary pattern and the white wall remain separate observed materials.
  // A new white wall cannot alone award Extreme Harlequin or Tricolor Extreme.
  const count=(filter:(i:number)=>boolean)=>{const indices=sideIndices.filter(filter);return indices.length?indices.filter(i=>visiblePatternMask[i]).length/indices.length:0;};
  const lateralCoverage=count(()=>true),upperCoverage=count(i=>source.labels[i]===3),tricolorMetrics=measureCompanionPatternTricolor(pixels,materials,p,lateralCoverage);
  const rows=Array.from({length:6},()=>new Set<number>());let stripePixels=0,stripeContrast=0;
  visibleStripeMask.forEach((v,i)=>{if(!v)return;stripePixels++;const t=tone(i);stripeContrast+=distance(rgb(pixels,i),mix(skinTones[t],veilTones[t],veil));if([2,3,4].includes(source.labels[i])&&base.stripeOwners[i])rows[base.stripeOwners[i]-1].add(Math.floor(i/96));});
  const tracks=rows.map(set=>{const ys=[...set].sort((a,b)=>a-b);let longest=0,run=0,prior=-2;for(const y of ys){run=y===prior+1?run+1:1;prior=y;longest=Math.max(longest,run);}const span=ys.length?ys.at(-1)!-ys[0]+1:0;return{rows:ys.length,span,longest,gaps:span-ys.length};});
  const good=tracks.filter(t=>t.rows>=5),span=good.reduce((s,t)=>s+t.span,0),fragmentation=span?good.reduce((s,t)=>s+t.gaps,0)/span:0,meanStripeContrast=stripePixels?stripeContrast/stripePixels:0;
  const stripeClass=good.length<3||meanStripeContrast<55?'none':p.brindleStrength>=.55&&fragmentation>=.12?'brindle':'tiger';
  const observation={lateralCoverage,upperCoverage,legCoverage:base.patternMetrics.legCoverage,stripeClass,clearTricolor:tricolorMetrics.clear,superForm:false}as const;
  const rises=columns.flatMap((c,x)=>{if(!c)return[];const ys=sideIndices.filter(i=>i%96===x&&visiblePatternMask[i]).map(i=>Math.floor(i/96));return[ys.length?(c.bottom-Math.min(...ys)+1)/(c.bottom-c.top+1):0];});
  const patternMetrics={...base.patternMetrics,...observation,...classifyCompanionPatterns(observation),maximumRise:Math.max(0,...rises),meanRise:rises.reduce((a,b)=>a+b,0)/rises.length,tracks,fragmentation,stripePixels,stripeContrast:meanStripeContrast,stripeQuality:Math.round(100*Math.min(1,meanStripeContrast/150)*Math.min(1,good.length/5))};
  const combinedVisibleMask=visiblePatternMask.map((v,i)=>v||visibleMask[i]?255:0);
  const layer:SpriteLayer={name:'details',mask,pixels:pixels.slice()};
  return {...base,sprite:{...base.sprite,version:COMPANION_WHITEWALL_RENDERER_ID,pixels,layers:[...base.sprite.layers,layer]},
    whitewallMask:mask,visibleWhitewallMask:visibleMask,combinedVisibleLateralMask:combinedVisibleMask,whitewallAlbedo:albedo,whitewallColor:white,whitewallMetrics,
    latentPatternMetrics:base.patternMetrics,visiblePatternMask,visibleStripeMask,visibleTricolorMaterials:materials,tricolorMetrics,patternMetrics,whiteMask,
    emptyBackMetrics:{...base.emptyBackMetrics,lateralCoverage,goal:!!p.emptyBackCopies&&base.emptyBackMetrics.cleanCoverage>=.90&&base.pinMetrics.classification==='full'&&lateralCoverage>=.5},
    whiteMetrics:{...base.whiteMetrics,whitePixels:whiteMask.filter(Boolean).length,whiteLateralPixels:whiteMask.filter((v,i)=>v&&side(i)).length,whiteLateralCoverage:whiteMask.filter((v,i)=>v&&side(i)).length/sideIndices.length}};
}
export function companionWhitewallParameters(input:RenderInput,veilOverride?:number):CompanionWhitewallParameters {
  const s=input.phenotype.inheritedScores;
  return {...companionEmptyBackParameters(input,veilOverride),whiteoutCopies:whiteoutCopies(input.extensions),whitewallExpression:1,
    wallContinuity:Math.max(0,Math.min(1,(.55*s.flank+.45*s.harlequin-.25)/.48)),whitewallColor:[254,249,230],
    whitewallSeed:Math.floor(seededRandom(input.seed,'companion:whitewall-layout:1')()*0x100000000)};
}
export function describeCompanionWhitewall(input:RenderInput,veilOverride?:number) {
  const parameters=companionWhitewallParameters(input,veilOverride),r=renderCompanionWhitewall(parameters),old=describeCompanionPatterns(input,veilOverride,()=>r);
  const label=r.whitewallMetrics.qualified?'화이트월':parameters.whiteoutCopies?'화이트아웃':'';
  return {...old,parameters,whitewallMetrics:r.whitewallMetrics,emptyBackMetrics:r.emptyBackMetrics,
    name:[label,parameters.emptyBackCopies===2?'슈퍼 엠티백':parameters.emptyBackCopies===1?'엠티백':'',parameters.phantomCopies===2?'팬텀':'',old.name].filter(Boolean).join(' · ')};
}
export function createCompanionWhitewallRenderer(veilOverride?:number):AppearanceRenderer {
  createCompanionEmptyBackRenderer(veilOverride);
  return {id:veilOverride===undefined?COMPANION_WHITEWALL_RENDERER_ID:`${COMPANION_WHITEWALL_RENDERER_ID}:veil:${veilOverride}`,render:input=>renderCompanionWhitewall(companionWhitewallParameters(input,veilOverride)).sprite};
}
export const companionWhitewallRenderer=createCompanionWhitewallRenderer();
