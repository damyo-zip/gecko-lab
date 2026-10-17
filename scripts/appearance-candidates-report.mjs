/** Lab evidence only; no player data or production asset is written. */
import {appearanceRuntime} from './appearance-runtime.mjs';
import {encodePNG} from './png.mjs';
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder='docs/appearance-candidates',seed='regional-review-01';
await appearanceRuntime(async load=>{
 const {renderComparison}=await load('lab/appearance/candidates');
 const {COMPARISONS}=await load('lab/appearance/policies');
 const {fixtureGenome,MORPHS}=await load('engine/regional/fixtures');
 const {anatomy:A,sourceBase:B}=await load('engine/regional/anatomy');
 const {PART}=await load('engine/art');
 await mkdir(folder,{recursive:true});
 const label=(text,w,h,size=16)=>({input:Buffer.from(`<svg width="${w}" height="${h}"><text x="8" y="${h*.72}" fill="#d1e8ce" font-family="sans-serif" font-size="${size}">${text}</text></svg>`)});
 const hash=p=>createHash('sha256').update(p).digest('hex');
 const L=(p,i)=>p[i*4]*.30+p[i*4+1]*.59+p[i*4+2]*.11;
 const report={seed,note:'Edge values are diagnostics, not an objective beauty score. Browser/game backgrounds must be visually reviewed.',examples:[],diversity:[]};
 async function sheet(profile,scale){
  const size=96*scale,col=Math.max(160,size+18),row=size+42,width=5*col,height=78+6*row;
  const overlays=[{...label('Same genome / seed / fire up · '+profile+' · '+scale+'x',width,30),left:0,top:0}];
  for(const [n,c]of COMPARISONS.entries())overlays.push({...label(c.label,col,30),left:n*col,top:34});
  for(const [morphIndex,m]of MORPHS.slice(0,6).entries()){
   const input={genome:fixtureGenome(profile,m.id),seed},baseline=renderComparison(input,'authored');
   for(const [column,c]of COMPARISONS.entries()){
    const r=renderComparison(input,c.id),png=encodePNG(96,96,r.pixels),x=column*col+Math.floor((col-size)/2),y=75+morphIndex*row;
    overlays.push({input:await sharp(png).resize(size,size,{kernel:'nearest'}).png().toBuffer(),left:x,top:y},{...label(m.label,col,26,14),left:column*col,top:y+size});
    if(scale!==1)continue;
    let changed=0,protectedChanged=0,alphaErrors=0;const edges={};
    for(let i=0;i<9216;i++){
     const same=baseline.pixels.subarray(i*4,i*4+4).every((v,k)=>v===r.pixels[i*4+k]);
     changed+=Number(!same);protectedChanged+=Number(!same&&!!A.protectedPixels[i]);alphaErrors+=Number(r.pixels[i*4+3]!==baseline.pixels[i*4+3]);
    }
    for(const [name,part]of [['head',PART.head],['body',PART.body],['tail',PART.tail]]){
     let n=0,before=0,after=0,agreement=0;
     for(let i=0;i<9216;i++)if(A.skin[i]&&B.parts[i]===part)for(const j of [i+1,i+96])if(j<9216&&A.skin[j]&&B.parts[j]===part){
      const a=L(baseline.pixels,i)-L(baseline.pixels,j),b=L(r.pixels,i)-L(r.pixels,j);
      if(Math.abs(a)<10)continue;n++;before+=Math.abs(a);after+=Math.abs(b);agreement+=Number(Math.sign(a)===Math.sign(b));
     }
     edges[name]={pairs:n,oldMeanContrast:before/n,newMeanContrast:after/n,directionAgreement:agreement/n};
    }
    report.examples.push({profile,morph:m.id,renderer:c.id,hash:hash(r.pixels),changed,protectedChanged,alphaErrors,edges});
    // Individual native examples are convenient for exact-size inspection.
    if(profile==='typical')await writeFile(`${folder}/${m.id}-${c.id}-96.png`,png);
   }
  }
  await sharp({create:{width,height,channels:4,background:'#0b1822'}}).composite(overlays).png().toFile(`${folder}/${profile}-${scale}x.png`);
 }
 for(const profile of ['low','typical','high','dark','bright'])for(const scale of [1,3])await sheet(profile,scale);
 // Same native head pixels cropped for inspection, never resynthesized.
 for(const profile of ['typical','high']){
  const width=5*210,height=45+6*185,overlays=[];
  for(const [column,c]of COMPARISONS.entries())overlays.push({...label(c.label,210,30),left:column*210,top:4});
  for(const [row,m]of MORPHS.slice(0,6).entries())for(const [column,c]of COMPARISONS.entries()){
   const r=renderComparison({genome:fixtureGenome(profile,m.id),seed},c.id);
   const png=await sharp(encodePNG(96,96,r.pixels)).extract({left:0,top:10,width:48,height:38}).resize(192,152,{kernel:'nearest'}).png().toBuffer();
   overlays.push({input:png,left:column*210+9,top:40+row*185},{...label(m.label,210,24,13),left:column*210,top:40+row*185+152});
  }
  await sharp({create:{width,height,channels:4,background:'#0b1822'}}).composite(overlays).png().toFile(`${folder}/faces-${profile}.png`);
 }
 for(const id of ['A','B','C']){
  const overlays=[],width=12*104,height=40+6*126;
  for(const [row,m]of MORPHS.slice(0,6).entries()){
   const hashes=[];
   for(let n=0;n<12;n++){
    const input={genome:fixtureGenome('typical',m.id),seed:'art-diversity-'+n},r=renderComparison(input,id);hashes.push(hash(r.pixels));
    overlays.push({input:encodePNG(96,96,r.pixels),left:n*104+4,top:40+row*126});
   }
   report.diversity.push({renderer:id,morph:m.id,unique:new Set(hashes).size,total:12});
   overlays.push({...label(m.label,width,24,13),left:0,top:40+row*126+96});
  }
  overlays.push({...label(id+' · 12 fixed visual seeds / morph · native 96px',width,30),left:0,top:0});
  await sharp({create:{width,height,channels:4,background:'#0b1822'}}).composite(overlays).png().toFile(`${folder}/diversity-${id}.png`);
 }
 const inputs=MORPHS.slice(0,6).flatMap(m=>COMPARISONS.map(c=>({input:{genome:fixtureGenome('typical',m.id),seed:'art-cache-benchmark'},id:c.id})));
 const start=performance.now(),results=inputs.map(r=>renderComparison(r.input,r.id)),coldMs=performance.now()-start,warmStart=performance.now();
 const sameObjects=inputs.every((r,n)=>renderComparison(r.input,r.id)===results[n]);
 report.performance={environment:'Node 24 on cloud CPU; not physical Android timing',sprites:30,coldMs,cachedMs:performance.now()-warmStart,sameObjects};
 // One measurement per line keeps generated evidence reviewable in Git diffs.
 const json=Object.entries(report).map(([key,value])=>`  ${JSON.stringify(key)}: ${Array.isArray(value)?'[\n'+value.map(v=>'    '+JSON.stringify(v)).join(',\n')+'\n  ]':JSON.stringify(value)}`).join(',\n');
 await writeFile(folder+'/measurements.json','{\n'+json+'\n}\n');
 console.log(JSON.stringify({examples:report.examples.length,normalExact:report.examples.filter(r=>r.morph==='normal'&&['A','B','C'].includes(r.renderer)).every(r=>r.changed===0),candidateProtectedChanges:report.examples.filter(r=>['A','B','C'].includes(r.renderer)).reduce((s,r)=>s+r.protectedChanged,0),diversity:report.diversity}));
});
