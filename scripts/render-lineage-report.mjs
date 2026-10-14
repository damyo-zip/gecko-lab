/** Evidence composition only: original reference and unretouched browser pixels. */
import {readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const dir='docs/lineage-reference',hash=b=>createHash('sha256').update(b).digest('hex');
const reference=await readFile('references/gecko-lineage-ui.jpg'),actual=await readFile(dir+'/overview-720.png');
const refMeta=await sharp(reference).metadata(),actualMeta=await sharp(actual).metadata();
const before=await readFile(dir+'/before-390.png'),after=await readFile(dir+'/after-390-full.png');
const bm=await sharp(before).metadata(),am=await sharp(after).metadata();
const glyphs={A:'01110/10001/10001/11111/10001/10001/10001',B:'11110/10001/10001/11110/10001/10001/11110',C:'01111/10000/10000/10000/10000/10000/01111',E:'11111/10000/10000/11110/10000/10000/11111',F:'11111/10000/10000/11110/10000/10000/10000',I:'11111/00100/00100/00100/00100/00100/11111',L:'10000/10000/10000/10000/10000/10000/11111',M:'10001/11011/10101/10101/10001/10001/10001',N:'10001/11001/10101/10011/10001/10001/10001',O:'01110/10001/10001/10001/10001/10001/01110',P:'11110/10001/10001/11110/10000/10000/10000',R:'11110/10001/10001/11110/10100/10010/10001',S:'01111/10000/10000/01110/00001/00001/11110',T:'11111/00100/00100/00100/00100/00100/00100',U:'10001/10001/10001/10001/10001/10001/01110'};
const label=(text,x)=>[...text].flatMap((c,i)=>(glyphs[c]??'00000/00000/00000/00000/00000/00000/00000').split('/').flatMap((row,y)=>[...row].flatMap((bit,xx)=>bit==='1'?[`<rect x="${x+i*12+xx*2}" y="${10+y*2}" width="2" height="2"/>`]:[]))).join('');
async function comparison(left,right,lm,rm,leftTitle,rightTitle,file){
 const width=lm.width+rm.width+48,height=Math.max(lm.height,rm.height)+48;
 const labels=Buffer.from(`<svg width="${width}" height="32"><rect width="100%" height="100%" fill="#04141d"/><g fill="#b4e398">${label(leftTitle,16)}${label(rightTitle,lm.width+32)}</g></svg>`);
 await sharp({create:{width,height,channels:4,background:'#04141d'}}).composite([{input:labels,left:0,top:0},{input:left,left:16,top:32},{input:right,left:lm.width+32,top:32}]).png().toFile(dir+'/'+file);
}
if(refMeta.width!==720||actualMeta.width!==720||bm.width!==390||am.width!==390)throw new Error('Unexpected screenshot width');
await comparison(reference,actual,refMeta,actualMeta,'REFERENCE','IMPLEMENTATION','reference-implementation.png');
await comparison(before,after,bm,am,'BEFORE','AFTER','before-after.png');
const baseline=JSON.parse(await readFile(dir+'/baseline.json','utf8'));
const captures=[];
for(const file of ['before-390.png','after-390.png','after-390-full.png','comparison-390.png','after-720.png','after-720-full.png','overview-720.png','favorites-slider-390.png']){
 const buffer=await readFile(dir+'/'+file),m=await sharp(buffer).metadata();captures.push({file,width:m.width,height:m.height,sha256:hash(buffer)});
}
await writeFile(dir+'/capture-report.json',JSON.stringify({baselineCommit:baseline.baselineCommit,viewports:[{width:390,height:844},{width:720,height:1280},{width:720,height:actualMeta.height,purpose:'Full album at its natural document height, without a fixed nav covering the comparison panel'}],selectedId:baseline.selectedId,sameBiologicalRecords:true,saveUpgrade:'v7 → v8, founder ID and favorite status only',comparison:{scale:1,labelsOutsideImages:true,referenceOSBarsIncluded:true,implementationOSBarsNotInvented:true},reference:{path:'references/gecko-lineage-ui.jpg',width:refMeta.width,height:refMeta.height,sha256:hash(reference)},captures},null,2)+'\n');
await rm(dir+'/after-390-draft.png',{force:true});
console.log('Reference / implementation and before / after composed at native resolution.');
