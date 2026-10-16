/** Three-way, native-size and nearest-neighbour evidence. Never edits source art. */
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {appearanceRuntime} from './appearance-runtime.mjs';
import {encodePNG} from './png.mjs';

const folder='docs/appearance-relief',seed='regional-review-01';
const hash=p=>createHash('sha256').update(p).digest('hex');
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const label=(s,w,h,size=16)=>({input:Buffer.from(`<svg width="${w}" height="${h}"><text x="8" y="${h*.70}" font-family="sans-serif" font-size="${size}" fill="#cde4cb">${escape(s)}</text></svg>`)});
await appearanceRuntime(async load=>{
  const {comparison,MORPHS,PROFILES}=await load('prototype/appearance/fixtures');
  const {structureContrast,localContrast,regionTones,headSkin,STRUCTURE_PROBES}=await load('prototype/appearance/quality');
  const {sourceBase:B,anatomy:A}=await load('prototype/appearance/anatomy');
  const {artColor}=await load('engine/art');
  const {relief}=await load('prototype/appearance/lighting');
  await mkdir(folder,{recursive:true});
  const report={version:'regional-prototype-2',seed,probes:STRUCTURE_PROBES,examples:[],diversity:[]};
  const views=c=>[c.old,c.improved.sprite,c.relief.sprite];
  async function sheet(name,rows,scale=3){
    const size=96*scale,col=size+14,rowHeight=size+78,width=Math.max(480,3*col+20),height=86+rows.length*rowHeight,overlays=[];
    overlays.push({...label('GECKO LAB · 정식 / 기존 v1 / 명암 개선 v2',width,36,18),left:0,top:0});
    overlays.push({...label(`${name} · 같은 유전체·시드·파이어 · ${scale===1?'실제 96px':scale+'배 정수 확대'}`,width,28,13),left:0,top:36});
    for(const [n,row]of rows.entries()){
      const y=76+n*rowHeight;overlays.push({...label(row.title,width,28),left:0,top:y});
      for(const [j,s]of views(row.c).entries()){
        const x=Math.floor((width-3*col)/2)+j*col;
        overlays.push({input:await sharp(encodePNG(96,96,s.pixels)).resize(size,size,{kernel:'nearest'}).png().toBuffer(),left:x,top:y+30});
        overlays.push({...label(['정식','기존 v1','명암 개선 v2'][j],col,24,12),left:x,top:y+32+size});
      }
    }
    await sharp({create:{width,height,channels:4,background:'#0b1822'}}).composite(overlays).png().toFile(`${folder}/${name}-${scale===1?'96px':scale+'x'}.png`);
  }
  for(const p of PROFILES){
    const rows=[];
    for(const m of MORPHS.slice(0,6)){
      const c=comparison(p.id,m.id,seed),prefix=`${folder}/${p.id}-${m.id}`;
      const png=encodePNG(96,96,c.relief.sprite.pixels);
      await writeFile(prefix+'-96.png',png);
      await sharp(png).resize(384,384,{kernel:'nearest'}).png().toFile(prefix+'-4x.png');
      const measurements=(s)=>({structure:structureContrast(s),localContrast:localContrast(s,c.improved.materials),head:regionTones(s,headSkin),white:regionTones(s,c.improved.white)});
      report.examples.push({profile:p.id,morph:m.id,fire:'up',production:hash(c.old.pixels),v1:hash(c.improved.sprite.pixels),v2:hash(c.relief.sprite.pixels),
        whiteMasksIdentical:hash(c.improved.white)===hash(c.relief.white),darkMasksIdentical:hash(c.improved.dark)===hash(c.relief.dark),materialMasksIdentical:hash(c.improved.materials)===hash(c.relief.materials),
        productionMeasurements:measurements(c.old),v1Measurements:measurements(c.improved.sprite),v2Measurements:measurements(c.relief.sprite),metrics:c.relief.metrics});
      rows.push({title:m.label+' · '+p.label,c});
    }
    for(const scale of [1,4])await sheet(p.id,rows,scale);
  }
  const ax=['dark','bright'].map(p=>({title:'아잔틱 · '+p,c:comparison(p,'axanthic',seed)}));
  for(const scale of [1,4])await sheet('axanthic-brightness',ax,scale);
  await sheet('combinations',MORPHS.slice(6).map(m=>({title:m.label,c:comparison('typical',m.id,seed)})),3);
  const face=[];
  for(const [n,p]of ['low','typical','high'].entries()){
    const c=comparison(p,'lilly',seed),y=42+n*288;
    for(const [j,s]of views(c).entries()){
      face.push({...label(p+' · '+['정식','기존 v1','명암 개선 v2'][j],360,24),left:8+j*368,top:y});
      face.push({input:await sharp(encodePNG(96,96,s.pixels)).extract({left:1,top:11,width:44,height:32}).resize(352,256,{kernel:'nearest'}).png().toBuffer(),left:8+j*368,top:y+25});
    }
  }
  face.push({...label('릴리 얼굴·코 확대 · 백색 피복 동일 / 눈·입선·콧구멍 보호',1104,36,18),left:0,top:0});
  await sharp({create:{width:1104,height:912,channels:4,background:'#0b1822'}}).composite(face).png().toFile(folder+'/lilly-face.png');
  // Show the exact annotated source space, including measurement locations.
  const source=new Uint8ClampedArray(9216*4);
  for(let i=0;i<9216;i++)if(B.silhouette[i])source.set([...artColor(B.details[i]),255],i*4);
  let svg='<svg width="768" height="768">';
  for(let i=0;i<9216;i++)if(relief.crease[i])svg+=`<rect x="${i%96*8}" y="${Math.floor(i/96)*8}" width="8" height="8" fill="#58b8ff" opacity=".5"/>`;
  for(const [n,p]of STRUCTURE_PROBES.entries())for(const [j,point]of [p.light,p.shade].entries())svg+=`<circle cx="${point[0]*8+4}" cy="${point[1]*8+4}" r="5" stroke="${j?'#ff536a':'#a7ff51'}" stroke-width="2" fill="none"/><text x="${point[0]*8+8}" y="${point[1]*8-3}" fill="white" font-size="12">${n+1}</text>`;
  svg+='</svg>';
  await sharp(encodePNG(96,96,source)).resize(768,768,{kernel:'nearest'}).flatten({background:'#0b1822'}).composite([{input:Buffer.from(svg)}]).png().toFile(folder+'/structure-probes.png');
  for(const m of MORPHS.slice(0,6)){
    const hashes=[];let protectedErrors=0,maskErrors=0;
    for(let n=0;n<12;n++)for(const fire of ['up','down']){
      const c=comparison('typical',m.id,'regional-diversity-'+n,fire);hashes.push(hash(c.relief.sprite.pixels));
      if(hash(c.improved.white)!==hash(c.relief.white)||hash(c.improved.dark)!==hash(c.relief.dark)||hash(c.improved.materials)!==hash(c.relief.materials))maskErrors++;
      for(let i=0;i<9216;i++)if(A.protectedPixels[i])for(let k=0;k<4;k++)protectedErrors+=Number(c.improved.sprite.pixels[i*4+k]!==c.relief.sprite.pixels[i*4+k]);
    }
    report.diversity.push({morph:m.id,seeds:12,fireStates:2,unique:new Set(hashes).size,protectedErrors,maskErrors,hashes});
  }
  await writeFile(folder+'/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({examples:report.examples.length,diversity:report.diversity.map(({hashes,...r})=>r),normal:report.examples.find(e=>e.profile==='typical'&&e.morph==='normal')},null,2));
});
