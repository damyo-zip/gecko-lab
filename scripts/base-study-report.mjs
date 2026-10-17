import {appearanceRuntime} from './appearance-runtime.mjs';
import {encodePNG} from './png.mjs';
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder='docs/base-study';
await appearanceRuntime(async load=>{
 const {renderBase,baseAnatomy}=await load('lab/appearance/base-study/render');
 const {DESIGNS,VARIANTS}=await load('lab/appearance/base-study/designs');
 const {referenceSprite}=await load('lab/appearance/base-study/reference');
 await mkdir(folder,{recursive:true});const measurements=[];
 const label=(text,w,h,size=16)=>({input:Buffer.from(`<svg width="${w}" height="${h}"><text x="8" y="${h*.72}" fill="#d6e8ce" font-family="sans-serif" font-size="${size}">${text}</text></svg>`)});
 for(const reference of ['authored','regional'])for(const scale of [1,3]){
  const size=96*scale,col=Math.max(164,size+18),row=size+50,width=4*col,height=70+5*row,overlays=[];
  for(const [n,title]of [reference==='authored'?'기존 원화 정식':'현재 v2',...DESIGNS.map(d=>d.name)].entries())overlays.push({...label(title,col,32,14),left:n*col,top:6});
  for(const [y,v]of VARIANTS.entries()){
   const sprites=[referenceSprite(v.id,reference),...DESIGNS.map(d=>renderBase(d.id,v.id))];
   for(const [x,r]of sprites.entries()){
    const png=encodePNG(96,96,r.pixels);overlays.push({input:await sharp(png).resize(size,size,{kernel:'nearest'}).png().toBuffer(),left:x*col+Math.floor((col-size)/2),top:48+y*row},{...label(v.label,col,26,13),left:x*col,top:48+y*row+size});
    if(reference==='authored'&&scale===1)await writeFile(`${folder}/${x===0?'reference':DESIGNS[x-1].id}-${v.id}-96.png`,png);
   }
  }
  await sharp({create:{width,height,channels:4,background:'#0b1922'}}).composite(overlays).png().toFile(`${folder}/${reference}-compare-${scale}x.png`);
 }
 for(const scale of [1,4]){
  const size=96*scale,col=Math.max(164,size+18),width=4*col,height=size+55,overlays=[];
  const sprites=[{name:'기존 원화 정식',r:referenceSprite('normal','authored')},...DESIGNS.map(d=>({name:d.name,r:renderBase(d.id)}))];
  for(const [x,s]of sprites.entries())overlays.push({...label(s.name,col,32,14),left:x*col,top:0},{input:await sharp(encodePNG(96,96,s.r.pixels)).resize(size,size,{kernel:'nearest'}).png().toBuffer(),left:x*col+Math.floor((col-size)/2),top:40});
  await sharp({create:{width,height,channels:4,background:'#0b1922'}}).composite(overlays).png().toFile(`${folder}/normal-four-${scale}x.png`);
 }
 const overlays=[],sizes=[48,72,96],width=3*250,height=158;
 for(const [x,d]of DESIGNS.entries()){
  overlays.push({...label(d.name,250,26,13),left:x*250,top:0});let left=x*250+4;
  for(const size of sizes){overlays.push({input:await sharp(encodePNG(96,96,renderBase(d.id).pixels)).resize(size,size,{kernel:'nearest'}).png().toBuffer(),left,top:32+Math.floor((96-size)/2)});left+=size+8;}
 }
 await sharp({create:{width,height,channels:4,background:'#0b1922'}}).composite(overlays).png().toFile(`${folder}/growth-48-72-96.png`);
 for(const d of DESIGNS){const mask=baseAnatomy(d.id).torso;
  for(const v of VARIANTS){const p=renderBase(d.id,v.id).pixels;let area=0,n=0,total=0;const colors=new Set();for(let i=0;i<9216;i++){
   if(p[i*4+3])colors.add(p.subarray(i*4,i*4+3).join());if(mask[i]){n++;const r=p[i*4],g=p[i*4+1],b=p[i*4+2],l=r*.3+g*.59+b*.11;total+=l;area+=Number(l>145&&r-g<45&&g-b>8);}
  }measurements.push({candidate:d.id,variant:v.id,sha256:createHash('sha256').update(p).digest('hex'),colors:colors.size,torso:n,meanTorsoLuminance:total/n,creamPixels:area});}
 }
 await writeFile(folder+'/measurements.json',JSON.stringify({note:'Visual exploration, not inherited phenotype measurements or calibrated game evaluation',examples:measurements},null,2)+'\n');
 console.log('Native comparison sheets and '+measurements.length+' expression examples exported');
});
