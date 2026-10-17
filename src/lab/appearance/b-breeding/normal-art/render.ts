import {NORMAL_ART,type Contour} from './art';
import {B_ANATOMY as A} from '../anatomy';
import {insidePolygon} from '@/engine/raster';
import {renderBase} from '../../base-study/render';
import type {StudySprite} from '../../base-study/render';
export const NORMAL_ART_VERSION='B-normal-art-1';
type RGB=readonly [number,number,number];
const within=(i:number,p:Contour)=>insidePolygon(i%96,Math.floor(i/96),p);
const torso:Contour=[[35,29],[48,29],[71,35],[80,42],[78,49],[72,53],[58,54],[40,50],[35,43]];
// A small, hand-painted lighting guide for pigment replacement only. Original
// B's face, ink, silhouette and untouched skin pixels are not reconstructed.
// Shapes describe anatomy, never the outline of a colour pattern.
const light:readonly {value:number;shape:Contour}[]=[
 {value:4,shape:[[35,28],[49,29],[71,35],[81,43],[76,45],[63,39],[46,37],[37,37]]},
 {value:3,shape:[[36,37],[48,37],[64,40],[76,45],[75,49],[60,50],[43,46],[36,43]]},
 {value:2,shape:[[36,44],[45,46],[59,49],[74,48],[73,51],[60,53],[44,50],[36,47]]},
 {value:1,shape:[[42,49],[60,51],[72,50],[72,53],[58,54],[43,51]]},
 {value:5,shape:[[36,29],[48,30],[62,33],[75,38],[80,42],[77,43],[69,38],[58,35],[45,33],[37,32]]},
 {value:3,shape:[[77,40],[85,46],[91,56],[92,67],[85,75],[77,79],[63,79],[52,72],[50,67],[55,70],[63,74],[75,74],[82,68],[85,61],[82,53],[77,47]]},
 {value:4,shape:[[81,44],[87,50],[92,59],[91,67],[86,74],[78,77],[64,77],[55,73],[52,69],[56,72],[65,74],[76,74],[83,69],[87,63],[86,56]]},
 {value:2,shape:[[77,46],[81,51],[84,58],[84,65],[80,69],[74,72],[63,72],[57,69],[61,74],[74,75],[82,71],[86,64],[86,57],[82,49]]},
 {value:1,shape:[[61,77],[73,78],[81,75],[87,70],[88,73],[82,78],[73,81],[62,80]]}
];
const skin:readonly RGB[]=[[91,40,27],[127,60,32],[154,75,34],[177,95,41],[203,124,58],[219,150,80],[234,177,109]];
const cream:readonly RGB[]=[[141,91,58],[176,124,80],[207,156,104],[227,180,125],[240,200,144],[250,218,167],[252,224,175]];
const dark:readonly RGB[]=[[65,36,25],[91,40,27],[112,51,29],[127,60,32],[154,75,34],[177,95,41],[203,124,58]];
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
// Retain source-scale flecks, without reinterpreting the old cream silhouette
// as illumination. Comparison is within the SAME original pigment only. This
// extracts a discrete tonal residual; it never filters/interpolates the output.
const grain=Int8Array.from(A.tone,(_,i)=>{
 const values:number[]=[];const x=i%96,y=Math.floor(i/96);
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
  const xx=x+dx,yy=y+dy,j=yy*96+xx;
  if(xx>=0&&xx<96&&yy>=0&&yy<96&&A.skin[j]&&A.cream[j]===A.cream[i])values.push(A.tone[j]);
 }
 values.sort((a,b)=>a-b);return clamp(A.tone[i]-(values[Math.floor(values.length/2)]??A.tone[i]),-1,1);
});
export interface NormalResult extends StudySprite {mask:Uint8Array;editable:Uint8Array;id:string;version:typeof NORMAL_ART_VERSION}
const cache=new Map<string,NormalResult>();
/** Shared immutable base, with explicit whole-pattern drawings. Deliberately
 * has no genome/RNG/seed input: selecting art is NOT a new inheritance rule. */
export function renderNormalArt(id:string):NormalResult {
 const previous=cache.get(id);if(previous)return previous;
 const design=NORMAL_ART.find(d=>d.id===id);if(!design)throw new Error('Unknown B normal art: '+id);
 const pixels=renderBase('B').pixels.slice(),mask=new Uint8Array(9216),editable=new Uint8Array(9216);
 for(let i=0;i<9216;i++){
  const x=i%96,y=Math.floor(i/96);
  // The entire head, not just the pupil, is exact B. Limb silhouettes/toes and
  // body ink also stay exact. Only Harlequin explicitly repaints upper limbs.
  if(!A.skin[i]||(x<36&&y<38))continue;
  const limbPaint=design.limbs&&A.limbs[i]&&y<57&&design.cream.some(s=>within(i,s));
  const area=within(i,torso)||!!A.tail[i]||limbPaint;
  if(!area)continue;editable[i]=255;
  const isCream=id==='original'?!!A.cream[i]:design.cream.some(s=>within(i,s))&&!design.windows?.some(s=>within(i,s));
  mask[i]=isCream?255:0;if(id==='original')continue;
  let tone=3;for(const l of light)if(within(i,l.shape))tone=l.value;
  // Keep source dither/fine texture as one native tonal step, separately
  // normalised within its original pigment. No generated noise or blending.
  const texture=grain[i];
  tone=clamp(tone+texture,0,6);
  let color:RGB;
  if(design.accents?.some(s=>within(i,s)))color=dark[tone];
  else if(isCream)color=cream[tone];
  else color=skin[tone];
  pixels.set([...color,255],i*4);
 }
 const result:NormalResult={width:96,height:96,pixels,mask,editable,id,version:NORMAL_ART_VERSION};cache.set(id,result);return result;
}
export function normalPatternMask(id:string):StudySprite {
 const r=renderNormalArt(id),pixels=new Uint8ClampedArray(36864);
 for(let i=0;i<9216;i++)if(A.alpha[i])pixels.set(r.mask[i]?[250,218,167,255]:r.editable[i]?[47,65,65,255]:[25,37,43,255],i*4);
 return {width:96,height:96,pixels};
}
