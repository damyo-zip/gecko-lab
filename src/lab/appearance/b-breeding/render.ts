import {randomFor} from '@/engine/random';
import {mix,type RGB} from '@/engine/raster';
import type {Genome} from '@/genetics/advanced/model';
import {B_ANATOMY as A} from './anatomy';
import {bPhenotype,unit} from './phenotype';
export type Pigment=0|1|2|3|4; // none / base / cream / dark / white
export interface BResult {width:96;height:96;pixels:Uint8ClampedArray;materials:Uint8Array;metrics:{white:number;headWhite:number;dorsalWhite:number;sideCream:number;tailBaseWhite:number;tailTipDark:number;meanSkinLuminance:number}}
export interface BInput {genome:Genome;seed:string}
const cache=new Map<string,BResult>();
/** Keep the B face/pose and authored pixel clusters. Seeded material boundaries
 * are hard pixel decisions. No blur, alpha wash, new silhouettes or gray filter. */
export function renderB(input:BInput):BResult {
 const key=JSON.stringify([input.genome,input.seed]),prior=cache.get(key);if(prior){cache.delete(key);cache.set(key,prior);return prior;}
 const p=bPhenotype(input.genome),s=p.scores,e=p.expressed,v=p.strength,rng=randomFor(input.seed,'B-regional-pattern');
 const centers=Array.from({length:13},(_,n)=>({x:30+rng()*44,y:28+rng()*25,rx:2+rng()*4,ry:3+rng()*6,phase:rng()*6+n}));
 const crowns=Array.from({length:7},(_,n)=>({x:17+n*7+(rng()-.5)*3,y:n<2?18:27+(n-2)*2.1,rx:2+rng()*2.4,ry:1.4+rng()*2}));
 const white:RGB=e.axanthic?[236,238,241]:[249,242,223],cream:RGB=e.axanthic?[206,210,217]:[245,217,166];
 let base:RGB=e.axanthic?[35+s.brightness*155,37+s.brightness*155,42+s.brightness*155]:[199+p.lightness*70+p.warmth.red*34+p.warmth.orange*14,123+p.lightness*70-p.warmth.red*12+p.warmth.orange*6,62+p.lightness*70-p.warmth.red*10-p.warmth.orange*4];
 if(e.cappuccino)base=mix(base,e.axanthic?[50,52,59]:[93,58,39],.18+v.cappuccino*.24);
 if(e.sable)base=mix(base,e.axanthic?[34,36,42]:[54,38,33],.30+v.sable*.30);
 const dark:RGB=e.axanthic?[16+s.brightness*25,18+s.brightness*25,24+s.brightness*25]:[64,39,29];
 const ramp=(material:RGB,isWhite:boolean)=>Array.from({length:6},(_,n)=>{
  const shadow:RGB=e.axanthic?isWhite?[120,124,130]:[14,17,22]:isWhite?[139,122,104]:[54,30,24];
  const highlight:RGB=e.axanthic?[233,237,243]:[255,231,188];
  // White begins below its peak: preserve the original bright value clusters.
  const mid=isWhite?mix(material,e.axanthic?[187,191,197]:[193,177,148],.22):material;
  return n<3?mix(mid,shadow,(3-n)*.19):mix(mid,highlight,(n-3)*.27);
 });
 const ramps=[[],ramp(base,false),ramp(cream,true),ramp(dark,false),ramp(white,true)] as RGB[][];
 const pixels=A.pixels.slice(),materials=new Uint8Array(9216);let count=0,total=0,whiteCount=0,headWhite=0,dorsalWhite=0,sideCream=0,tailBaseWhite=0,tailTipDark=0;
 for(let i=0;i<9216;i++){
  if(!A.alpha[i])continue;
  if(A.structure[i]){
   if(e.axanthic&&!A.eye[i]){const l=Math.round(A.pixels[i*4]*.30+A.pixels[i*4+1]*.59+A.pixels[i*4+2]*.11);pixels.set([l,l+1,l+3,255],i*4);}continue;
  }
  if(A.outline[i]){if(e.axanthic)pixels.set([32,34,40,255],i*4);continue;}
  const x=i%96,y=Math.floor(i/96),src=A.pixels.subarray(i*4,i*4+3),original=A.cream[i]?2:1;
  const field=Math.min(...centers.map(c=>Math.hypot((x-c.x)/c.rx,(y-c.y)/c.ry)+Math.sin(y*.9+c.phase)*.08));
  let material:Pigment=original,changed=false;
  const mutable=A.body[i]||A.limbs[i];
  if(mutable){
   if(original===2&&p.coverageDelta<0&&field>.50+p.coverage*1.4){material=1;changed=true;}
   if(original===1&&field<.12+Math.max(0,p.coverageDelta)*2.0){material=2;changed=true;}
  }
  if(e.axanthic&&A.body[i]&&material===1&&field<.18+s.contrast*.20){material=3;changed=true;}
  if(e.cappuccino&&A.tail[i]){
   if(A.progress[i]<.035+v.cappuccino*.28){material=4;changed=true;}
   if(A.progress[i]>.97-v.cappuccino*.25){material=3;changed=true;}
  }
  if(e.highway&&A.body[i]){
   const edge=(.08+v.highway*.56)*(.94+Math.sin(x*.63)*.06);
   if(A.depth[i]<edge){material=4;changed=true;}
   else if(A.depth[i]>.48&&field<.4+v.highway*.72){material=1;changed=true;}
  }
  if(e.sable&&(A.head[i]||A.body[i])){
   const field=Math.min(...crowns.map(c=>Math.hypot((x-c.x)/c.rx,(y-c.y)/c.ry)));
   if(field<.28+v.sable*.80){material=4;changed=true;}
  }
  if(e.lilly){
   const wave=Math.sin(x*.45+y*.19)*.045,faceBarrier=.10+unit((36-x)/32)*.58+unit((y-23)/13)*.18+wave;
   if(A.head[i]&&faceBarrier<(v.lilly-.22)*1.18){material=4;changed=true;}
   if(A.body[i]&&(A.depth[i]>.82-v.lilly*.76||field<.08+v.lilly*.85)){material=4;changed=true;}
   if(A.limbs[i]&&field<.15+v.lilly*1.75){material=4;changed=true;}
   if(A.tail[i]&&(A.cream[i]||Math.sin(A.progress[i]*21+centers[0].phase)<-.88+v.lilly*1.1)){material=4;changed=true;}
  }
  materials[i]=material;
  let color:RGB;
  if(!changed&&!e.axanthic&&!e.cappuccino&&!e.sable){
   // Retain original indexed B pixels and their local shading at the baseline.
   const amount=p.lightness*60,red=p.warmth.red*34,orange=p.warmth.orange*14;
   color=[src[0]+amount+red+orange,src[1]+amount-red*.35+orange*.45,src[2]+amount-red*.30-orange*.25].map(v=>Math.round(Math.max(0,Math.min(255,v)))) as unknown as RGB;
  }else color=ramps[material][A.tone[i]];
  pixels.set([...color,255],i*4);count++;total+=color[0]*.3+color[1]*.59+color[2]*.11;
  if(material===4){whiteCount++;headWhite+=Number(!!A.head[i]);dorsalWhite+=Number(!!A.body[i]&&A.depth[i]<.65);tailBaseWhite+=Number(!!A.tail[i]&&A.progress[i]<.30);}
  sideCream+=Number(!!A.body[i]&&A.depth[i]>.72&&(material===2||material===4));tailTipDark+=Number(!!A.tail[i]&&A.progress[i]>.70&&material===3);
 }
 const result:BResult={width:96,height:96,pixels,materials,metrics:{white:whiteCount,headWhite,dorsalWhite,sideCream,tailBaseWhite,tailTipDark,meanSkinLuminance:total/count}};
 cache.set(key,result);if(cache.size>48)cache.delete(cache.keys().next().value!);return result;
}
export const bCacheSize=()=>cache.size;
