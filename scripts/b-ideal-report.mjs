import {appearanceRuntime} from './appearance-runtime.mjs';
import {encodePNG} from './png.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const dir='docs/b-ideal-appearance',hash=p=>createHash('sha256').update(p).digest('hex');
await mkdir(dir,{recursive:true});
await appearanceRuntime(async load=>{
 const {MORPHS}=await load('lab/appearance/b-breeding/ideal/art');
 const {renderIdeal,renderInverse,idealMask,IDEAL_VERSION}=await load('lab/appearance/b-breeding/ideal/render');
 const {controlGenome,LEVELS,deficitExamples,brightnessExamples,inheritanceFamily,breedingHistory,LAB_SEED}=await load('lab/appearance/b-breeding/ideal/samples');
 const {renderBase}=await load('lab/appearance/base-study/render');
 const {observeIdeal}=await load('lab/appearance/b-breeding/ideal/observe');
 const metadata=[],item=(label,g,seed=LAB_SEED)=>({label,sprite:renderInverse({genome:g,seed}),genome:g,seed});
 const caption=(s,w)=>Buffer.from(`<svg width="${w}" height="34"><text x="8" y="24" fill="#d8e8cb" font-family="sans-serif" font-size="13">${s}</text></svg>`);
 async function sheet(name,rows,scale=2){const size=96*scale,w=Math.max(size+20,190),h=size+47,overlays=[],cols=Math.max(...rows.map(r=>r.length));for(const[row,y]of rows.map((r,n)=>[r,n]))for(const[d,x]of row.map((d,n)=>[d,n])){
  const png=encodePNG(96,96,d.sprite.pixels);overlays.push({input:caption(d.label,w),left:x*w,top:y*h},{input:await sharp(png).resize(size,size,{kernel:'nearest'}).png().toBuffer(),left:x*w+Math.floor((w-size)/2),top:y*h+36});
  if(scale===1){await writeFile(`${dir}/${name}-${y}-${x}-96.png`,png);metadata.push({group:name,row:y,column:x,label:d.label,genome:d.genome,seed:d.seed,hash:hash(d.sprite.pixels),expression:d.sprite.expression,active:d.sprite.active,observed:d.sprite.materials?observeIdeal(d.sprite):undefined});}
 }await sharp({create:{width:cols*w,height:rows.length*h,channels:4,background:'#132328'}}).composite(overlays).png().toFile(`${dir}/${name}-${scale}x.png`);}
 const ideals=MORPHS.map(m=>({label:m.label+' · 이상형',sprite:renderIdeal(m.id)}));
 for(const scale of [1,3])await sheet('ideals',[ideals.slice(0,3),ideals.slice(3)],scale);
 for(const scale of [1,2]){
  await sheet('steps',MORPHS.map(m=>LEVELS.map((label,n)=>item(m.label+' · '+(n+1),controlGenome(m.id,n)))),scale);
  await sheet('deficits',MORPHS.map(m=>deficitExamples(m.id).map(e=>item(m.label+' · '+e.label,e.genome,e.seed))),scale);
  await sheet('lightness',MORPHS.map(m=>brightnessExamples(m.id).map(e=>item(m.label+' · '+e.label,e.genome,e.seed))),scale);
  await sheet('original',[[{label:'최초 B · 무수정',sprite:renderBase('B')},ideals[0]]],scale);
 }
 const histories=[];
 for(const m of MORPHS){
  const f=inheritanceFamily(m.id),history=breedingHistory(m.id);
  const image=g=>g.viable?item((g===f.father?'아비':g===f.mother?'어미':'자손')+' · '+MORPHS.find(m=>m.id===renderInverse(g).morph).label,g.genome,g.seed):{label:'기존 규칙상 비생존 배아',sprite:{width:96,height:96,pixels:new Uint8ClampedArray(36864)}};
  for(const scale of [1,2]){
   await sheet('family-'+m.id,[[image(f.father),image(f.mother)],f.children.slice(0,3).map(image),f.children.slice(3).map(image)],scale);
   await sheet('selection-'+m.id,[[0,2,4,6].map(n=>item('G'+n+' · 선별 부모',history[n].selected[0].genome,history[n].selected[0].seed))],scale);
  }
  histories.push({morph:m.id,generations:history.map(g=>({generation:g.generation,eligible:g.eligible,nonViable:g.nonViable,mean:g.mean,min:g.min,max:g.max,parents:g.parents,selected:g.selected,firstChildren:g.children.slice(0,6)}))});
 }
 await sheet('masks',[MORPHS.map(m=>({label:m.label+' · 재질',sprite:idealMask(renderIdeal(m.id))})),MORPHS.map(m=>({label:m.label+' · 보호',sprite:idealMask(renderIdeal(m.id),'protected')}))],2);
 await writeFile(dir+'/evidence.json',JSON.stringify({version:IDEAL_VERSION,seed:LAB_SEED,originalFileHash:hash(await readFile('public/lab/base-study/B-normal.png')),metadata,histories})+'\n');
 console.log(histories.map(h=>({morph:h.morph,start:h.generations[0].mean,end:h.generations.at(-1).mean,min:h.generations.at(-1).min,selected:h.generations.at(-1).max})));
 console.log('Native samples:',metadata.length);
});
