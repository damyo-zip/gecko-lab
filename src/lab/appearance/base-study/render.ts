import {BASE_ART} from './art-data';
import {DESIGNS,type BaseId,type VariantId} from './designs';
import {randomFor} from '@/engine/random';
export interface StudySprite {width:96;height:96;pixels:Uint8ClampedArray}
const L=(c:readonly number[])=>c[0]*.30+c[1]*.59+c[2]*.11;
const mix=(a:readonly number[],b:readonly number[],t:number)=>a.slice(0,3).map((v,n)=>Math.round(v*(1-t)+b[n]*t));
const cream=(c:readonly number[])=>L(c)>145&&c[0]-c[1]<45&&c[1]-c[2]>8;
function inside(x:number,y:number,p:readonly (readonly number[])[]){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])hit=!hit;return hit;}
const bases=Object.fromEntries(DESIGNS.map(d=>{
 const art=BASE_ART[d.id],pixels=new Uint8ClampedArray(36864),protectedPixels=new Uint8Array(9216),torso=new Uint8Array(9216);
 for(let i=0;i<9216;i++){
  const x=i%96,y=Math.floor(i/96),c=art.palette[parseInt(art.rows[y][x],36)];pixels.set(c,i*4);if(!c[3])continue;
  const eye=Math.abs(x-d.eye.x)<=d.eye.rx+2&&Math.abs(y-d.eye.y)<=d.eye.ry+2;
  protectedPixels[i]=L(c)<75||eye?255:0;
  if(!protectedPixels[i]&&inside(x,y,d.torso))torso[i]=255;
 }
 return [d.id,{pixels,protectedPixels,torso}];
})) as Record<BaseId,{pixels:Uint8ClampedArray;protectedPixels:Uint8Array;torso:Uint8Array}>;
const cache=new Map<string,StudySprite>();

/** An art feasibility study, not a replacement phenotype or inheritance engine.
 * Every variant uses the same native silhouette, eye and structural dark pixels.
 * Only discrete material palette entries / torso pigment coverage are changed. */
export function renderBase(id:BaseId,variant:VariantId='normal',seed='base-study-01'):StudySprite {
 const key=[id,variant,variant==='rich'?seed:''].join(':');const prior=cache.get(key);if(prior)return prior;
 const b=bases[id],pixels=b.pixels.slice(),art=BASE_ART[id],d=DESIGNS.find(v=>v.id===id)!;
 const body=art.palette.filter(c=>c[3]&&L(c)>=75&&!cream(c)).toSorted((a,b)=>L(a)-L(b));
 const light=art.palette.filter(c=>c[3]&&cream(c)).toSorted((a,b)=>L(a)-L(b));
 const rng=randomFor(seed,'new-base-pattern-'+id),xs=d.torso.map(p=>p[0]),ys=d.torso.map(p=>p[1]);
 const patches=Array.from({length:9},()=>({x:Math.min(...xs)+rng()*(Math.max(...xs)-Math.min(...xs)),y:Math.min(...ys)+rng()*(Math.max(...ys)-Math.min(...ys)),rx:2+rng()*3,ry:3+rng()*5}));
 // Remap pigment to middle skin ramps, not the full black→gold range: a pale
 // patch must not turn into dark speckled noise when its pigment is removed.
 const sparseMap=new Map(light.map((c,n)=>[c.join(),body[Math.round((.35+n/Math.max(1,light.length-1)*.35)*(body.length-1))]]));
 for(let i=0;i<9216;i++){
  if(!pixels[i*4+3]||b.protectedPixels[i])continue;
  const x=i%96,y=Math.floor(i/96),c=art.palette[parseInt(art.rows[y][x],36)];let out:readonly number[]=c;
  if(variant==='bright')out=mix(c,[253,223,166],cream(c)?.18:.38);
  if(variant==='dark')out=mix(c,[48,37,32],cream(c)?.15:.52);
  if(variant==='sparse'&&b.torso[i]&&cream(c))out=sparseMap.get(c.join())!;
  if(variant==='rich'&&b.torso[i]&&!cream(c)){
   const field=Math.min(...patches.map(p=>((x-p.x)/p.rx)**2+((y-p.y)/p.ry)**2));
   if(field<.85+Math.sin(x*1.9+y*.7)*.15){
    const tone=Math.max(0,Math.min(1,(L(c)-75)/135));out=light[Math.round(tone*(light.length-1))];
   }
  }
  pixels.set([out[0],out[1],out[2],255],i*4);
 }
 const result={width:96 as const,height:96 as const,pixels};cache.set(key,result);if(cache.size>48)cache.delete(cache.keys().next().value!);return result;
}
/** Read-only diagnostics return copies so an inspection cannot edit the art. */
export const baseAnatomy=(id:BaseId)=>({protectedPixels:bases[id].protectedPixels.slice(),torso:bases[id].torso.slice()});
export const baseCacheSize=()=>cache.size;
