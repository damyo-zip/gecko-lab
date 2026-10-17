// Comparison sheets of the final PNGs. Does not draw or regenerate patterns.
import sharp from 'sharp';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const arts=[['original','원본 B'],['ribbon','연결형'],['islands','섬무늬형']];
for(const [name,scale,cell]of [['native',1,120],['4x',4,384]]){
 const height=96*scale+32,layers=[];
 for(let i=0;i<3;i++){
  const[id,label]=arts[i],left=i*cell;
  layers.push({input:await sharp(resolve(root,'public/lab/b-native-trio',id+'.png')).resize(96*scale,96*scale,{kernel:'nearest'}).toBuffer(),left:left+Math.floor((cell-96*scale)/2),top:0});
  layers.push({input:Buffer.from(`<svg width="${cell}" height="32"><text x="50%" y="21" text-anchor="middle" font-family="Noto Sans CJK KR, sans-serif" font-size="14" fill="#e4e8d8">${label}</text></svg>`),left,top:96*scale});
 }
 await sharp({create:{width:3*cell,height,channels:4,background:'#0c1d25'}}).composite(layers).png().toFile(resolve(root,'docs/b-native-trio/contact-'+name+'.png'));
}
