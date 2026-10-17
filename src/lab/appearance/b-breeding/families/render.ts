import {FAMILY_ART} from './art-data';
import type {ArtMorph,FamilyId,Cadence} from './art-source';
import {B_ANATOMY as A} from '../anatomy';
import {bPhenotype} from '../phenotype';
import {selectFamily} from './selection';
import type {BInput} from '../render';
import {mix,type RGB} from '@/engine/raster';
export const FAMILY_VERSION='B-pattern-family-1';
export type FamilyOptions={family?:FamilyId;cadence?:Cadence};
export interface FamilyResult {width:96;height:96;pixels:Uint8ClampedArray;map:Uint8Array;selection:ReturnType<typeof selectFamily>;family:FamilyId;cadence:Cadence;artId:string;changedPixels:number;version:typeof FAMILY_VERSION}
const cache=new Map<string,FamilyResult>(),maps=new Map<string,Uint8Array>();
const restored=new Map<number,RGB>();
const clamp=(v:number,a=0,b=255)=>Math.max(a,Math.min(b,v));
export const protectedPixel=(i:number)=>!A.skin[i]||(((i%96-21)/4.4)**2+((Math.floor(i/96)-25)/5.8)**2<=1);
export const familyCacheSize=()=>cache.size;
/** Native source-pixel reference for an explicitly drawn brown window. This
 * does not invent a neutral light field or average/interpolate skin colours. */
function originalSkin(i:number):RGB {
 const old=restored.get(i);if(old)return old;
 let best=Infinity,nearest=i;const x=i%96,y=Math.floor(i/96);
 for(let dy=-7;dy<=7;dy++)for(let dx=-7;dx<=7;dx++){
  const xx=x+dx,yy=y+dy,j=yy*96+xx;if(xx<0||xx>=96||yy<0||yy>=96||!A.skin[j]||A.cream[j])continue;
  if((['head','body','tail','limbs'] as const).some(r=>A[r][i]!==A[r][j]))continue;
  const distance=Math.abs(dx)+Math.abs(dy)*1.4;if(distance<best){best=distance;nearest=j;}
 }
 const color=[...A.pixels.subarray(nearest*4,nearest*4+3)] as unknown as RGB;restored.set(i,color);return color;
}
function artMap(morph:ArtMorph,family:FamilyId,cadence:Cadence){
 const key=[morph,family,cadence].join(':'),old=maps.get(key);if(old)return old;
 const art=FAMILY_ART.find(f=>f.id===key)!;const map=Uint8Array.from(art.rows.join(''),Number);maps.set(key,map);return map;
}
/** The ORIGINAL indexed B pixels are always the canvas. No neutral body,
 * geometric relighting, random boundary, texture noise or small stamp engine. */
export function renderFamily(input:BInput,options:FamilyOptions={}):FamilyResult {
 const key=JSON.stringify([input,options]),old=cache.get(key);if(old){cache.delete(key);cache.set(key,old);return old;}
 const selection=selectFamily(input.genome,input.seed),family=options.family??selection.family,cadence=options.cadence??selection.cadence,p=bPhenotype(input.genome),s=p.scores,e=p.expressed;
 const id=[selection.morph,family,cadence].join(':'),map=artMap(selection.morph,family,cadence),pixels=A.pixels.slice();let changedPixels=0;
 const creamRamp:RGB[]=[[155,108,75],[190,142,94],[219,173,120],[235,191,136],[247,209,149],[252,224,175]],whiteRamp:RGB[]=[[148,131,110],[178,163,141],[208,194,169],[230,220,195],[248,241,220],[255,251,237]],darkRamp:RGB[]=[[28,22,21],[42,29,25],[58,37,28],[76,47,32],[102,65,42],[141,100,65]];
 const bodyT=(c:RGB)=>{
  let color=c;
  if(e.cappuccino)color=mix(color,[80,52,39],.15+p.strength.cappuccino*.15);
  if(e.sable)color=mix(color,[41,34,31],.35+p.strength.sable*.18);
  return color;
 };
 for(let i=0;i<9216;i++){
  if(!A.alpha[i]||protectedPixel(i))continue;
  const source=[...A.pixels.subarray(i*4,i*4+3)] as unknown as RGB,ink=map[i],originalCream=!!A.cream[i],material=ink||(originalCream?2:1),tone=A.tone[i];
  // Untouched normal skin and cream retain their exact original microtexture.
  let color:RGB=ink===0||ink===2&&originalCream||ink===1&&!originalCream?source:ink===1?originalSkin(i):(ink===2?creamRamp:ink===3?darkRamp:whiteRamp)[tone];
  if(material===1)color=bodyT(color);
  if(e.axanthic){
   const L=source[0]*.30+source[1]*.59+source[2]*.11;
   const gray=material===4?([134,164,193,218,239,250][tone]+p.lightness*20):material===3?([17,25,37,50,66,88][tone]+p.lightness*40):material===2?(ink===0||originalCream?155+(L-169)*1.1:105+tone*25)+p.lightness*35:(ink===0?34+(L-48)*.72:25+tone*26)+p.lightness*80;
   color=[gray,gray+1,gray+3];
  }else{
   const light=p.lightness*(material===4?22:55),red=p.warmth.red*(material===1?24:6),orange=p.warmth.orange*(material===1?15:4);
   color=[color[0]+light+red+orange,color[1]+light-red*.25+orange*.35,color[2]+light-red*.22-orange*.16];
  }
  // Contrast changes existing colour steps, never replaces or blurs contours.
  const contrast=1+(s.contrast-.5)*.16;
  color=color.map(v=>Math.round(clamp(128+(v-128)*contrast))) as unknown as RGB;
  pixels.set([...color,255],i*4);if(color.some((v,k)=>v!==source[k]))changedPixels++;
 }
 const result:FamilyResult={width:96,height:96,pixels,map,selection,family,cadence,artId:id,changedPixels,version:FAMILY_VERSION};cache.set(key,result);if(cache.size>32)cache.delete(cache.keys().next().value!);return result;
}
