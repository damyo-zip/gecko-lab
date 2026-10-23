import {B_ORIGIN_01 as source} from './art/b-origin-01';
import {renderCompanionBase} from './companion-base';
import {renderCompanionWhitewallV2,companionWhitewallV2Parameters,createCompanionWhitewallV2Renderer,COMPANION_WHITEWALL_V2_MODEL,type CompanionWhitewallV2Parameters} from './companion-whitewall-v2';
import {classifyCompanionPatterns,describeCompanionPatterns,measureCompanionPatternTricolor} from './companion-patterns';
import {lateralTraits} from './morph-extensions';
import {lateralTraitScores} from './lateral-genetics';
import {seededRandom} from './genetics';
import {patternlessTones,type Rgb} from './patternless';
import type {AppearanceRenderer,RenderInput} from './model';
import type {SpriteLayer} from '@/engine/model';

export const COMPANION_LATERAL_RENDERER_ID='b-origin-01-companion-laterals-1' as const;
export const COMPANION_LATERAL_MODEL={version:1,
  quad:{columnCoverage:.85,longestRun:.80,contrast:26,edgeContrast:18,minimumPinColourRetention:.5},
  porthole:{minimumVisible:3,goalVisible:4},wall:COMPANION_WHITEWALL_V2_MODEL.thresholds,
  evidence:'Porthole size is enhanced by the existing Whiteout dosage. Shape and continuity are experimental quantitative game traits, not claimed biological loci.',
  limits:'Side view shows one lateral stripe; opposite-side expression is not independently measured. No raised-scale relief, aging, or new survival rules.',
  references:['https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=65','https://www.coloradocresties.com/morph-traits']
}as const;
export interface CompanionLateralParameters extends CompanionWhitewallV2Parameters {
  /** Null preserves unrecorded old families, without inferring a new genotype. */
  lateralShape:number|null;lateralContinuity:number|null;
  lateralExpression:number;lateralSeed:number;
}
const N=9216,roles=renderCompanionBase().materialMask;
const side=(i:number)=>source.labels[i]===3||source.labels[i]===4;
const columns=Array.from({length:96},(_,x)=>{const ys=source.labels.flatMap((_,i)=>i%96===x&&side(i)?[Math.floor(i/96)]:[]);return ys.length?{top:Math.min(...ys),bottom:Math.max(...ys)}:null;});
const domain=new Uint8Array(N);
source.foreground.forEach((v,i)=>{const c=columns[i%96];if(v&&side(i)&&!source.protection[i]&&![1,2,3,5].includes(roles[i])&&i%96>=42&&i%96<=74&&c&&Math.floor(i/96)<c.bottom)domain[i]=255;});
export const LATERAL_DETAIL_DOMAIN=domain.slice();
const tone=(i:number)=>source.shading[i]===1?'highlight':source.shading[i]===3?'shadow':'base';
const mix=(a:Rgb,b:Rgb,t:number)=>a.map((v,c)=>Math.round(v+(b[c]-v)*t))as unknown as Rgb;
const rgb=(p:Uint8ClampedArray,i:number)=>Array.from(p.slice(i*4,i*4+3))as unknown as Rgb;
const distance=(a:Rgb,b:Rgb)=>Math.sqrt(a.reduce((s,v,c)=>s+(v-b[c])**2,0));
function unit(v:number){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1)throw Error('옆무늬 표현 값은 0~1이어야 합니다.');}
function longestRun(xs:number[]){let longest=0,run=0,prior=-2;for(const x of xs.sort((a,b)=>a-b)){run=x===prior+1?run+1:1;prior=x;longest=Math.max(longest,run);}return longest;}

/** One longitudinal field: round islands stretch into capsules and a stripe. */
export function buildLateralDetailMask(shape:number,continuity:number,dosage:0|1|2,expression:number,seed:number,foundation=0){
  unit(shape);unit(continuity);unit(expression);unit(foundation);if(![0,1,2].includes(dosage)||!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('옆무늬 사본 또는 시드 오류');
  const rng=seededRandom(String(seed),'companion:lateral-layout:1'),phase=rng()*Math.PI*2;
  const path=(x:number)=>{const c=columns[Math.max(42,Math.min(74,Math.round(x)))]!;return c.top+(c.bottom-c.top)*.58+Math.sin((x-42)*.15+phase)*.35;};
  const centres=[44,49,55,61,67,72].map(x=>({x:x+(rng()-.5)*1.4,offset:(rng()-.5)*1.1,scale:.82+rng()*.32}));
  const mask=new Uint8Array(N),owners=new Uint8Array(N),rail=new Uint8Array(N),railColumns:number[]=[];
  for(let x=42;x<=74;x++){
    const target=Math.round(path(x)),candidates=[target,target-1,target+1,target-2,target+2],y=candidates.find(y=>domain[y*96+x]);
    if(y!==undefined){rail[y*96+x]=255;railColumns.push(x);}
  }
  const poreRadius=[.48,1.45,2.5][dosage];
  const longitudinal=(1-shape)*(3.45+1.1*continuity)+shape*poreRadius;
  const vertical=(1-shape)*[.58,1.9+.4*foundation,4.9+2*foundation][dosage]+shape*poreRadius;
  for(let n=0;n<centres.length;n++){
    const c=centres[n],cx=c.x,cy=path(cx)+c.offset*shape+(1-shape)*dosage*.5;
    const width=longitudinal*c.scale*expression,height=vertical*c.scale*expression;
    if(!width||!height)continue;
    domain.forEach((v,i)=>{if(!v)return;const x=i%96,y=Math.floor(i/96),dx=(x-cx)/width,dy=(y-(cy+path(x)-path(cx)))/height;
      // Full continuity closes the saddles; lower scores leave broad dashes.
      const gate=.5+.5*Math.sin((x-42)*.50+phase);
      if(shape<.5&&gate>Math.min(1,.30+.72*continuity))return;
      if(dx*dx+dy*dy<=1){mask[i]=255;owners[i]=n+1;}
    });
    // Natural portholes must survive native rasterization as single scales.
    if(shape>=.7&&expression>0){const x=Math.round(cx),y=Math.round(cy),i=y*96+x;if(domain[i]){mask[i]=255;owners[i]=n+1;}}
  }
  // A one-pixel longitudinal centreline prevents subpixel capsule gaps at
  // native resolution. The same seeded continuity gate controls every join.
  if(shape<=.3&&expression>=.5)rail.forEach((v,i)=>{if(!v)return;const x=i%96,gate=.5+.5*Math.sin((x-42)*.50+phase);
    if(gate>Math.min(1,.30+.72*continuity))return;
    const nearest=centres.map((c,n)=>({n,d:Math.abs(x-c.x),width:longitudinal*c.scale*expression})).sort((a,b)=>a.d-b.d)[0];
    if(nearest.d<=nearest.width){mask[i]=255;owners[i]=nearest.n+1;}
  });
  return{mask,owners,rail,railColumns};
}
export function renderCompanionLaterals(p:CompanionLateralParameters){
  for(const v of[p.lateralShape,p.lateralContinuity])if(v!==null)unit(v);
  unit(p.lateralExpression);if(!Number.isInteger(p.lateralSeed)||p.lateralSeed<0||p.lateralSeed>0xffffffff)throw Error('옆무늬 시드는 uint32여야 합니다.');
  const recorded=p.lateralShape!==null&&p.lateralContinuity!==null;
  const active=recorded&&p.lateralExpression>0&&p.cappuccinoCopies!==2;
  const base=renderCompanionWhitewallV2(active?{...p,whiteoutCopies:0}:p);
  const mask=new Uint8Array(N),visible=new Uint8Array(N),albedo=new Uint8ClampedArray(N*4),visibleRail=new Uint8Array(N),poreMask=new Uint8Array(N),stripeMask=new Uint8Array(N);
  const blankMetrics={recorded,shape:p.lateralShape,continuity:p.lateralContinuity,whiteoutCopies:p.whiteoutCopies,
    classification:recorded?'none':'unrecorded',paintedPixels:0,visiblePixels:0,coverage:0,visiblePortholes:0,columnCoverage:0,longestRun:0,quad:false,portholeGoal:false,goal:false};
  if(!active)return{...base,sprite:{...base.sprite,version:COMPANION_LATERAL_RENDERER_ID},lateralMask:mask,visibleLateralMask:visible,lateralAlbedo:albedo,lateralRail:visibleRail,portholeMask:poreMask,lateralStripeMask:stripeMask,lateralMetrics:blankMetrics};
  const shape=p.lateralShape!,continuity=p.lateralContinuity!,plan=buildLateralDetailMask(shape,continuity,p.whiteoutCopies??0,p.lateralExpression,p.lateralSeed,p.wallContinuity);
  const pixels=base.sprite.pixels.slice(),white=mix(p.whitewallColor,[248,251,255],base.pigment.suppression),cream=mix(white,base.pigment.pattern.resolved,.12);
  const veil=base.veilMetrics.strength,skinTones=patternlessTones(base.pigment.skin.resolved),veilTones=patternlessTones(base.pigment.white);
  const visiblePatternMask=base.visiblePatternMask.slice(),visibleStripeMask=base.visibleStripeMask.slice(),materials=base.visibleTricolorMaterials.slice(),whiteMask=base.whiteMask.slice();
  const sideIndices=source.labels.flatMap((_,i)=>side(i)&&source.foreground[i]&&!source.protection[i]&&![1,2,3,5].includes(roles[i])&&!base.forelegRefinementMask[i]?[i]:[]);
  const visibleOwners=new Set<number>(),connected=new Set<number>();let meanContrast=0;
  for(const i of sideIndices)if(plan.mask[i]&&!base.spotMask[i]&&!base.pinMask[i]&&!base.pinSpreadMask[i]){
    const t=tone(i),material=cream,colour=mix(patternlessTones(material)[t],veilTones[t],veil),skin=mix(skinTones[t],veilTones[t],veil),substrate=rgb(base.sprite.pixels,i);
    pixels.set([...colour,pixels[i*4+3]],i*4);albedo.set([...material,255],i*4);mask[i]=whiteMask[i]=255;
    if(shape>=.7)poreMask[i]=255;else if(shape<=.3)stripeMask[i]=255;
    visiblePatternMask[i]=visibleStripeMask[i]=0;materials[i]=5;
    const contrast=distance(colour,skin),edgeContrast=distance(colour,substrate);
    if(contrast>=COMPANION_LATERAL_MODEL.quad.contrast&&edgeContrast>=COMPANION_LATERAL_MODEL.quad.edgeContrast){visible[i]=255;visibleOwners.add(plan.owners[i]);meanContrast+=contrast;if(plan.rail[i]){connected.add(i%96);visibleRail[i]=255;}}
  }
  const visibleN=visible.filter(Boolean).length,sideN=sideIndices.filter(i=>!base.spotMask[i]&&!base.pinMask[i]&&!base.pinSpreadMask[i]).length;
  const columnCoverage=plan.railColumns.length?connected.size/plan.railColumns.length:0,longest=plan.railColumns.length?longestRun([...connected])/plan.railColumns.length:0;
  const pinVisible=base.phantomMetrics.pinColourRetention>=COMPANION_LATERAL_MODEL.quad.minimumPinColourRetention;
  const quad=shape<=.3&&base.pinMetrics.classification==='full'&&pinVisible&&columnCoverage>=COMPANION_LATERAL_MODEL.quad.columnCoverage&&longest>=COMPANION_LATERAL_MODEL.quad.longestRun;
  const visiblePortholes=shape>=.7?visibleOwners.size:0,portholeGoal=visiblePortholes>=COMPANION_LATERAL_MODEL.porthole.goalVisible&&p.whiteoutCopies===2;
  const lateralMetrics={...blankMetrics,classification:!visibleN?'masked':shape>=.7?(visiblePortholes>=3?'porthole':'sparse-porthole'):shape<=.3?(quad?'quadstripe':'lateral-stripe'):'mixed',
    paintedPixels:mask.filter(Boolean).length,visiblePixels:visibleN,coverage:sideN?visibleN/sideN:0,visiblePortholes,columnCoverage,longestRun:longest,quad,portholeGoal,goal:quad||portholeGoal};
  // Re-observe ordinary pattern after occlusion; new pale accents cannot alone
  // award Extreme / Tricolor Extreme Harlequin or Tiger classification.
  const count=(label?:number)=>{const a=sideIndices.filter(i=>label===undefined||source.labels[i]===label);return a.length?a.filter(i=>visiblePatternMask[i]).length/a.length:0;};
  const lateralCoverage=count(),upperCoverage=count(3),tricolorMetrics=measureCompanionPatternTricolor(pixels,materials,p,lateralCoverage);
  const tracks=Array.from({length:6},(_,n)=>{const ys=[...new Set(Array.from(visibleStripeMask).flatMap((v,i)=>v&&base.stripeOwners[i]===n+1&&[2,3,4].includes(source.labels[i])?[Math.floor(i/96)]:[]))].sort((a,b)=>a-b),span=ys.length?ys.at(-1)!-ys[0]+1:0;return{rows:ys.length,span,longest:longestRun(ys),gaps:span-ys.length};});
  const good=tracks.filter(t=>t.rows>=5),span=good.reduce((s,t)=>s+t.span,0),fragmentation=span?good.reduce((s,t)=>s+t.gaps,0)/span:0;
  let stripePixels=0,stripeContrast=0;visibleStripeMask.forEach((v,i)=>{if(v){stripePixels++;stripeContrast+=distance(rgb(pixels,i),mix(skinTones[tone(i)],veilTones[tone(i)],veil));}});stripeContrast=stripePixels?stripeContrast/stripePixels:0;
  const stripeClass=good.length<3||stripeContrast<55?'none':p.brindleStrength>=.55&&fragmentation>=.12?'brindle':'tiger';
  const observation={lateralCoverage,upperCoverage,legCoverage:base.patternMetrics.legCoverage,stripeClass,clearTricolor:tricolorMetrics.clear,superForm:false}as const;
  const rises=columns.flatMap((c,x)=>{if(!c)return[];const ys=sideIndices.filter(i=>i%96===x&&visiblePatternMask[i]).map(i=>Math.floor(i/96));return[ys.length?(c.bottom-Math.min(...ys)+1)/(c.bottom-c.top+1):0];});
  const patternMetrics={...base.patternMetrics,...observation,...classifyCompanionPatterns(observation),tracks,fragmentation,stripePixels,stripeContrast,maximumRise:Math.max(0,...rises),meanRise:rises.reduce((s,v)=>s+v,0)/rises.length,stripeQuality:Math.round(100*Math.min(1,stripeContrast/150)*Math.min(1,good.length/5))};
  const wall=shape<=.3&&!!p.whiteoutCopies,t=COMPANION_LATERAL_MODEL.wall,wallCounts=new Map<number,number>();visible.forEach((v,i)=>{if(v)wallCounts.set(i%96,(wallCounts.get(i%96)??0)+1);});
  const wallColumns=plan.railColumns.filter(x=>(wallCounts.get(x)??0)>=t.minimumColumnPixels),wallColumnCoverage=wallColumns.length/plan.railColumns.length,wallLongest=longestRun(wallColumns)/plan.railColumns.length;
  const qualified=wall&&lateralMetrics.coverage>=t.coverage&&wallColumnCoverage>=t.columnCoverage&&wallLongest>=t.longestRun&&(visibleN?meanContrast/visibleN:0)>=t.meanContrast;
  const whitewallMetrics={...base.whitewallMetrics,copies:p.whiteoutCopies,wallContinuity:continuity,expression:p.lateralExpression,applied:wall&&mask.some(Boolean),classification:p.whiteoutCopies===null?'unrecorded':!wall?'none':qualified?'whitewall':'whiteout',qualified,
    paintedPixels:wall?lateralMetrics.paintedPixels:0,visiblePixels:wall?visibleN:0,lateralPixels:sideN,coverage:wall?lateralMetrics.coverage:0,columnCoverage:wall?wallColumnCoverage:0,longestRun:wall?wallLongest:0,longestColumns:wall?longestRun(wallColumns):0,totalColumns:plan.railColumns.length,meanContrast:wall&&visibleN?meanContrast/visibleN:0,
    goal:qualified&&base.pinMetrics.classification==='full',emptyBackGoal:qualified&&base.pinMetrics.classification==='full'&&!!p.emptyBackCopies&&base.emptyBackMetrics.cleanCoverage>=.9};
  const layer:SpriteLayer={name:'details',mask,pixels:pixels.slice()};
  return{...base,sprite:{...base.sprite,version:COMPANION_LATERAL_RENDERER_ID,pixels,layers:[...base.sprite.layers,layer]},lateralMask:mask,visibleLateralMask:visible,lateralAlbedo:albedo,lateralRail:visibleRail,portholeMask:poreMask,lateralStripeMask:stripeMask,lateralMetrics,
    whitewallMask:wall?mask:new Uint8Array(N),visibleWhitewallMask:wall?visible:new Uint8Array(N),whitewallMetrics,whitewallAlbedo:wall?albedo:new Uint8ClampedArray(N*4),
    visiblePatternMask,visibleStripeMask,visibleTricolorMaterials:materials,tricolorMetrics,patternMetrics,whiteMask,combinedVisibleLateralMask:visiblePatternMask.map((v,i)=>v||visible[i]?255:0),latentPatternMetrics:base.patternMetrics,
    emptyBackMetrics:{...base.emptyBackMetrics,lateralCoverage,goal:!!p.emptyBackCopies&&base.emptyBackMetrics.cleanCoverage>=.9&&base.pinMetrics.classification==='full'&&lateralCoverage>=.5},
    whiteMetrics:{...base.whiteMetrics,whitePixels:whiteMask.filter(Boolean).length,whiteLateralPixels:whiteMask.filter((v,i)=>v&&side(i)).length,whiteLateralCoverage:whiteMask.filter((v,i)=>v&&side(i)).length/sideIndices.length}};
}
export function companionLateralParameters(input:RenderInput,veilOverride?:number):CompanionLateralParameters {
  const scores=lateralTraitScores(lateralTraits(input.extensions));
  return{...companionWhitewallV2Parameters(input,veilOverride),lateralShape:scores.shape,lateralContinuity:scores.continuity,lateralExpression:1,lateralSeed:Math.floor(seededRandom(input.seed,'companion:lateral-seed:1')()*0x100000000)};
}
export const LATERAL_LABELS:Record<string,string>={unrecorded:'옆무늬 미기록',none:'옆무늬 없음',masked:'옆무늬 대비 낮음',porthole:'포트홀','sparse-porthole':'작은 포트홀',quadstripe:'쿼드스트라이프','lateral-stripe':'옆줄 발현 중',mixed:'포트홀 · 옆줄 혼합'};
export function describeCompanionLaterals(input:RenderInput,veilOverride?:number){
  const parameters=companionLateralParameters(input,veilOverride),r=renderCompanionLaterals(parameters),old=describeCompanionPatterns(input,veilOverride,()=>r);
  return{...old,parameters,lateralMetrics:r.lateralMetrics,whitewallMetrics:r.whitewallMetrics,emptyBackMetrics:r.emptyBackMetrics,
    name:[r.lateralMetrics.recorded?LATERAL_LABELS[r.lateralMetrics.classification]:'',r.whitewallMetrics.qualified?'화이트월':parameters.whiteoutCopies?'화이트아웃':'',parameters.phantomCopies===2?'팬텀':'',parameters.emptyBackCopies?'엠티백':'',old.name].filter(Boolean).join(' · ')};
}
export function createCompanionLateralRenderer(veilOverride?:number):AppearanceRenderer {
  createCompanionWhitewallV2Renderer(veilOverride);
  return{id:veilOverride===undefined?COMPANION_LATERAL_RENDERER_ID:`${COMPANION_LATERAL_RENDERER_ID}:veil:${veilOverride}`,render:input=>renderCompanionLaterals(companionLateralParameters(input,veilOverride)).sprite};
}
export const companionLateralRenderer=createCompanionLateralRenderer();
