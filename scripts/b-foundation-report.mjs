import {appearanceRuntime} from './appearance-runtime.mjs';
import {encodePNG} from './png.mjs';
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder='docs/b-foundations';
await appearanceRuntime(async load=>{
 const {FOUNDATIONS,FOUNDATION_SEED,foundationRows,renderBody,foundationEvidence}=await load('lab/appearance/b-breeding/foundation-study');
 const {B_FOUNDATION:F}=await load('lab/appearance/b-breeding/foundation');
 const {B_ANATOMY:A}=await load('lab/appearance/b-breeding/anatomy');
 await mkdir(folder,{recursive:true});const evidence=[];
 for(const scale of [1,3])for(const stage of ['body','final','morph-only']){
  const size=96*scale,col=Math.max(190,size+22),rowHeight=size+66;
  const rows=stage==='body'?[{id:'body',label:'내부 바디 · 노멀용 패턴 없음',examples:FOUNDATIONS.map(f=>({...f,result:renderBody(f.id)}))}]:foundationRows('typical',FOUNDATION_SEED,stage==='final');
  const overlays=[],width=col*3,height=46+rows.length*rowHeight;
  for(const [n,f]of FOUNDATIONS.entries())overlays.push({input:Buffer.from(`<svg width="${col}" height="36"><text x="10" y="25" fill="#d5e6c7" font-family="sans-serif" font-size="16">${f.label}</text></svg>`),left:col*n,top:0});
  for(const [row,r]of rows.entries())for(const [n,e]of r.examples.entries()){
   const png=encodePNG(96,96,e.result.pixels),y=44+row*rowHeight;
   overlays.push({input:Buffer.from(`<svg width="${col}" height="30"><text x="10" y="22" fill="#bacbb4" font-family="sans-serif" font-size="13">${r.label}</text></svg>`),left:col*n,top:y});
   overlays.push({input:await sharp(png).resize(size,size,{kernel:'nearest'}).png().toBuffer(),left:col*n+Math.floor((col-size)/2),top:y+32});
   if(scale===1){
    await writeFile(`${folder}/${stage}-${r.id}-${e.id}-96.png`,png);
    evidence.push({stage,morph:r.id,foundation:e.id,hash:createHash('sha256').update(e.result.pixels).digest('hex'),...foundationEvidence(e.result)});
   }
  }
  await sharp({create:{width,height,channels:4,background:'#0b1922'}}).composite(overlays).png().toFile(`${folder}/${stage}-${scale}x.png`);
 }
 const bodyDiagnostics=FOUNDATIONS.map(f=>{
  const p=renderBody(f.id).pixels,bins=Array.from({length:6},()=>[[],[]]),values=[];
  for(let i=0;i<9216;i++)if(F.mask[i]){const l=p[i*4]*.3+p[i*4+1]*.59+p[i*4+2]*.11;values.push(l);bins[F.tone[i]][Number(!!A.cream[i])].push(l);}
  const contrast=bins.filter(b=>b.every(a=>a.length)).map(b=>b[1].reduce((a,v)=>a+v,0)/b[1].length-b[0].reduce((a,v)=>a+v,0)/b[0].length);
  return {foundation:f.id,torsoPixels:values.length,torsoValueLevels:new Set(values.map(Math.round)).size,range:Math.max(...values)-Math.min(...values),matchedTonePigmentContrast:contrast.reduce((a,v)=>a+v,0)/contrast.length};
 });
 await writeFile(folder+'/evidence.json',JSON.stringify({version:'B-foundation-study-1',seed:FOUNDATION_SEED,profile:'typical',note:'Same explicit Normal pattern across all three foundations. Previous exact B finals remain separate and unchanged.',bodyDiagnostics,evidence},null,2)+'\n');
 console.log(JSON.stringify(evidence.filter(e=>e.stage==='final').map(e=>({m:e.morph,f:e.foundation,authored:e.authored,generated:e.generated,morphPixels:e.morphPixels}))));
});
