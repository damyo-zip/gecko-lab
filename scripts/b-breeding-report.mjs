/** B genotype→art experiment. Exports evidence, never game records/assets. */
import {appearanceRuntime} from './appearance-runtime.mjs';
import {encodePNG} from './png.mjs';
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder='docs/b-breeding',seed='b-breeding-01';
await appearanceRuntime(async load=>{
 const {renderB}=await load('lab/appearance/b-breeding/render');
 const {CORE_MORPHS,LEVELS,conditionExamples,family,selectionStudy}=await load('lab/appearance/b-breeding/samples');
 const {bPhenotype}=await load('lab/appearance/b-breeding/phenotype');
 const {fixtureGenome}=await load('engine/regional/fixtures');
 await mkdir(folder,{recursive:true});const measurements=[],families={};
 const label=(text,w,h,size=15)=>({input:Buffer.from(`<svg width="${w}" height="${h}"><text x="8" y="${h*.72}" fill="#d8e9ce" font-family="sans-serif" font-size="${size}">${text}</text></svg>`)});
 const hash=p=>createHash('sha256').update(p).digest('hex');
 async function paint(overlays,input,x,y,size){const r=renderB(input),png=encodePNG(96,96,r.pixels);overlays.push({input:await sharp(png).resize(size,size,{kernel:'nearest'}).png().toBuffer(),left:x,top:y});return r;}
 async function grid(name,rows,scale){
  const size=96*scale,col=Math.max(158,size+20),cols=rows[0].examples.length,width=cols*col,rowHeight=size+64,height=30+rows.length*rowHeight,overlays=[];
  for(const [row,r]of rows.entries())for(const [n,e]of r.examples.entries()){
   const x=n*col,y=25+row*rowHeight;overlays.push({...label(r.label,col,25,14),left:x,top:y});
   const out=await paint(overlays,e,x+Math.floor((col-size)/2),y+28,size);overlays.push({...label(e.label,col,25,13),left:x,top:y+28+size});
   if(scale===1){await writeFile(`${folder}/${name}-${r.id}-${n}-96.png`,encodePNG(96,96,out.pixels));const p=bPhenotype(e.genome);measurements.push({group:name,morph:r.id,example:n,seed:e.seed,pixels:hash(out.pixels),strength:p.strength,scores:p.scores,metrics:out.metrics});}
  }
  await sharp({create:{width,height,channels:4,background:'#0b1922'}}).composite(overlays).png().toFile(`${folder}/${name}-${scale}x.png`);
 }
 for(const scale of [1,3]){
  await grid('morphs',CORE_MORPHS.map(m=>({id:m.id,label:m.label,examples:LEVELS.map(l=>({label:l.label,genome:fixtureGenome(l.id,m.id),seed}))})),scale);
  for(const condition of ['diverse','brightness','pattern'])await grid(condition,CORE_MORPHS.map(m=>({id:m.id,label:m.label,examples:conditionExamples(m.id,condition,seed)})),scale);
 }
 for(const id of ['lilly','axanthic','complex']){
  const f=family(id,seed);families[id]=f;
  for(const scale of [1,3]){
   const size=96*scale,col=Math.max(170,size+20),width=4*col,height=2*(size+68)+28,overlays=[];
   for(const [n,p]of [f.father,f.mother].entries()){
    const x=(n+1)*col;await paint(overlays,p,x+Math.floor((col-size)/2),25,size);overlays.push({...label((n?'어미':'아비')+' · '+p.name,col,28,13),left:x,top:25+size});
   }
   for(const [n,c]of f.children.entries()){
    const y=size+100;await paint(overlays,c,n*col+Math.floor((col-size)/2),y,size);overlays.push({...label('자손 '+(n+1)+' · '+c.name,col,28,13),left:n*col,top:y+size});
   }
   await sharp({create:{width,height,channels:4,background:'#0b1922'}}).composite(overlays).png().toFile(`${folder}/family-${id}-${scale}x.png`);
  }
 }
 const selection=selectionStudy();
 for(const scale of [1,3])await grid('selection',[{id:'highway',label:'등 · 크림 형질 선택교배',examples:selection.filter(g=>[0,1,3,5].includes(g.generation)).map(g=>({...g.selected[0],label:g.generation===0?'시작 부모':g.generation+'세대 선별'}))}],scale);
 for(const scale of [1,3])await grid('compounds',[{id:'compound',label:'잠정 복합 표현',examples:['lilly-axanthic','frappuccino','lilly-sable','cappuccino-highway'].map(m=>({label:{'lilly-axanthic':'릴리 아잔틱',frappuccino:'프라푸치노','lilly-sable':'릴리 + 세이블','cappuccino-highway':'카푸치노 + 하이웨이'}[m],genome:fixtureGenome('typical',m),seed}))}],scale);
 const evidence={version:'B-breeding-study-1',seed,note:'Transient legal genotypes, original 60-locus and Mendelian transmission. Spatial coefficients are a visual game approximation.',measurements,families,selection:selection.map(g=>({generation:g.generation,meanInheritedScore:g.mean,parents:g.parents.map(p=>p.id),selected:g.selected.map(p=>({id:p.id,genome:p.genome,parents:p.parents,metrics:renderB(p).metrics})),allChildren:g.children.map(c=>({id:c.id,genome:c.genome,parents:c.parents}))}))};
 await writeFile(folder+'/evidence.json',JSON.stringify(evidence)+'\n');
 console.log(JSON.stringify({examples:measurements.length,families:Object.keys(families),selection:selection.map(g=>({generation:g.generation,mean:g.mean,strength:bPhenotype(g.selected[0].genome).strength.highway,white:renderB(g.selected[0]).metrics.dorsalWhite}))}));
});
