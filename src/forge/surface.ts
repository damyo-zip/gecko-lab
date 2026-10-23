import {renderCompanionLineage,companionLineageParameters,COMPANION_LINEAGE_RENDERER_ID,type RenderInput} from './index';
import {B_ORIGIN_01 as source} from './engine/art/b-origin-01';
import type {GeckoSpecimen,SpriteResult} from '@/engine/model';

/** Runtime tags never enter a save, genetics record, Worker message or API payload. */
const surfaces=new WeakMap<GeckoSpecimen,{input:RenderInput;viable:boolean;pixels?:Uint8ClampedArray}>();
export function tagForgeSurface(specimen:GeckoSpecimen,input:RenderInput,viable=true,pixels?:Uint8ClampedArray):void{surfaces.set(specimen,{input,viable,pixels});}
/** Presentation alone clears the tool's black background. Body RGBA is unchanged. */
export function forgeSurface(specimen:GeckoSpecimen):SpriteResult|null {
 const tag=surfaces.get(specimen);if(!tag)return null;
 const pixels=tag.viable?(tag.pixels??renderCompanionLineage(companionLineageParameters(tag.input)).sprite.pixels).slice():new Uint8ClampedArray(9216*4);
 for(let i=0;i<9216;i++)if(!source.foreground[i])pixels.fill(0,i*4,i*4+4);
 return{width:96,height:96,pixels,layers:[],version:COMPANION_LINEAGE_RENDERER_ID};
}
