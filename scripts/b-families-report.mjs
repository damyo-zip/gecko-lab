import {appearanceRuntime} from './appearance-runtime.mjs';
import {encodePNG} from './png.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const folder='docs/b-pattern-families',seed='b-families-01',digest=b=>createHash('sha256').update(b).digest('hex');
await appearanceRuntime(async load=>{
 const {FAMILIES,MORPH_FAMILIES}=await load('lab/appearance/b-breeding/families/art-source'),{renderFamily}=await load('lab/appearance/b-breeding/families/render');
 const {fixtureGenome}=await load('engine/regional/fixtures'),{renderBase}=await load('lab/appearance/base-study/render'),{family,selectionStudy}=await load('lab/appearance/b-breeding/samples');
 await mkdir(folder,{recursive:true});const evidence=[];
 const ex=(m='normal',p='typical',s=seed)=>({genome:fixtureGenome(p,m),seed:s});
 const sample=(label,input,options)=>{const r=renderFamily(input,options);return {label:label+' · '+r.family,sprite:r,input,options};};
 const txt=(s,w)=>Buffer.from(`<svg width="${w}" height="34"><text x="8" y="23" fill="#dbe7cf" font-family="sans-serif" font-size="13">${s}</text></svg>`);
 async function sheet(name,rows,scale){const size=96*scale,col=Math.max(190,size+20),cols=Math.max(...rows.map(r=>r.length)),height=rows.length*(size+47)+8,overlays=[];
  for(const[y,row]of rows.entries())for(const[x,e]of row.entries()){const png=encodePNG(96,96,e.sprite.pixels);overlays.push({input:txt(e.label,col),left:x*col,top:y*(size+47)},{input:await sharp(png).resize(size,size,{kernel:'nearest'}).png().toBuffer(),left:x*col+Math.floor((col-size)/2),top:y*(size+47)+35});if(scale===1){await writeFile(`${folder}/${name}-${y}-${x}-96.png`,png);evidence.push({group:name,row:y,column:x,label:e.label,input:e.input,options:e.options,artId:e.sprite.artId,hash:digest(e.sprite.pixels),changed:e.sprite.changedPixels,selection:e.sprite.selection});}}
  await sharp({create:{width:cols*col,height,channels:4,background:'#0b1922'}}).composite(overlays).png().toFile(`${folder}/${name}-${scale}x.png`);
 }
 for(const scale of [1,3]){
  await sheet('families',MORPH_FAMILIES.map(m=>FAMILIES.map(f=>sample(m.label+' · '+f.label,ex(m.id),{family:f.id,cadence:'a'}))),scale);
  await sheet('expression',MORPH_FAMILIES.map(m=>['low','typical','high'].map((p,n)=>sample(m.label+' · '+['低','일반','高'][n],ex(m.id,p)))),scale);
  await sheet('brightness',MORPH_FAMILIES.map(m=>['dark','bright'].map(p=>sample(m.label+' · '+(p==='dark'?'어두움':'밝음'),ex(m.id,p),{family:'classic',cadence:'a'}))),scale);
  await sheet('cadence',MORPH_FAMILIES.map(m=>['a','b'].map(c=>sample(m.label+' · 기본 흐름 '+c,ex(m.id),{family:'classic',cadence:c}))),scale);
  await sheet('original',[[{label:'최초 B · 수정 없음',sprite:renderBase('B')},sample('이번 기본 흐름형',ex(),{family:'classic',cadence:'a'})]],scale);
  for(const id of ['lilly','axanthic','complex']){const f=family(id,seed);await sheet('family-'+id,[[sample('아비',f.father),sample('어미',f.mother)],f.children.map((c,n)=>sample('첫 자손 '+(n+1),c))],scale);}
  await sheet('selection',[selectionStudy().filter(g=>[0,1,3,5].includes(g.generation)).map(g=>sample('G'+g.generation,g.selected[0]))],scale);
 }
 const original=await readFile('public/lab/base-study/B-normal.png');await writeFile(folder+'/B-original-96.png',original);
 await writeFile(folder+'/evidence.json',JSON.stringify({version:'B-pattern-family-1',seed,originalFileHash:digest(original),evidence,families:['lilly','axanthic','complex'].map(id=>family(id,seed))})+'\n');console.log({samples:evidence.length,artMaps:48});
});
