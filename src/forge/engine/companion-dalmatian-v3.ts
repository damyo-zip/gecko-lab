import { B_ORIGIN_01 as source } from './art/b-origin-01';
import { renderCompanionDalmatian as renderPrevious, describeCompanionDalmatian as describePrevious, COMPANION_DALMATIAN_MODEL as previousModel } from './companion-dalmatian-v2';
import { companionDalmatianParameters, type CompanionDalmatianParameters } from './companion-dalmatian-v2';
import { patternlessTones, type Rgb } from './patternless';
import type { AppearanceRenderer, RenderInput } from './model';
import type { SpriteLayer } from '@/engine/model';

export { companionDalmatianParameters, DALMATIAN_COMPARISON, DALMATIAN_SPOT_SHAPES } from './companion-dalmatian-v2';
export type { CompanionDalmatianParameters } from './companion-dalmatian-v2';
export const COMPANION_DALMATIAN_RENDERER_ID = 'b-origin-01-companion-dalmatian-3' as const;
// Native [row, first column, length] runs at the body edge behind the front leg.
// This supplemental rendering annotation never edits the authored source masks.
export const DALMATIAN_FORELEG_REFINEMENT = {
  sourceRgbaSha256: source.sourceRgbaSha256,
  runs: [[43,41,1],[44,41,2],[45,42,2],[46,43,2],[47,44,1],[48,45,1],[49,45,1]],
  material: 'body skin instead of ventral rim behind front leg',
  lighting: 'retain authored highlight/base/shadow without changes',
} as const;
export const COMPANION_DALMATIAN_MODEL = {...previousModel, version:3, forelegRearEdge:DALMATIAN_FORELEG_REFINEMENT} as const;
const mask = new Uint8Array(9216);
for(const [y,x,length] of DALMATIAN_FORELEG_REFINEMENT.runs) for(let dx=0;dx<length;dx++) {
  const i=y*96+x+dx;
  if(source.foreground[i] && !source.protection[i]) mask[i]=255;
}
const blend = (a:Rgb,b:Rgb,t:number):Rgb => a.map((v,c)=>Math.round(v+(b[c]-v)*t)) as unknown as Rgb;

export function renderCompanionDalmatian(parameters:CompanionDalmatianParameters) {
  const original=renderPrevious(parameters), pixels=original.sprite.pixels.slice();
  const skin=patternlessTones(original.pigment.skin.resolved), white=patternlessTones(original.pigment.white);
  const pattern=patternlessTones(original.pigment.pattern.resolved);
  const spots=patternlessTones(parameters.axanthic?previousModel.axanthicPigment:previousModel.pigment);
  const layer:SpriteLayer={name:'details',mask:mask.slice(),pixels:new Uint8ClampedArray(pixels.length)};
  mask.forEach((v,i)=>{
    if(!v) return;
    const tone=source.shading[i]===1?'highlight':source.shading[i]===3?'shadow':'base';
    let rgb=original.whiteMask[i]?white[tone]:original.patternMask[i]?pattern[tone]:skin[tone];
    if(parameters.lilly) rgb=blend(rgb,white[tone],parameters.veilStrength);
    if(original.spotMask[i]) rgb=spots[tone];
    pixels.set([...rgb,pixels[i*4+3]],i*4); layer.pixels.set(pixels.slice(i*4,i*4+4),i*4);
  });
  return {...original, sprite:{...original.sprite,version:COMPANION_DALMATIAN_RENDERER_ID,pixels,layers:[...original.sprite.layers,layer]},
    forelegRefinementMask:mask.slice()};
}
export function describeCompanionDalmatian(input:RenderInput,veilOverride?:number) {
  return describePrevious(input,veilOverride);
}
export function createCompanionDalmatianRenderer(veilOverride?:number):AppearanceRenderer {
  if(veilOverride!==undefined && (typeof veilOverride!=='number' || !Number.isFinite(veilOverride) || veilOverride<0 || veilOverride>1)) throw Error('흰 베일 농도는 0~1이어야 합니다.');
  return {id:veilOverride===undefined?COMPANION_DALMATIAN_RENDERER_ID:`${COMPANION_DALMATIAN_RENDERER_ID}:veil:${veilOverride}`,
    render:input=>renderCompanionDalmatian(companionDalmatianParameters(input,veilOverride)).sprite};
}
export const companionDalmatianRenderer=createCompanionDalmatianRenderer();
