import {B_ORIGIN_01 as source} from './art/b-origin-01';
import {CAPPUCCINO_TAIL} from './art/cappuccino-tail';
import {PIGMENT_MATERIALS} from './art/pigment-materials';
import {PINSTRIPE_RAILS} from './art/pinstripe-rails';
import {renderCompanionBase} from './companion-base';
import {renderCompanionPinstripe,companionPinstripeParameters,describeCompanionPinstripe,createCompanionPinstripeRenderer,COMPANION_PINSTRIPE_MODEL,type CompanionPinstripeParameters} from './companion-pinstripe';
import {patternlessTones,type Rgb} from './patternless';
import {seededRandom} from './genetics';
import type {AppearanceRenderer,RenderInput} from './model';
import type {SpriteLayer} from '@/engine/model';

export const COMPANION_CAPPUCCINO_RENDERER_ID='b-origin-01-companion-cappuccino-1' as const;
export const COMPANION_CAPPUCCINO_MODEL={version:1,stage:'adult',
 bodyScale:{minimum:.66,expressionReduction:.18},warmNeutral:[77,64,53] as const,
 tailRoot:[255,245,218] as const,tailTip:[31,25,23] as const,superSkin:[34,30,29] as const,
 originalSourcePreserved:true,superSurvival:'existing core viability; no invented mortality rate or lifespan simulation',
 limits:'Breeder-observation-inspired material art coefficients, not a molecular pigment or medical model. Shared silhouette and fixed three-tone lighting are retained.'} as const;
export const CAPPUCCINO_COMPARISON=[{id:'normal',name:'일반',cappuccinoCopies:0,lilly:false},{id:'cappuccino',name:'카푸치노',cappuccinoCopies:1,lilly:false},{id:'frappuccino',name:'프라푸치노',cappuccinoCopies:1,lilly:true}] as const;
export interface CompanionCappuccinoParameters extends CompanionPinstripeParameters {
 cappuccinoCopies:0|1|2; cappuccinoExpression:number; dorsalRetention:number;pinSpread:number;tailRootLength:number;
}
const mix=(a:Rgb,b:Rgb,t:number):Rgb=>a.map((v,c)=>Math.round(v+(b[c]-v)*t)) as unknown as Rgb;
const scale=(rgb:Rgb,t:number):Rgb=>rgb.map(v=>Math.round(v*t)) as unknown as Rgb;
const unit=(v:number)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1)throw Error('카푸치노 발현 설정은 0~1이어야 합니다.');};
const roles=renderCompanionBase().materialMask,tail=new Float32Array(9216).fill(-1),iris=new Uint8Array(9216);
for(const [y,x,n,d] of CAPPUCCINO_TAIL.runs)tail.fill(d/CAPPUCCINO_TAIL.maximum,y*96+x,y*96+x+n);
for(const [y,x,n] of PIGMENT_MATERIALS.runs)iris.fill(255,y*96+x,y*96+x+n);
const tone=(i:number)=>source.shading[i]===1?'highlight':source.shading[i]===3?'shadow':'base';

export function renderCompanionCappuccino(parameters:CompanionCappuccinoParameters){
 if(![0,1,2].includes(parameters.cappuccinoCopies))throw Error('카푸치노 사본 수는 0·1·2입니다.');
 for(const v of [parameters.cappuccinoExpression,parameters.dorsalRetention,parameters.pinSpread,parameters.tailRootLength])unit(v);
 const original=renderCompanionPinstripe(parameters),isSuper=parameters.cappuccinoCopies===2,m=COMPANION_CAPPUCCINO_MODEL;
 const materialMask=new Uint8Array(9216),tailRootMask=new Uint8Array(9216),tailTipMask=new Uint8Array(9216),spreadMask=new Uint8Array(9216),superIrisMask=new Uint8Array(9216);
 if(!parameters.cappuccinoCopies)return {...original,albedo:undefined,sprite:{...original.sprite,version:COMPANION_CAPPUCCINO_RENDERER_ID},cappuccinoMask:materialMask,tailRootMask,tailTipMask,pinSpreadMask:spreadMask,superIrisMask,
  cappuccinoMetrics:{copies:0,stage:m.stage,dorsalRetention:1,rootPixels:0,tipPixels:0,spreadPixels:0,superForm:false}};
 const strength=parameters.cappuccinoExpression;
 const warmSkin=isSuper?mix(scale(parameters.bodyColor,.2),m.superSkin,.65):mix(scale(parameters.bodyColor,m.bodyScale.minimum-m.bodyScale.expressionReduction*strength),m.warmNeutral,.1);
 const under=renderCompanionPinstripe({...parameters,bodyColor:warmSkin,skinBrightness:parameters.skinBrightness*(isSuper?.1:1-.35*strength)});
 const skin=isSuper?mix(under.pigment.skin.resolved,m.superSkin,.3):under.pigment.skin.resolved,detail=under.pigment.pattern.resolved,white=under.pigment.white;
 const palette=renderCompanionBase({bodyColor:skin,detailColor:detail}).palette;
 const materials:Rgb[]=[skin,mix(skin,detail,isSuper?.04:.62),palette.face_cheek,palette.throat,palette.ventral_skin,palette.toe_pads,palette.tail_plane,palette.limb_top,mix(skin,detail,isSuper?0:parameters.dorsalRetention)];
 if(isSuper)for(const i of [2,3,4,5,6,7])materials[i]=mix(skin,materials[i],.12);
 const side=mix(skin,detail,isSuper?.04:.72+.2*(1-strength));
 const suppress=under.pigment.suppression,root=mix(m.tailRoot,[245,247,251],suppress),tip=mix(m.tailTip,[27,28,31],suppress);
 const pin=mix(COMPANION_PINSTRIPE_MODEL.pinColor,detail,.25),pinColour=mix(pin,COMPANION_PINSTRIPE_MODEL.neutralPinColor,suppress);
 // Broaden selected continuous sections inwards, without filling a missing pin column.
 const phase=seededRandom(String(parameters.pinSeed),'companion:cappuccino-pin-spread:1')()*Math.PI*2;
 if(!isSuper)for(const i of PINSTRIPE_RAILS.rails[1].pixels)if(original.pinMask[i]){
  const x=i%96,j=i-96,u=(x-35)/54,wave=(1+Math.sin(u*Math.PI*5+phase))/2;
  if(wave<parameters.pinSpread&&source.labels[j]===2&&!source.protection[j])spreadMask[j]=255;
 }
 const pixels=under.sprite.pixels.slice(),albedo=pixels.slice(),layer:SpriteLayer={name:'details',mask:materialMask,pixels:new Uint8ClampedArray(pixels.length)};
 source.foreground.forEach((v,i)=>{
  if(!v||source.protection[i])return;
  let rgb:Rgb=under.forelegRefinementMask[i]?skin:materials[roles[i]];
  if(under.patternMask[i])rgb=side;
  if(tail[i]>=0&&!isSuper){
   const d=tail[i],a=parameters.tailRootLength;
   if(d<a){rgb=root;tailRootMask[i]=255;}
   else if(d<a+.15)rgb=mix(root,skin,.6);
   else if(d<.58)rgb=skin;
   else {rgb=mix(skin,tip,.72+.16*strength);tailTipMask[i]=255;}
  }
  if(under.whiteMask[i])rgb=white;
  if(!isSuper&&(original.pinMask[i]||spreadMask[i]))rgb=pinColour;
  albedo.set([...rgb,pixels[i*4+3]],i*4);
  let lit=patternlessTones(rgb)[tone(i)];
  if(parameters.lilly)lit=mix(lit,patternlessTones(white)[tone(i)],parameters.veilStrength);
  if(under.spotMask[i])lit=under.sprite.pixels.slice(i*4,i*4+3) as unknown as Rgb;
  pixels.set([...lit,pixels[i*4+3]],i*4);materialMask[i]=255;layer.pixels.set(pixels.slice(i*4,i*4+4),i*4);
 });
 if(isSuper)iris.forEach((v,i)=>{if(v){pixels.set([25,24,26,pixels[i*4+3]],i*4);materialMask[i]=superIrisMask[i]=255;layer.pixels.set(pixels.slice(i*4,i*4+4),i*4);}});
 return {...under,pigment:{...under.pigment,skin:{...under.pigment.skin,resolved:skin}},visiblePinMask:isSuper?new Uint8Array(9216):under.visiblePinMask,sprite:{...under.sprite,version:COMPANION_CAPPUCCINO_RENDERER_ID,pixels,layers:[...under.sprite.layers,layer]},
  albedo,cappuccinoMask:materialMask,tailRootMask,tailTipMask,pinSpreadMask:spreadMask,superIrisMask,
  cappuccinoMetrics:{copies:parameters.cappuccinoCopies,stage:m.stage,dorsalRetention:isSuper?0:parameters.dorsalRetention,rootPixels:tailRootMask.filter(Boolean).length,tipPixels:tailTipMask.filter(Boolean).length,spreadPixels:spreadMask.filter(Boolean).length,superForm:isSuper}};
}
export function companionCappuccinoParameters(input:RenderInput,veilOverride?:number):CompanionCappuccinoParameters{
 const old=companionPinstripeParameters(input,veilOverride),s=input.phenotype.inheritedScores,c=input.phenotype.observed['cappuccino-complex'];
 if(!['Normal','Cappuccino','Super Cappuccino'].includes(c))throw Error('이번 카푸치노 렌더는 n/C 사본 조합만 지원합니다.');
 return {...old,cappuccinoCopies:c==='Super Cappuccino'?2:c==='Cappuccino'?1:0,cappuccinoExpression:.55+.35*(1-s.brightness)+.1*s.contrast,
  dorsalRetention:.08+.25*s.dorsal,pinSpread:.2+.6*s.dorsal,tailRootLength:.14+.08*s.cream};
}
export function describeCompanionCappuccino(input:RenderInput,veilOverride?:number){
 const previous=describeCompanionPinstripe(input,veilOverride),parameters=companionCappuccinoParameters(input,veilOverride),r=renderCompanionCappuccino(parameters),copies=parameters.cappuccinoCopies;
 const morph=copies===2?(parameters.lilly?'설악 · 슈퍼 카푸치노 + 릴리화이트':'슈퍼 카푸치노'):copies===1?(parameters.lilly?'프라푸치노':'카푸치노'):parameters.lilly?'릴리화이트':'일반';
 const failed=input.phenotype.observed['lilly-white']==='Lilly 동형접합 비생존';
 return {...previous,parameters,cappuccinoMetrics:r.cappuccinoMetrics,morph,name:failed?previous.name:copies===2?`${morph}${parameters.axanthic?' · 아잔틱':''}`:copies?`${morph}${parameters.axanthic?' · 아잔틱':''}${r.spotMetrics.count?' · 달마시안':''} · ${previous.pinMetrics.classification==='full'?'풀 핀':previous.pinMetrics.classification==='near-full'?'니어 풀 핀':previous.pinMetrics.classification==='none'?'핀 없음':'부분 핀'}`:previous.name,
  base:r.pigment.skin.resolved,hex:'#'+r.pigment.skin.resolved.map(v=>v.toString(16).padStart(2,'0')).join(''),superForm:copies===2};
}
export function createCompanionCappuccinoRenderer(veilOverride?:number):AppearanceRenderer{
 createCompanionPinstripeRenderer(veilOverride);return {id:veilOverride===undefined?COMPANION_CAPPUCCINO_RENDERER_ID:`${COMPANION_CAPPUCCINO_RENDERER_ID}:veil:${veilOverride}`,
  render:input=>renderCompanionCappuccino(companionCappuccinoParameters(input,veilOverride)).sprite};
}
export const companionCappuccinoRenderer=createCompanionCappuccinoRenderer();
