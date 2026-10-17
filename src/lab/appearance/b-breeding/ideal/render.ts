import type {Genome} from '@/genetics/advanced/model';
import {insidePolygon,type RGB} from '@/engine/raster';
import {randomFor} from '@/engine/random';
import {B_ANATOMY as A} from '../anatomy';
import {BASE_ART} from '../../base-study/art-data';
import {IDEALS,type Morph,type Patch,type Material} from './art';
import {idealTraits,IDEAL_EXPRESSION,type Expression} from './traits';
export const IDEAL_VERSION='B-ideal-inverse-1';
const ink:Record<Material,number>={source:0,skin:1,cream:2,white:3,dark:4};
const unit=(v:number)=>Math.max(0,Math.min(1,v));
const clamp=(v:number)=>Math.max(0,Math.min(255,Math.round(v)));
const indices=Uint8Array.from(BASE_ART.B.rows.join(''),v=>parseInt(v,36));
// The beige edge pixels belong to the authored cream paint when adjacent to
// its light core; do not leave a ghost of that old patch after restoration.
const paintedCream=Uint8Array.from(A.cream,(v,i)=>{
 if(v)return 255;if(![8,11].includes(indices[i]))return 0;
 const x=i%96,y=Math.floor(i/96);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(x+dx>=0&&x+dx<96&&y+dy>=0&&y+dy<96&&A.cream[i+dy*96+dx])return 255;
 return 0;
});
// Keep the original source's native light/texture and protected features. No
// neutral body, geometric relighting, per-pixel RNG or opacity overlays.
export const idealProtected=(i:number)=>!A.skin[i]||(((i%96-21)/4.1)**2+((Math.floor(i/96)-25)/5.2)**2<=1);
const compiled=new Map<string,{patch:Patch;pixels:Uint16Array}[]>();
function plan(id:string){
 const old=compiled.get(id);if(old)return old;const art=IDEALS.find(a=>a.id===id);if(!art)throw Error('Unknown ideal art: '+id);
 const result=art.patches.map(p=>({patch:p,pixels:Uint16Array.from(Array.from({length:9216},(_,i)=>i).filter(i=>!idealProtected(i)&&A[p.region][i]&&(!p.creamOnly||paintedCream[i])&&insidePolygon(i%96,Math.floor(i/96),p.path)))}));
 compiled.set(id,result);return result;
}
const restored=new Map<number,RGB>();
/** Brown pigment restoration is a reference to an actual nearby B skin pixel
 * in the same part. It is NOT a newly painted neutral body or a blur/inpaint. */
function sourceSkin(i:number):RGB {
 if(!paintedCream[i])return [...A.pixels.subarray(i*4,i*4+3)] as unknown as RGB;
 const old=restored.get(i);if(old)return old;let best=Infinity,index=i;const x=i%96,y=Math.floor(i/96);
 for(let dy=-8;dy<=8;dy++)for(let dx=-8;dx<=8;dx++){
  const xx=x+dx,yy=y+dy,j=yy*96+xx;if(xx<0||xx>95||yy<0||yy>95||!A.skin[j]||paintedCream[j])continue;
  if((['head','body','tail','limbs'] as const).some(k=>A[k][i]!==A[k][j]))continue;
  const d=Math.abs(dx)+Math.abs(dy)*1.4;if(d<best){best=d;index=j;}
 }
 const rgb=[...A.pixels.subarray(index*4,index*4+3)] as unknown as RGB;restored.set(i,rgb);return rgb;
}
const cream:readonly RGB[]=[[154,104,72],[186,137,91],[213,164,115],[235,191,136],[247,209,149],[252,224,175]];
const white:readonly RGB[]=[[143,126,104],[178,161,136],[207,191,163],[230,219,192],[247,239,216],[255,250,235]];
const dark:readonly RGB[]=[[29,22,21],[43,30,25],[60,39,29],[80,50,33],[107,68,43],[142,101,64]];
const morphSkin:Record<'cappuccino'|'sable'|'axanthic',readonly RGB[]>={
 cappuccino:[[44,30,25],[64,43,31],[91,61,41],[122,84,54],[157,113,73],[195,148,100]],
 sable:[[29,26,24],[43,36,29],[62,47,33],[88,65,41],[123,91,57],[164,128,83]],
 axanthic:[[26,28,31],[46,49,53],[72,76,81],[105,111,117],[145,151,157],[190,195,200]]
};
const cache=new Map<string,IdealResult>();
export interface IdealResult {width:96;height:96;pixels:Uint8ClampedArray;materials:Uint8Array;expression:Expression;morph:Morph;artId:string;active:string[];composite:boolean;version:typeof IDEAL_VERSION}
function draw(morph:Morph,expression:Expression,seed:string,genome?:Genome,artId=IDEALS.find(a=>a.morph===morph)!.id):IdealResult {
 if(!IDEALS.some(a=>a.id===artId&&a.morph===morph))throw Error('Unknown ideal art: '+artId);
 const key=JSON.stringify([morph,expression,seed,genome?.mendelian,artId]),previous=cache.get(key);if(previous){cache.delete(key);cache.set(key,previous);return previous;}
 const materials=new Uint8Array(9216),active:string[]=[];
 for(const {patch:p,pixels} of plan(artId)){
  if(p.channel){const v=expression[p.channel],enabled=p.below?v<(p.at??0):v>=(p.at??0);if(!enabled)continue;}
  // Seed only shifts a complete authored gap by ONE pixel along its part;
  // it never changes inherited strength, ideal identity or invents freckles.
  const offset=p.cadence&&p.channel&&expression[p.channel]<.8?(randomFor(seed,'ideal-gap:'+p.name)()<.5?0:1):0;
  for(const i of pixels){const j=i+offset;if(!idealProtected(j)&&A[p.region][j]&&(!p.creamOnly||paintedCream[j]))materials[j]=ink[p.material];}
  active.push(p.name);
 }
 const p=genome?idealTraits(genome):null,e=p?.expressed;
 const ax=morph==='axanthic'||!!e?.axanthic,capp=morph==='cappuccino'||!!e?.cappuccino,sable=morph==='sable'||!!e?.sable,lilly=morph==='lilly';
 const pixels=A.pixels.slice();
 for(let i=0;i<9216;i++){
  if(idealProtected(i))continue;
  const m=materials[i],original=[...A.pixels.subarray(i*4,i*4+3)] as unknown as RGB;
  const material=m|| (A.cream[i]?(lilly?3:2):1);let color:RGB;
  if(m===0)color=original;else if(material===1)color=sourceSkin(i);else color=(material===2?cream:material===3?white:dark)[A.tone[i]];
  const tone=material===1&&paintedCream[i]?Math.max(0,Math.min(5,Math.round(((color[0]*.3+color[1]*.59+color[2]*.11)-48)/150*5))):A.tone[i];
  if(ax){
   const ramp=material===1?morphSkin.axanthic:material===4?[[10,12,15],[18,21,25],[29,33,38],[44,49,55],[65,71,78],[92,99,107]]:material===3?[[127,132,139],[159,165,172],[192,198,205],[220,226,232],[243,247,250],[250,252,254]]:[[112,118,126],[143,150,157],[173,180,187],[200,207,214],[224,231,237],[243,247,250]];
   color=ramp[tone] as RGB;
  }else if(material===1&&(capp||sable))color=morphSkin[sable?'sable':'cappuccino'][tone];
  else if(lilly&&material===3)color=white[tone];
  const contrast=.68+.32*expression.contrast,light=(expression.brightness-.5)*(ax?110:60),warm=material===1?1:.18;
  color=color.map((v,k)=>clamp(128+(v-128)*contrast+light+(ax?0:expression.red*[28,-7,-6][k]*warm+expression.orange*[14,5,-3][k]*warm))) as unknown as RGB;
  pixels.set([...color,255],i*4);
 }
 const result:IdealResult={width:96,height:96,pixels,materials,expression:{...expression},morph,artId,active,composite:!!p?.composite,version:IDEAL_VERSION};cache.set(key,result);if(cache.size>32)cache.delete(cache.keys().next().value!);return result;
}
/** A designed reference, not a sampled animal or probability claim. */
export const renderIdeal=(morph:Morph,artId?:string)=>draw(morph,IDEAL_EXPRESSION,'ideal-art',undefined,artId);
export function renderInverse(input:{genome:Genome;seed:string}){const p=idealTraits(input.genome);return draw(p.morph,p.expression,input.seed,input.genome);}
export const idealCacheSize=()=>cache.size;
export function idealMask(result:IdealResult,mode:'materials'|'regions'|'protected'='materials'){
 const pixels=new Uint8ClampedArray(36864),colors:readonly RGB[]=[[41,54,55],[123,78,45],[241,204,148],[248,243,220],[78,66,77]];
 for(let i=0;i<9216;i++)if(A.alpha[i]){let c:RGB;
  if(mode==='protected')c=idealProtected(i)?[234,151,96]:[32,55,58];
  else if(mode==='regions')c=A.head[i]?[216,171,111]:A.body[i]?[141,199,109]:A.tail[i]?[123,164,205]:A.limbs[i]?[189,138,180]:[35,49,57];
  else c=idealProtected(i)?[27,39,46]:colors[result.materials[i]||(A.cream[i]?(result.morph==='lilly'?3:2):1)];
  pixels.set([...c,255],i*4);
 }return {width:96 as const,height:96 as const,pixels};
}
