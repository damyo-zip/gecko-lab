import type {SpriteResult} from '@/engine/model';
import type {Point} from '@/engine/raster';
import {PART,artColor} from '@/engine/art';
import {anatomy as A,sourceBase as B} from './anatomy';
import {luminance} from './lighting';

/** Sampled from the SOURCE pose. Bright-side / fold-side
 * pairs, not color-pattern boundaries. Units are 0–255 luminance. Local values
 * can also change at inherited pigment edges; report sign and each pair instead
 * of presenting a single "art quality" score. No renderer reads these probes. */
export const STRUCTURE_PROBES=[
  {id:'jaw',label:'턱',light:[25,36],shade:[25,38]},
  {id:'cheek',label:'눈 뒤·볼',light:[32,32],shade:[32,28]},
  {id:'neck',label:'목 접힘',light:[36,38],shade:[37,38]},
  {id:'shoulder',label:'어깨',light:[45,44],shade:[47,44]},
  {id:'belly',label:'옆구리·배',light:[59,46],shade:[59,50]},
  {id:'hip',label:'뒷다리',light:[70,45],shade:[68,46]},
  {id:'tail',label:'꼬리 단면',light:[86,62],shade:[90,62]},
] as const satisfies readonly {id:string;label:string;light:Point;shade:Point}[];
const index=(p:Point)=>p[1]*96+p[0];
const source=(i:number)=>luminance(artColor(B.details[i]));
const pixel=(s:SpriteResult,i:number)=>luminance(s.pixels.subarray(i*4,i*4+3));

export function structureContrast(sprite:SpriteResult){
  return STRUCTURE_PROBES.map(p=>{
    const a=index(p.light),b=index(p.shade),valid=!!A.skin[a]&&!!A.skin[b];
    const reference=source(a)-source(b),contrast=pixel(sprite,a)-pixel(sprite,b);
    return {id:p.id,label:p.label,valid,source:reference,contrast,sourceDirectionPreserved:valid&&reference*contrast>0};
  });
}

/** Adjacent *same material* skin contrast excludes all protected outlines and
 * eyes. Pattern edge separability uses different pigment labels separately.
 * Larger is not inherently better: both metrics need visual review at 96px. */
export function localContrast(sprite:SpriteResult,materials:Uint8Array){
  let same=0,sameCount=0,edge=0,edgeCount=0,readable=0;
  for(let y=0;y<96;y++)for(let x=0;x<96;x++){
    const i=y*96+x;if(!A.skin[i])continue;
    for(const j of [x<95?i+1:-1,y<95?i+96:-1]){
      if(j<0||!A.skin[j]||B.parts[i]!==B.parts[j])continue;
      const d=Math.abs(pixel(sprite,i)-pixel(sprite,j));
      if(materials[i]===materials[j]){same+=d;sameCount++;}
      else {edge+=d;edgeCount++;readable+=Number(d>=12);}
    }
  }
  return {withinMaterial:same/Math.max(1,sameCount),patternEdge:edge/Math.max(1,edgeCount),patternEdges:edgeCount,readableEdgeFraction:readable/Math.max(1,edgeCount)};
}
export function regionTones(sprite:SpriteResult,mask:Uint8Array){
  const values:number[]=[];
  for(let i=0;i<9216;i++)if(A.skin[i]&&mask[i])values.push(pixel(sprite,i));
  values.sort((a,b)=>a-b);
  return {count:values.length,p10:values[Math.floor(values.length*.10)]??0,p90:values[Math.floor(values.length*.90)]??0};
}
export const headSkin=Uint8Array.from(A.skin,(v,i)=>B.parts[i]===PART.head?v:0);
