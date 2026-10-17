/** Read-only provenance check and pixel exports. Never regenerates or edits B. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {appearanceRuntime} from './appearance-runtime.mjs';
import {encodePNG,decodePNG} from './png.mjs';
const commit='c9cb231db4afacaffc52b6e9655d57bc9f5a6f26',folder='docs/b-original-review';
const files=['docs/base-study/source-sheet.png','public/lab/base-study/B-normal.png','src/lab/appearance/base-study/art-data.ts','src/lab/appearance/base-study/designs.ts','src/lab/appearance/base-study/render.ts','scripts/compile-base-study.mjs'];
const digest=b=>createHash('sha256').update(b).digest('hex');
await mkdir(folder,{recursive:true});
const provenance=[];
for(const path of files){const current=await readFile(path),initial=execFileSync('git',['show',commit+':'+path],{maxBuffer:16*1024*1024});assert(current.equals(initial),'Initial B file changed: '+path);provenance.push({path,sha256:digest(current),initialCommitBytesIdentical:true});}
await appearanceRuntime(async load=>{
 const {renderBase}=await load('lab/appearance/base-study/render');
 const {B_ANATOMY:B}=await load('lab/appearance/b-breeding/anatomy');
 const original=renderBase('B','normal'),png=await readFile('public/lab/base-study/B-normal.png'),decoded=decodePNG(png);
 assert.equal(decoded.width,96);assert.equal(decoded.height,96);assert.equal(digest(decoded.pixels),digest(original.pixels));
 const neutral=decodePNG(await readFile(folder+'/neutral-current-96.png')); // Archived paused result; never used as a new base.
 const current=encodePNG(96,96,neutral.pixels);await writeFile(folder+'/B-original-96.png',png);await writeFile(folder+'/neutral-current-96.png',current);
 const labels=['최초 B 원본 · 변경 없음','현재 실험 중립 바디 · 중단'];
 const text=(s,w)=>Buffer.from(`<svg width="${w}" height="38"><text x="10" y="25" fill="#dce9d5" font-family="sans-serif" font-size="16">${s}</text></svg>`);
 for(const scale of [1,4]){
  const size=96*scale,col=Math.max(260,size+24),width=col*2,height=size+64,overlays=[];
  for(const [n,b]of [png,current].entries()){overlays.push({input:text(labels[n],col),left:n*col,top:0},{input:await sharp(b).resize(size,size,{kernel:'nearest'}).png().toBuffer(),left:n*col+Math.floor((col-size)/2),top:45});}
  await sharp({create:{width,height,channels:4,background:'#0b1922'}}).composite(overlays).png().toFile(`${folder}/comparison-${scale}x.png`);
 }
 await sharp(png).resize(384,384,{kernel:'nearest'}).png().toFile(folder+'/B-original-4x.png');
 const regions=[{id:'face',label:'얼굴·눈',left:4,top:14,width:33,height:22},{id:'body',label:'등·측면',left:29,top:29,width:47,height:25},{id:'limbs',label:'사지·발',left:20,top:36,width:60,height:27},{id:'tail',label:'꼬리',left:49,top:41,width:43,height:39}];
 const overlays=[];for(const[n,r]of regions.entries()){const{left,top,width,height}=r;for(const[k,b]of [png,current].entries()){overlays.push({input:text(r.label+' · '+(k?'중립 바디':'원본 B'),264),left:k*264,top:n*200},{input:await sharp(b).extract({left,top,width,height}).resize(width*4,height*4,{kernel:'nearest'}).png().toBuffer(),left:k*264+12,top:n*200+38});}}
 await sharp({create:{width:528,height:800,channels:4,background:'#0b1922'}}).composite(overlays).png().toFile(folder+'/details-4x.png');
 const groups={head:B.head,body:B.body,limbs:B.limbs,tail:B.tail},statistics={};let alphaDifferences=0,changed=0,opaque=0;
 const different=i=>[0,1,2,3].some(k=>original.pixels[i*4+k]!==neutral.pixels[i*4+k]);
 for(let i=0;i<9216;i++){alphaDifferences+=Number(original.pixels[i*4+3]!==neutral.pixels[i*4+3]);if(B.alpha[i]){opaque++;changed+=Number(different(i));}}
 for(const[id,mask]of Object.entries(groups)){let total=0,changed=0;for(let i=0;i<9216;i++)if(mask[i]){total++;changed+=Number(different(i));}statistics[id]={annotatedSkinPixels:total,changedRGBA:changed};}
 const manifest=JSON.parse(await readFile('public/lab/base-study/manifest.json','utf8'));
 const evidence={originalVersion:'base-study-1',originalCommit:commit,provenance,original:manifest.sprites.find(s=>s.id==='B'),runtimeRGBAHash:digest(original.pixels),nativePNGMatchesRuntime:true,originalPixelCount:opaque,currentNeutralComparison:{input:{profile:'typical',morph:'normal',seed:'b-fragments-01'},rgbaHash:digest(neutral.pixels),alphaDifferences,changedRGBA:changed,statistics},notes:['The original is fixed authored artwork, not a genotype-generated Normal.','The current neutral is the actual paused fragment-study body, not a new replacement proposal.','Changed pixel counts describe repainting, not aesthetic or structural quality.']};
 await writeFile(folder+'/provenance.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
});
