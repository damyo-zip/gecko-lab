import {appearanceRuntime} from './appearance-runtime.mjs';
import {encodePNG} from './png.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const folder='docs/b-normal-art',digest=p=>createHash('sha256').update(p).digest('hex');
await mkdir(folder,{recursive:true});
await appearanceRuntime(async load=>{
 const {NORMAL_ART}=await load('lab/appearance/b-breeding/normal-art/art');
 const {renderNormalArt,normalPatternMask,NORMAL_ART_VERSION}=await load('lab/appearance/b-breeding/normal-art/render');
 const {measureNormalArt}=await load('lab/appearance/b-breeding/normal-art/measure');
 const samples=NORMAL_ART.map(d=>({...d,sprite:renderNormalArt(d.id),mask:normalPatternMask(d.id)}));
 const title=(s,w)=>Buffer.from(`<svg width="${w}" height="36"><text x="12" y="25" fill="#dce8cb" font-family="sans-serif" font-size="14">${s}</text></svg>`);
 for(const scale of [1,3]){
  const size=96*scale,w=size+36,h=size+63,cols=4,overlays=[];
  for(const[d,n]of samples.map((d,n)=>[d,n])){
   const png=encodePNG(96,96,d.sprite.pixels);
   if(scale===1)await writeFile(`${folder}/${d.id}-96.png`,png);
   overlays.push({input:title(d.name,w),left:n%cols*w,top:Math.floor(n/cols)*h},{input:await sharp(png).resize(size,size,{kernel:'nearest'}).png().toBuffer(),left:n%cols*w+18,top:Math.floor(n/cols)*h+40});
  }
  await sharp({create:{width:w*cols,height:h*2,channels:4,background:'#132328'}}).composite(overlays).png().toFile(`${folder}/normal-eight-${scale}x.png`);
 }
 const overlays=[];
 for(const[d,n]of samples.map((d,n)=>[d,n])){
  await writeFile(`${folder}/${d.id}-mask-96.png`,encodePNG(96,96,d.mask.pixels));
  overlays.push({input:title(d.name,228),left:n%4*228,top:Math.floor(n/4)*242},{input:await sharp(encodePNG(96,96,d.mask.pixels)).resize(192,192,{kernel:'nearest'}).png().toBuffer(),left:n%4*228+18,top:Math.floor(n/4)*242+40});
 }
 await sharp({create:{width:912,height:484,channels:4,background:'#132328'}}).composite(overlays).png().toFile(folder+'/pattern-masks-2x.png');
 const evidence={version:NORMAL_ART_VERSION,originalFileHash:digest(await readFile('public/lab/base-study/B-normal.png')),designs:samples.map(d=>({id:d.id,name:d.name,pixelHash:digest(d.sprite.pixels),maskHash:digest(d.sprite.mask),metrics:measureNormalArt(d.id),genes:d.genes,gap:d.gap})),pairwise:samples.flatMap((a,i)=>samples.slice(i+1).map(b=>{let xor=0,union=0,onlyA=0,onlyB=0;for(let j=0;j<9216;j++){const aa=!!a.sprite.mask[j],bb=!!b.sprite.mask[j];xor+=Number(aa!==bb);union+=Number(aa||bb);onlyA+=Number(aa&&!bb);onlyB+=Number(bb&&!aa);}return {a:a.id,b:b.id,xor,union,differenceFraction:xor/union,onlyA,onlyB};}))};
 await writeFile(folder+'/evidence.json',JSON.stringify(evidence,null,2)+'\n');console.log(evidence.designs.map(d=>({id:d.id,area:d.metrics.area,components:d.metrics.components,boundary:d.metrics.boundary.toFixed(1)})));console.log('Closest mask pair:',evidence.pairwise.sort((a,b)=>a.differenceFraction-b.differenceFraction)[0]);
});
