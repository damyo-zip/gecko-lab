/** Produce review PNGs from the REAL synchronous renderer, never concept crops.
 * All enlargements copy each logical pixel into an integer 4×4 block. */
import ts from "typescript";
import {readFile,writeFile,mkdtemp,readdir,mkdir,rm} from "node:fs/promises";
import {join,dirname} from "node:path";
import {tmpdir} from "node:os";
import {pathToFileURL} from "node:url";
import {createHash} from "node:crypto";
import {encodePNG,decodePNG} from "./png.mjs";
const temp=await mkdtemp(join(tmpdir(),"gecko-art-report-")),folder="docs/phase6";
try{
 await writeFile(join(temp,"package.json"),JSON.stringify({type:"module"}));
 async function compile(dir,relative=""){
  for(const entry of await readdir(dir,{withFileTypes:true})){
   const path=join(dir,entry.name),name=join(relative,entry.name);if(entry.isDirectory()){await compile(path,name);continue;}
   if(!entry.name.endsWith(".ts"))continue;
   const js=ts.transpileModule(await readFile(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from (["'])(\.[^"']+)\1/g,(_m,q,s)=>`from ${q}${s}.js${q}`);
   const target=join(temp,name.replace(/\.ts$/,".js"));await mkdir(dirname(target),{recursive:true});await writeFile(target,js);
  }
 }
 await compile("src/engine");
 const {renderSprite,renderLegacySprite}=await import(pathToFileURL(join(temp,"render.js"))),{MORPH_PRESETS,specimenFromPreset}=await import(pathToFileURL(join(temp,"presets.js")));
 await mkdir(folder,{recursive:true});const seed="phase6-comparison",input=specimenFromPreset(MORPH_PRESETS[0],seed),before=renderLegacySprite(input),after=renderSprite(input);
 const hash=p=>createHash("sha256").update(p).digest("hex");
 const glyphs={A:["01110","10001","10001","11111","10001","10001","10001"],B:["11110","10001","10001","11110","10001","10001","11110"],C:["01111","10000","10000","10000","10000","10000","01111"],D:["11110","10001","10001","10001","10001","10001","11110"],E:["11111","10000","10000","11110","10000","10000","11111"],F:["11111","10000","10000","11110","10000","10000","10000"],G:["01111","10000","10000","10111","10001","10001","01111"],H:["10001","10001","10001","11111","10001","10001","10001"],I:["11111","00100","00100","00100","00100","00100","11111"],J:["00111","00010","00010","00010","00010","10010","01100"],K:["10001","10010","10100","11000","10100","10010","10001"],L:["10000","10000","10000","10000","10000","10000","11111"],M:["10001","11011","10101","10101","10001","10001","10001"],N:["10001","11001","10101","10011","10001","10001","10001"],O:["01110","10001","10001","10001","10001","10001","01110"],P:["11110","10001","10001","11110","10000","10000","10000"],Q:["01110","10001","10001","10001","10101","10010","01101"],R:["11110","10001","10001","11110","10100","10010","10001"],S:["01111","10000","10000","01110","00001","00001","11110"],T:["11111","00100","00100","00100","00100","00100","00100"],U:["10001","10001","10001","10001","10001","10001","01110"],V:["10001","10001","10001","10001","10001","01010","00100"],W:["10001","10001","10001","10101","10101","11011","10001"],X:["10001","10001","01010","00100","01010","10001","10001"],Y:["10001","10001","01010","00100","00100","00100","00100"],Z:["11111","00001","00010","00100","01000","10000","11111"],"0":["01110","10001","10011","10101","11001","10001","01110"],"1":["00100","01100","00100","00100","00100","00100","01110"],"2":["01110","10001","00001","00010","00100","01000","11111"],"3":["11110","00001","00001","01110","00001","00001","11110"],"4":["00010","00110","01010","10010","11111","00010","00010"],"5":["11111","10000","10000","11110","00001","00001","11110"],"6":["01111","10000","10000","11110","10001","10001","01110"],"7":["11111","00001","00010","00100","01000","01000","01000"],"8":["01110","10001","10001","01110","10001","10001","01110"],"9":["01110","10001","10001","01111","00001","00001","11110"],"-":["00000","00000","00000","11111","00000","00000","00000"],".":["00000","00000","00000","00000","00000","00100","00100"]};
 function canvas(width,height,background=false){const pixels=new Uint8ClampedArray(width*height*4);if(background)for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixels.set(x%24===0||y%24===0?[27,39,49,255]:[18,27,35,255],(y*width+x)*4);return{width,height,pixels};}
 function text(c,label,x,y,scale=2){for(const letter of label.toUpperCase()){const rows=glyphs[letter];if(rows)for(let yy=0;yy<7;yy++)for(let xx=0;xx<5;xx++)if(rows[yy][xx]==="1")for(let sy=0;sy<scale;sy++)for(let sx=0;sx<scale;sx++)c.pixels.set([225,228,211,255],((y+yy*scale+sy)*c.width+x+xx*scale+sx)*4);x+=6*scale;}}
 function stamp(c,sprite,x,y,scale,crop={x:0,y:0,width:96,height:96}){for(let yy=0;yy<crop.height*scale;yy++)for(let xx=0;xx<crop.width*scale;xx++){const p=((Math.floor(yy/scale)+crop.y)*96+Math.floor(xx/scale)+crop.x)*4;if(sprite.pixels[p+3])c.pixels.set(sprite.pixels.subarray(p,p+4),((y+yy)*c.width+x+xx)*4);}}
 async function save(name,c){await writeFile(folder+"/"+name,encodePNG(c.width,c.height,c.pixels));}
 for(const[name,r]of [["v1",before],["v2",after]])for(const scale of [1,4]){const c=canvas(96*scale,96*scale);stamp(c,r,0,0,scale);await save("normal-"+name+"-"+(96*scale)+".png",c);}
 const comparison=canvas(824,440,true);text(comparison,"ORIGINAL V1",28,16);text(comparison,"PNG ART V2",440,16);stamp(comparison,before,20,46,4);stamp(comparison,after,424,46,4);await save("normal-comparison.png",comparison);
 const gallery=canvas(1252,880,true),presetStats=[];
 for(let n=0;n<6;n++){const preset=MORPH_PRESETS[n],r=renderSprite(specimenFromPreset(preset,seed)),x=20+n%3*414,y=20+Math.floor(n/3)*430;
  text(gallery,preset.english,x+12,y);stamp(gallery,r,x,y+30,4);await save(preset.id+"-96.png",{width:96,height:96,pixels:r.pixels});presetStats.push({id:preset.id,hash:hash(r.pixels),seed,appearance:preset.appearance});}
 await save("morph-gallery.png",gallery);
 // Compare actual committed v2.0.0 output with current output, same parameters.
 // Faces are cropped from renderer pixels and magnified by exact 8× replication.
 const baseline=JSON.parse(await readFile(folder+"/eye-fix/before.json","utf8"));
 const {createBaseSprite}=await import(pathToFileURL(join(temp,"art.js"))),base=createBaseSprite();
 const faceCrop={x:4,y:12,width:40,height:30},faceResults=[],faceGallery=canvas(688,292*6,true);
 await mkdir(folder+"/eye-fix/after",{recursive:true});
 for(let n=0;n<6;n++){
  const p=MORPH_PRESETS[n],old=decodePNG(await readFile(folder+"/eye-fix/before/"+p.id+".png")),current=renderSprite(specimenFromPreset(p,baseline.seed));
  const expected=baseline.presets.find(v=>v.id===p.id);
  if(hash(old.pixels)!==expected.hash||JSON.stringify(p.appearance)!==JSON.stringify(expected.appearance))throw new Error("Face comparison baseline/parameters changed");
  let changedSkin=0,changedEye=0,changedOutside=0;
  for(let i=0;i<9216;i++)if(old.pixels.subarray(i*4,i*4+4).some((v,j)=>v!==current.pixels[i*4+j])){
   if(base.eyeSurround[i])changedSkin++;else changedOutside++;if(base.eye[i])changedEye++;
  }
  const panel=canvas(688,292,true);
  for(const[c,offset]of [[panel,0],[faceGallery,n*292]]){
   text(c,p.english,20,offset+10);text(c,"BEFORE 2.0.0",20,offset+32);text(c,"AFTER "+current.version,360,offset+32);
   stamp(c,old,12,offset+52,8,faceCrop);stamp(c,current,356,offset+52,8,faceCrop);
  }
  await save("eye-fix/face-"+p.id+".png",panel);
  await save("eye-fix/after/"+p.id+".png",current);
  faceResults.push({id:p.id,beforeHash:hash(old.pixels),afterHash:hash(current.pixels),changedSkin,changedEye,changedOutside});
 }
 await save("eye-fix/face-comparison.png",faceGallery);
 await writeFile(folder+"/eye-fix/report.json",JSON.stringify({beforeVersion:baseline.version,baselineCommit:baseline.commit,afterVersion:after.version,seed:baseline.seed,crop:faceCrop,scale:8,
  eyePixels:base.eye.filter(Boolean).length,skinPixels:base.eyeSurround.filter(Boolean).length,presets:faceResults,
  provenance:"Before: preserved actual v2.0.0 outputs. After: actual current renderer, same preset/seed/fire. Faces are exact integer crops, not repainted art."},null,2)+"\n");
 const seedStats=[],normalSeedStats=[];
 for(const presetIndex of [0,3]){
  const diversity=canvas(850,670,true);
  for(let n=0;n<12;n++){const specimen=specimenFromPreset(MORPH_PRESETS[presetIndex],"art-diversity-"+n),r=renderSprite(specimen),x=16+n%4*210,y=16+Math.floor(n/4)*220;
   text(diversity,"SEED "+n,x+14,y);stamp(diversity,r,x,y+20,2);
   (presetIndex===0?normalSeedStats:seedStats).push({seed:specimen.seed,hash:hash(r.pixels),appearance:specimen.appearance});}
  await save(presetIndex===0?"normal-diversity-12.png":"diversity-12.png",diversity);
 }
 await writeFile(folder+"/render-report.json",JSON.stringify({reviewDate:"2026-10-14",beforeVersion:before.version,afterVersion:after.version,comparisonSeed:seed,beforeHash:hash(before.pixels),afterHash:hash(after.pixels),presets:presetStats,diversity:seedStats,
  normalDiversity:normalSeedStats,provenance:"All PNGs here are actual renderSprite/renderLegacySprite pixel output. Integer enlargements use exact pixel replication. Labels/grid only surround the outputs; no concept image pixels are used."},null,2)+"\n");
 console.log({before:before.version,after:after.version,presets:new Set(presetStats.map(p=>p.hash)).size,diversity:new Set(seedStats.map(p=>p.hash)).size});
}finally{await rm(temp,{recursive:true,force:true});}
