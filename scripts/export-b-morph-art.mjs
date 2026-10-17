// Asset preparation only. Reads six independently drawn source illustrations;
// never calls the game renderer, genetics, pattern library, or save system.
import sharp from 'sharp';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const source=resolve(root,'docs/b-morph-art/sources');
const output=resolve(root,'public/lab/b-morph-art');
const ids=['normal','lilly','axanthic','cappuccino','highway','sable'];
const check=process.argv.includes('--check');
await mkdir(output,{recursive:true});
const manifest=[];
for(const id of ids){
 const {data,info}=await sharp(await readFile(resolve(source,id+'.png'))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=info.width,top=info.height,right=0,bottom=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
  if(data[(y*info.width+x)*4+3]<160)continue;
  left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
 }
 const width=right-left+1,height=bottom-top+1;
 // Original B occupies x3..92, y15..80. Fit without stretching or interpolation.
 const ratio=Math.min(90/width,68/height);
 const w=Math.round(width*ratio),h=Math.round(height*ratio);
 const crop=await sharp(data,{raw:info}).extract({left,top,width,height}).resize(w,h,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
 // Remove generated translucent edge residue; never blend pixels into the background.
 for(let p=0;p<crop.length;p+=4){
  crop[p+3]=crop[p+3]>=160?255:0;
  if(!crop[p+3])crop.fill(0,p,p+4);
 }
 const png=await sharp({create:{width:96,height:96,channels:4,background:'#00000000'}})
  .composite([{input:crop,raw:{width:w,height:h,channels:4},left:Math.floor((96-w)/2),top:Math.floor(48-h/2)}])
  .png({palette:true,quality:35,dither:0,effort:10}).toBuffer();
 const pixels=await sharp(png).ensureAlpha().raw().toBuffer();
 const colours=new Set();
 for(let p=0;p<pixels.length;p+=4)if(pixels[p+3])colours.add(pixels.subarray(p,p+3).toString('hex'));
 if(colours.size>32)throw Error(id+': review palette before exporting ('+colours.size+' opaque colours)');
 const target=resolve(output,id+'.png');
 if(check){if(!png.equals(await readFile(target)))throw Error(id+': asset differs; do not overwrite an artist edit');}
 else await writeFile(target,png);
 manifest.push({id,source:[info.width,info.height],crop:{left,top,width,height},output:[96,96],occupied:[w,h],opaqueColours:colours.size});
}
if(!check)await writeFile(resolve(root,'docs/b-morph-art/export.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(check?'Six PNG exports match their sources.':'Exported six fixed PNG assets.');
