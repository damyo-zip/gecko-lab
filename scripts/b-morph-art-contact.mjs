// Presentation only: reads the final PNGs; never regenerates artwork.
import sharp from 'sharp';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const arts=[['normal','노멀'],['lilly','릴리화이트'],['axanthic','아잔틱'],['cappuccino','카푸치노'],['highway','하이웨이'],['sable','세이블']];
for(const [name,scale,columns,cell]of [['native',1,6,120],['4x',4,3,384]]){
 const height=96*scale+32,rows=Math.ceil(6/columns),layers=[];
 for(let i=0;i<arts.length;i++){
  const[id,label]=arts[i],left=(i%columns)*cell,top=Math.floor(i/columns)*height;
  layers.push({input:await sharp(resolve(root,'public/lab/b-morph-art',id+'.png')).resize(96*scale,96*scale,{kernel:'nearest'}).toBuffer(),left:left+Math.floor((cell-96*scale)/2),top});
  layers.push({input:Buffer.from(`<svg width="${cell}" height="32"><text x="50%" y="21" text-anchor="middle" font-family="Noto Sans CJK KR, sans-serif" font-size="14" fill="#e4e8d8">${label}</text></svg>`),left,top:top+96*scale});
 }
 await sharp({create:{width:columns*cell,height:rows*height,channels:4,background:'#0c1d25'}}).composite(layers).png().toFile(resolve(root,'docs/b-morph-art/contact-'+name+'.png'));
}
