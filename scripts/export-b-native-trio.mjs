// A literal pixel editor/exporter, not a pattern generator. Every painted pixel
// has a fixed coordinate and palette index in pixel-edits.json. No RNG, masks,
// resizing, palette remapping, auto-lighting, or game/phenotype renderer.
import sharp from 'sharp';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const spec=JSON.parse(await readFile(resolve(root,'docs/b-native-trio/pixel-edits.json'),'utf8'));
const reference=resolve(root,spec.reference),out=resolve(root,'public/lab/b-native-trio');
const {data:original,info}=await sharp(reference).ensureAlpha().raw().toBuffer({resolveWithObject:true});
if(info.width!==96||info.height!==96)throw Error('Original B must be native 96×96');
await mkdir(out,{recursive:true});
const checking=process.argv.includes('--check');
const protectedColours=new Set([1,6,15,16,17,19].map(i=>spec.palette[i].join(',')));
if(checking){if(!(await readFile(reference)).equals(await readFile(resolve(out,'original.png'))))throw Error('Original B bytes changed');}
else await copyFile(reference,resolve(out,'original.png'));
for(const design of spec.designs){
 const pixels=Buffer.from(original),used=new Set();
 for(const[y,x0,row]of design.rows){
  const values=row.replaceAll(' ','');
  for(let n=0;n<values.length;n++){
   if(values[n]==='.')continue;
   const x=x0+n,p=(y*96+x)*4,colour=spec.palette[parseInt(values[n],36)];
   if(!colour||x<0||x>=96||y<0||y>=96||!original[p+3]||!colour[3])throw Error(design.id+': invalid pixel '+x+','+y);
   if(x<=35||y<=28)throw Error(design.id+': head/face protection '+x+','+y);
   const prior=original.subarray(p,p+4),changed=!prior.equals(Buffer.from(colour));
   const edge=[-97,-96,-95,-1,1,95,96,97].some(offset=>!original[(y*96+x+offset)*4+3]);
   const limb=(x<=43&&y>=43&&y<=65)||(x>=63&&x<=79&&y>=45&&y<=65);
   const belly=x>=40&&x<=62&&y>=49&&y<=53;
   // Authored inspection: the single isolated point (52,37) is pigment inside
   // the dorsal pattern, not a fold/outline. Its original dark colour may be repainted.
   const pigmentPoint=x===52&&y===37;
   if(changed&&(edge||limb||belly||(protectedColours.has([...prior].join(','))&&!pigmentPoint)))throw Error(design.id+': structural protection '+x+','+y);
   const key=x+','+y;if(used.has(key))throw Error(design.id+': duplicate edit '+key);used.add(key);
   pixels.set(colour,p);
  }
 }
 const file=resolve(out,design.id+'.png');
 if(checking){const saved=await sharp(file).ensureAlpha().raw().toBuffer();if(!pixels.equals(saved))throw Error(design.id+': PNG differs from the editable pixels');}
 else await sharp(pixels,{raw:{width:96,height:96,channels:4}}).png().toFile(file);
 console.log(design.id+': '+used.size+' explicitly placed pixels');
}
