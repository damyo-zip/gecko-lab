import {B_ORIGIN_01 as source} from './art/b-origin-01';
import {renderCompanionBase} from './companion-base';
import {renderCompanionEmptyBack,companionEmptyBackParameters,createCompanionEmptyBackRenderer,DEFAULT_EMPTYBACK_PARAMETERS,type CompanionEmptyBackParameters} from './companion-emptyback';
import {classifyCompanionPatterns,describeCompanionPatterns,measureCompanionPatternTricolor} from './companion-patterns';
import {whiteoutCopies} from './morph-extensions';
import {seededRandom} from './genetics';
import {patternlessTones,type Rgb} from './patternless';
import type {AppearanceRenderer,RenderInput} from './model';
import type {SpriteLayer} from '@/engine/model';

export const COMPANION_WHITEWALL_V2_RENDERER_ID='b-origin-01-companion-whitewall-2' as const;
export const COMPANION_WHITEWALL_V2_MODEL={version:2,singleExpression:.46,
  thresholds:{coverage:.45,columnCoverage:.85,longestRun:.80,minimumColumnPixels:2,visibleContrast:26,meanContrast:40},
  inheritance:'Breeder-reported Whiteout incomplete dominance; Whitewall is observed coverage and continuity, not an inherited name. Existing flank/harlequin are game modifiers, not a proven lateral-stripe locus.',
  limits:'Native lower-lateral material model. No new mortality. Raised scale relief, Portholes, growth and all line interactions are not simulated. C/C keeps existing super art.',
  references:['https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=44','https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=54'],
}as const;
export interface CompanionWhitewallV2Parameters extends CompanionEmptyBackParameters {
  whiteoutCopies:0|1|2|null;
  /** Independent non-inherited art coefficient; actual animals always use 1. */
  whitewallExpression:number;
  /** Game modifier derived from existing flank/harlequin alleles. */
  wallContinuity:number;
  whitewallColor:Rgb;
  whitewallSeed:number;
}
export const DEFAULT_WHITEWALL_V2_PARAMETERS:Readonly<CompanionWhitewallV2Parameters>={...DEFAULT_EMPTYBACK_PARAMETERS,emptyBackCopies:0,whiteoutCopies:2,whitewallExpression:1,wallContinuity:1,whitewallColor:[254,249,230],whitewallSeed:42};
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
export const WHITEWALL_V2_LATERAL_DOMAIN=domain.slice();
export function buildWhitewallV2Mask(expression:number,continuity:number,seed:number) {
  unit(expression);unit(continuity);if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('화이트월 시드는 uint32여야 합니다.');
  const mask=new Uint8Array(N);if(!expression)return mask;
  // Three broad, seeded lobes share a basal field. At low expression only
  // their broad feet emerge; with two copies the saddles join into a wall.
  // This is one monotone field, not separately drawn single/double sprites.
  const rng=seededRandom(String(seed),'companion:whitewall-shape:2');
  const anchors=[0,.16,.33,.5,.67,.84,1].map((x,n)=>({x:x+(n>0&&n<6?(rng()-.5)*.055:0),
    height:(n===0||n===6?.40:n%2?.88:.64)+rng()*(n%2?.20:.16),
    onset:(n%2?.04:.48)+rng()*.10}));
  const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
  for(let x=42;x<=74;x++) {
    const u=(x-42)/32,k=Math.min(5,anchors.findIndex((a,n)=>n<6&&u>=a.x&&u<=anchors[n+1].x));
    const a=anchors[Math.max(0,k)],b=anchors[Math.max(0,k)+1],t=(u-a.x)/(b.x-a.x);
    const eased=t*t*(3-2*t),crest=lerp(a.height,b.height,eased),onset=lerp(a.onset,b.onset,eased);
    const edge=Math.min(1,(x-40)/6,(77-x)/7);
    const saddle=.5+.5*Math.cos((u*3.5+.2)*Math.PI*2);
    const interruption=(1-continuity)*(.24+.43*saddle);
    const reach=Math.max(0,(expression-onset-interruption)/(1-onset));
    const height=reach*crest*(.90+.10*continuity)*edge;
    const c=columns[x];if(!c)continue;
    for(let y=c.top;y<c.bottom;y++) {
      const i=y*96+x,depth=(c.bottom-y)/Math.max(1,c.bottom-c.top);
      if(domain[i]&&depth<=height)mask[i]=255;
    }
  }
  return mask;
}
export function renderCompanionWhitewallV2(p:CompanionWhitewallV2Parameters) {
  if(![null,0,1,2].includes(p.whiteoutCopies))throw Error('화이트아웃 사본은 0·1·2 또는 미기록이어야 합니다.');
  unit(p.whitewallExpression);patternlessTones(p.whitewallColor);
  const base=renderCompanionEmptyBack(p),active=!!p.whiteoutCopies&&p.cappuccinoCopies!==2;
  const expression=active?p.whitewallExpression*(p.whiteoutCopies===1?COMPANION_WHITEWALL_V2_MODEL.singleExpression:1):0;
  const plan=buildWhitewallV2Mask(expression,p.wallContinuity,p.whitewallSeed),mask=new Uint8Array(N),visibleMask=new Uint8Array(N),albedo=new Uint8ClampedArray(N*4),pixels=base.sprite.pixels.slice();
  const visiblePatternMask=base.visiblePatternMask.slice(),visibleStripeMask=base.visibleStripeMask.slice(),materials=base.visibleTricolorMaterials.slice(),whiteMask=base.whiteMask.slice();
  const white=mix(p.whitewallColor,[248,251,255],base.pigment.suppression),skinTones=patternlessTones(base.pigment.skin.resolved),veilTones=patternlessTones(base.pigment.white),veil=base.veilMetrics.strength;
  const sideIndices=source.labels.flatMap((_,i)=>side(i)&&source.foreground[i]&&!source.protection[i]&&![1,2,3,5].includes(roles[i])&&!base.forelegRefinementMask[i]?[i]:[]);
  const columnCounts=new Map<number,number>(),domainColumns=[...new Set(sideIndices.filter(i=>domain[i]&&columns[i%96]!.bottom-columns[i%96]!.top>=3).map(i=>i%96))].sort((a,b)=>a-b);
  let contrastSum=0;
  const shoulder=new Uint8Array(N);
  const tops=Array.from({length:96},(_,x)=>{for(let y=0;y<96;y++)if(plan[y*96+x])return y;return 96;});
  // Cream shoulders bridge existing flame tips and the chalk-white centre.
  // These are discrete albedo palettes, never an extra light or a blur.
  const warm=mix(white,base.pigment.pattern.resolved,.22),warmEdge=mix(white,base.pigment.pattern.resolved,.38);

  for(const i of sideIndices)if(plan[i]&&!base.spotMask[i]&&!base.pinMask[i]&&!base.pinSpreadMask[i]) {
    const y=Math.floor(i/96),x=i%96,edge=y-tops[x];
    const isShoulder=edge<2;
    const material=isShoulder?(edge===0?warmEdge:warm):mix(white,base.pigment.pattern.resolved,.07);
    const t=tone(i),colour=mix(patternlessTones(material)[t],veilTones[t],veil),substrate=mix(skinTones[t],veilTones[t],veil);
    if(isShoulder)shoulder[i]=255;
    pixels.set([...colour,pixels[i*4+3]],i*4);albedo.set([...material,255],i*4);mask[i]=255;whiteMask[i]=255;
    visiblePatternMask[i]=visibleStripeMask[i]=0;materials[i]=5;
    const contrast=distance(colour,substrate);
    if(contrast>=COMPANION_WHITEWALL_V2_MODEL.thresholds.visibleContrast){visibleMask[i]=255;contrastSum+=contrast;columnCounts.set(i%96,(columnCounts.get(i%96)??0)+1);}
  }
  const t=COMPANION_WHITEWALL_V2_MODEL.thresholds,visiblePixels=visibleMask.filter(Boolean).length;
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
  if(!mask.some(Boolean))return {...base,sprite:{...base.sprite,version:COMPANION_WHITEWALL_V2_RENDERER_ID},whitewallMask:mask,visibleWhitewallMask:visibleMask,whitewallAlbedo:albedo,whitewallShoulderMask:shoulder,whitewallColor:white,whitewallMetrics};
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
  return {...base,sprite:{...base.sprite,version:COMPANION_WHITEWALL_V2_RENDERER_ID,pixels,layers:[...base.sprite.layers,layer]},
    whitewallMask:mask,visibleWhitewallMask:visibleMask,combinedVisibleLateralMask:combinedVisibleMask,whitewallAlbedo:albedo,whitewallShoulderMask:shoulder,whitewallColor:white,whitewallMetrics,
    latentPatternMetrics:base.patternMetrics,visiblePatternMask,visibleStripeMask,visibleTricolorMaterials:materials,tricolorMetrics,patternMetrics,whiteMask,
    emptyBackMetrics:{...base.emptyBackMetrics,lateralCoverage,goal:!!p.emptyBackCopies&&base.emptyBackMetrics.cleanCoverage>=.90&&base.pinMetrics.classification==='full'&&lateralCoverage>=.5},
    whiteMetrics:{...base.whiteMetrics,whitePixels:whiteMask.filter(Boolean).length,whiteLateralPixels:whiteMask.filter((v,i)=>v&&side(i)).length,whiteLateralCoverage:whiteMask.filter((v,i)=>v&&side(i)).length/sideIndices.length}};
}
export function companionWhitewallV2Parameters(input:RenderInput,veilOverride?:number):CompanionWhitewallV2Parameters {
  const s=input.phenotype.inheritedScores;
  return {...companionEmptyBackParameters(input,veilOverride),whiteoutCopies:whiteoutCopies(input.extensions),whitewallExpression:1,
    wallContinuity:Math.max(0,Math.min(1,(.55*s.flank+.45*s.harlequin-.25)/.48)),whitewallColor:[254,249,230],
    whitewallSeed:Math.floor(seededRandom(input.seed,'companion:whitewall-layout:1')()*0x100000000)};
}
export function describeCompanionWhitewallV2(input:RenderInput,veilOverride?:number) {
  const parameters=companionWhitewallV2Parameters(input,veilOverride),r=renderCompanionWhitewallV2(parameters),old=describeCompanionPatterns(input,veilOverride,()=>r);
  const label=r.whitewallMetrics.qualified?'화이트월':parameters.whiteoutCopies?'화이트아웃':'';
  return {...old,parameters,whitewallMetrics:r.whitewallMetrics,emptyBackMetrics:r.emptyBackMetrics,
    name:[label,parameters.emptyBackCopies===2?'슈퍼 엠티백':parameters.emptyBackCopies===1?'엠티백':'',parameters.phantomCopies===2?'팬텀':'',old.name].filter(Boolean).join(' · ')};
}
export function createCompanionWhitewallV2Renderer(veilOverride?:number):AppearanceRenderer {
  createCompanionEmptyBackRenderer(veilOverride);
  return {id:veilOverride===undefined?COMPANION_WHITEWALL_V2_RENDERER_ID:`${COMPANION_WHITEWALL_V2_RENDERER_ID}:veil:${veilOverride}`,render:input=>renderCompanionWhitewallV2(companionWhitewallV2Parameters(input,veilOverride)).sprite};
}
export const companionWhitewallV2Renderer=createCompanionWhitewallV2Renderer();
