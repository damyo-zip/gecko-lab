import { B_ORIGIN_01 as source } from './art/b-origin-01';
import { PIGMENT_MATERIALS } from './art/pigment-materials';
import { companionLillyVeilParameters, validateLillyVeil } from './companion-lilly-veil';
import { renderCompanionLilly, COMPANION_LILLY_MODEL } from './companion-lilly';
import { classifyFlame, DEFAULT_FLAME_THRESHOLDS } from './origin-flame';
import { patternlessTones, type Rgb } from './patternless';
import type { AppearanceRenderer, RenderInput } from './model';
import type { CompanionLillyVeilParameters } from './companion-lilly-veil';
import type { SpriteLayer } from '@/engine/model';

export const COMPANION_PIGMENT_RENDERER_ID = 'b-origin-01-companion-pigment-1' as const;
/** A rendering approximation of warm pigment suppression, not a cell or spectral simulation. */
export const COMPANION_PIGMENT_MODEL = {
  version: 1, mechanism: 'suppress warm chromatic material; retain melanin substrate, reflective pattern and spatial masks',
  neutralSkin: { minimum: 42, brightnessRange: 144 }, neutralPattern: [232, 235, 240] as const,
  neutralWhite: [248, 249, 252] as const, neutralIris: 'authored luminance, pupil and glint unchanged',
  alleleModel: 'one compatible recessive line: A/A and A/ax normal pigment; ax/ax expressed',
  limits: 'coefficients and iris palette are art assumptions; no causal crested-gecko gene or cell-loss claim',
} as const;
export interface CompanionPigmentParameters extends CompanionLillyVeilParameters {
  axanthic: boolean;
  /** Neutral substrate depends on inherited brightness, independently of red/orange potential. */
  skinBrightness: number;
  pigmentSuppression: number;
}
const mix = (a: Rgb, b: Rgb, t: number) => a.map((v,c)=>Math.round(v+(b[c]-v)*t)) as unknown as Rgb;
const iris = new Uint8Array(9216);
for (const [y,x,n] of PIGMENT_MATERIALS.runs) iris.fill(255,y*96+x,y*96+x+n);
function unit(n: number) { if (!Number.isFinite(n) || n < 0 || n > 1) throw Error('색소 설정은 0~1이어야 합니다.'); }
export function renderCompanionPigment(parameters: CompanionPigmentParameters) {
  if (typeof parameters.axanthic !== 'boolean') throw Error('아잔틱 발현 여부가 필요합니다.');
  unit(parameters.skinBrightness); unit(parameters.pigmentSuppression); validateLillyVeil(parameters.veilStrength);
  const amount = parameters.axanthic ? parameters.pigmentSuppression : 0;
  const m = COMPANION_PIGMENT_MODEL, value = Math.round(m.neutralSkin.minimum + m.neutralSkin.brightnessRange * parameters.skinBrightness);
  const neutralSkin: Rgb = [value,value,value], neutralPattern = m.neutralPattern;
  const bodyColor = mix(parameters.bodyColor,neutralSkin,amount), detailColor = mix(parameters.detailColor,neutralPattern,amount);
  // Resolve skin and pattern materials BEFORE authored lighting and Lilly veiling.
  const original = renderCompanionLilly({ ...parameters, bodyColor, detailColor });
  const pixels = original.sprite.pixels.slice(), pigmentMask = new Uint8Array(9216), irisMask = new Uint8Array(9216);
  const white = mix(COMPANION_LILLY_MODEL.whiteColor,m.neutralWhite,amount), tones = patternlessTones(white);
  if (amount) source.foreground.forEach((v,i)=>{
    if (!v) return;
    if (!source.protection[i]) pigmentMask[i]=255;
    if (original.whiteMask[i]) {
      const rgb = source.shading[i]===1 ? tones.highlight : source.shading[i]===3 ? tones.shadow : tones.base;
      pixels.set([...rgb,pixels[i*4+3]],i*4);
    }
    // Protection guards geometry and pattern painting. Only this annotated iris
    // material may change hue; no pupil, glint or structural pixels are repainted.
    if (iris[i]) {
      const rgb = source.pixels.slice(i*4,i*4+3), grey=Math.round(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722);
      pixels.set([...mix(rgb as unknown as Rgb,[grey,grey,grey],amount),pixels[i*4+3]],i*4);
      irisMask[i]=pigmentMask[i]=255;
    }
  });
  // The existing semiopaque white effect follows pigment expression. It cannot
  // reintroduce warm white into an axanthic Lilly.
  const veil = parameters.lilly ? parameters.veilStrength : 0;
  if (veil) source.foreground.forEach((v,i)=>{
    if (!v||source.protection[i]) return;
    const target=source.shading[i]===1?tones.highlight:source.shading[i]===3?tones.shadow:tones.base;
    for(let c=0;c<3;c++) pixels[i*4+c]=Math.round(pixels[i*4+c]+(target[c]-pixels[i*4+c])*veil);
  });
  // A resolved material layer also gives portable consumers exact compositing.
  const resolved: SpriteLayer = {name:'details',mask:new Uint8Array(9216),pixels:new Uint8ClampedArray(pixels.length)};
  source.foreground.forEach((v,i)=>{if(v&&(!source.protection[i]||irisMask[i])){resolved.mask[i]=255;resolved.pixels.set(pixels.slice(i*4,i*4+4),i*4);}});
  const sprite={...original.sprite,version:COMPANION_PIGMENT_RENDERER_ID,pixels,layers:[...original.sprite.layers,resolved]};
  const veilMetrics={strength:veil,underpaintRetention:1-veil,pixels:veil?source.foreground.filter((v,i)=>v&&!source.protection[i]).length:0};
  return {sprite, patternMask:original.ordinary.patternMask, whiteMask:original.whiteMask, pigmentMask, irisMask,
    metrics:original.ordinary.metrics, whiteMetrics:original.metrics, veilMetrics,
    pigment:{suppression:amount,skin:{warm:parameters.bodyColor,neutral:neutralSkin,resolved:bodyColor},
      pattern:{warm:parameters.detailColor,neutral:neutralPattern,resolved:detailColor},white,
      inheritedSkinBrightness:parameters.skinBrightness,irisPixels:irisMask.filter(Boolean).length}};
}
export function companionPigmentParameters(input: RenderInput, veilOverride?: number): CompanionPigmentParameters {
  const p=input.phenotype, raw=p.inheritedScores;
  // Recover latent colour potential before core axanthic expression sets red /
  // orange to zero. Genomes and core phenotype objects remain untouched.
  const potential={...input,phenotype:{...p,genetics:{...p.genetics,scores:{...p.genetics.scores,red:raw.red,orange:raw.orange}}}};
  const previous=companionLillyVeilParameters(potential,veilOverride),axanthic=p.observed.axanthic==='Axanthic';
  return {...previous,axanthic,pigmentSuppression:axanthic?1:0,skinBrightness:raw.brightness};
}
export function describeCompanionPigment(input: RenderInput, veilOverride?: number) {
  const parameters=companionPigmentParameters(input,veilOverride),r=renderCompanionPigment(parameters);
  const classification=classifyFlame(r.metrics.patternPixels,r.metrics.lateralPixels,DEFAULT_FLAME_THRESHOLDS);
  const names={none:'기본형',flame:'플레임','high flame':'하이 플레임',harlequin:'할리퀸'};
  const name=[...(parameters.lilly?['릴리화이트']:[]),...(parameters.axanthic?['아잔틱']:[]),names[classification]].join(' · ');
  const base=r.pigment.skin.resolved,hex='#'+base.map(v=>v.toString(16).padStart(2,'0')).join('');
  return {name:input.phenotype.observed['lilly-white']==='Lilly 동형접합 비생존'?'릴리 동형접합 비생존':name,
    base,hex,parameters,metrics:r.metrics,whiteMetrics:r.whiteMetrics,veilMetrics:r.veilMetrics,pigment:r.pigment};
}
export function createCompanionPigmentRenderer(veilOverride?: number): AppearanceRenderer {
  if(veilOverride!==undefined)validateLillyVeil(veilOverride);
  return {id:veilOverride===undefined?COMPANION_PIGMENT_RENDERER_ID:`${COMPANION_PIGMENT_RENDERER_ID}:veil:${veilOverride}`,
    render:input=>renderCompanionPigment(companionPigmentParameters(input,veilOverride)).sprite};
}
export const companionPigmentRenderer=createCompanionPigmentRenderer();
