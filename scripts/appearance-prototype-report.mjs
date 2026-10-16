/** Reproducible lab renders, no production asset/save writes. */
import ts from 'typescript';
import sharp from 'sharp';
import {mkdtemp,mkdir,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import {join,dirname,relative,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {encodePNG} from './png.mjs';

const root=await mkdtemp(join(tmpdir(),'gecko-regional-report-')),folder='docs/appearance-prototype';
const hash=p=>createHash('sha256').update(p).digest('hex');
try {
  await writeFile(join(root,'package.json'),'{"type":"module"}');
  async function compile(dir){for(const e of await readdir(dir,{withFileTypes:true})){
    const file=join(dir,e.name);if(e.isDirectory()){await compile(file);continue;}if(!file.endsWith('.ts'))continue;
    const target=join(root,relative('src',file).replace(/\.ts$/,'.js'));
    const js=ts.transpileModule(await readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
      .replace(/from (["'])([^"']+)\1/g,(m,q,s)=>s.startsWith('@/')?`from ${q}${pathToFileURL(join(root,s.slice(2)+'.js'))}${q}`:
        s.endsWith('.json')?`from ${q}${pathToFileURL(resolve(dirname(file),s))}${q}`:s.startsWith('.')?`from ${q}${s}.js${q}`:m);
    await mkdir(dirname(target),{recursive:true});await writeFile(target,js);
  }}
  for(const d of ['engine','genetics','phenotype','game','prototype'])await compile('src/'+d);
  const load=p=>import(pathToFileURL(join(root,p+'.js')));
  const {comparison,MORPHS}=await load('prototype/appearance/fixtures');
  const {renderAppearancePrototype}=await load('prototype/appearance/render');
  const {sourceBase,anatomy}=await load('prototype/appearance/anatomy');
  const seed='regional-review-01',report={version:'regional-prototype-1',seed,examples:[],diversity:[]};
  await mkdir(folder,{recursive:true});
  const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const label=(text,w,h,size=18)=>({input:Buffer.from(`<svg width="${w}" height="${h}"><text x="8" y="${Math.round(h*.66)}" font-family="sans-serif" font-size="${size}" fill="#cde4cb">${escape(text)}</text></svg>`)});
  async function sheet(name,rows){
    const width=1240,height=80+Math.ceil(rows.length/2)*340,overlays=[];
    for(let n=0;n<rows.length;n++){
      const row=rows[n],x=(n%2)*620,y=70+Math.floor(n/2)*340;
      overlays.push({...label(row.title,610,32),left:x+10,top:y});
      for(const [j,sprite]of [row.c.old,row.c.improved.sprite].entries()){
        const image=await sharp(encodePNG(96,96,sprite.pixels)).resize(288,288,{kernel:'nearest'}).png().toBuffer();
        overlays.push({input:image,left:x+10+j*300,top:y+34});
        overlays.push({...label(j?'프로토타입':'기존',288,24,15),left:x+10+j*300,top:y+311});
      }
    }
    overlays.push({...label('GECKO LAB · 동일 다유전자 / 동일 시드 · '+name,1230,48,22),left:5,top:3});
    await sharp({create:{width,height,channels:4,background:'#0b1822'}}).composite(overlays).png().toFile(folder+'/'+name+'.png');
  }
  for(const profile of ['low','typical','high','dark','bright']){
    const rows=[];
    for(const m of MORPHS.slice(0,6)){
      const c=comparison(profile,m.id,seed),before=encodePNG(96,96,c.old.pixels),after=encodePNG(96,96,c.improved.sprite.pixels);
      const prefix=profile+'-'+m.id;
      await writeFile(folder+'/'+prefix+'-before.png',before);await writeFile(folder+'/'+prefix+'-after.png',after);
      await sharp(after).resize(384,384,{kernel:'nearest'}).png().toFile(folder+'/'+prefix+'-4x.png');
      const changed=c.old.pixels.reduce((n,v,i)=>n+(i%4===0&&[0,1,2,3].some(k=>c.old.pixels[i+k]!==c.improved.sprite.pixels[i+k])?1:0),0);
      report.examples.push({profile,morph:m.id,polygenicHash:hash(JSON.stringify(c.genome.polygenic)),genotype:c.genome.mendelian.loci,
        before:hash(c.old.pixels),after:hash(c.improved.sprite.pixels),changedPixels:changed,strength:c.improved.phenotype.strength,metrics:c.improved.metrics});
      rows.push({title:m.label+' · '+profile,c});
    }
    if(['low','typical','high'].includes(profile))await sheet(profile+'-comparison',rows);
  }
  await sheet('combination-comparison',MORPHS.slice(6).map(m=>({title:m.label,c:comparison('typical',m.id,seed)})));
  await sheet('axanthic-brightness',['dark','bright'].map(profile=>({title:'아잔틱 · '+profile,c:comparison(profile,'axanthic',seed)})));
  const faceOverlays=[{...label('릴리화이트 얼굴 · 같은 시드 / 구조 보호 · 8배',750,48,21),left:5,top:0}];
  for(const [n,profile]of ['low','typical','high'].entries()){
    const c=comparison(profile,'lilly',seed),y=55+n*300;
    for(const [j,sprite]of [c.old,c.improved.sprite].entries()){
      const face=await sharp(encodePNG(96,96,sprite.pixels)).extract({left:1,top:11,width:44,height:32}).resize(352,256,{kernel:'nearest'}).png().toBuffer();
      faceOverlays.push({input:face,left:12+j*376,top:y+28});
      faceOverlays.push({...label(profile+' · '+(j?'프로토타입':'기존'),360,28,17),left:12+j*376,top:y});
    }
  }
  await sharp({create:{width:752,height:960,channels:4,background:'#0b1822'}}).composite(faceOverlays).png().toFile(folder+'/lilly-face-comparison.png');
  for(const m of MORPHS.slice(1,6)){
    const hashes=[];let protectedErrors=0;
    for(let n=0;n<12;n++){
      const c=comparison('typical',m.id,'regional-diversity-'+n),r=c.improved.sprite;
      hashes.push(hash(r.pixels));
      for(let i=0;i<9216;i++)if(sourceBase.eye[i]||anatomy.mouth[i]||anatomy.nostrils[i]){
        const old=c.old.pixels.subarray(i*4,i*4+4),now=r.pixels.subarray(i*4,i*4+4);
        // Eye must match production; mouth/nostrils retain authored source in the prototype.
        if(sourceBase.eye[i]&&now.some((v,k)=>v!==old[k]))protectedErrors++;
      }
      if(n===0 && hash(r.pixels)!==hash(renderAppearancePrototype({genome:c.genome,seed:'regional-diversity-'+n}).sprite.pixels))throw new Error('Non deterministic output');
    }
    report.diversity.push({morph:m.id,count:12,unique:new Set(hashes).size,protectedEyeErrors:protectedErrors,hashes});
  }
  await writeFile(folder+'/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({examples:report.examples.map(e=>({profile:e.profile,morph:e.morph,strength:e.strength,metrics:e.metrics})),diversity:report.diversity.map(({hashes,...r})=>r)},null,2));
} finally {await rm(root,{recursive:true,force:true});}
