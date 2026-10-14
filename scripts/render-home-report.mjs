/** Compose actual captures without repainting UI. Reference JPEG is only decoded, never edited. */
import {readFile,writeFile,readdir,copyFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import sharp from "sharp";
import {decodePNG,encodePNG} from "./png.mjs";
const folder="docs/reference-home",hash=b=>createHash("sha256").update(b).digest("hex");
const results=await readdir("test-results");
const run=results.find(n=>n.startsWith("reference-home-reference-h-")&&n.endsWith("-mobile-chromium"));
const empty=results.find(n=>n.startsWith("reference-home-empty-home-")&&n.endsWith("-mobile-chromium"));
if(!run||!empty)throw new Error("Run the reference-home mobile E2E first");
const source="test-results/"+run,baseline=JSON.parse(await readFile(folder+"/baseline.json","utf8"));
const state=JSON.parse(await readFile(source+"/home-capture-state.json","utf8"));
if(state.gameSha256!==baseline.fixtureSha256)throw new Error("Baseline and current capture game states differ");
for(const name of ["home-390x844.png","home-390-full.png","home-360x800.png","home-720x1280.png","home-safe-area-390.png","home-safe-area-360.png","home-two-columns.png"])await copyFile(source+"/"+name,folder+"/"+name);
await copyFile("test-results/"+empty+"/home-empty-360.png",folder+"/home-empty-360.png");
const referenceBytes=await readFile("references/gecko-home-exact.jpg");
const raw=await sharp(referenceBytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const reference={width:raw.info.width,height:raw.info.height,pixels:raw.data};
if(reference.width!==720||reference.height!==1280)throw new Error("Unexpected reference dimensions");
const currentBytes=await readFile(folder+"/home-720x1280.png"),current=decodePNG(currentBytes);
if(current.width!==720||current.height!==1280)throw new Error("Expected exact native-size browser capture");
const glyphs={
 A:["01110","10001","10001","11111","10001","10001","10001"],B:["11110","10001","10001","11110","10001","10001","11110"],
 C:["01111","10000","10000","10000","10000","10000","01111"],E:["11111","10000","10000","11110","10000","10000","11111"],
 F:["11111","10000","10000","11110","10000","10000","10000"],I:["11111","00100","00100","00100","00100","00100","11111"],
 L:["10000","10000","10000","10000","10000","10000","11111"],M:["10001","11011","10101","10001","10001","10001","10001"],
 N:["10001","11001","10101","10011","10001","10001","10001"],O:["01110","10001","10001","10001","10001","10001","01110"],
 P:["11110","10001","10001","11110","10000","10000","10000"],R:["11110","10001","10001","11110","10100","10010","10001"],
 T:["11111","00100","00100","00100","00100","00100","00100"]
};
function pair(left,right,leftLabel,rightLabel){
 const width=left.width+right.width+48,height=Math.max(left.height,right.height)+48,pixels=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<width*height;i++)pixels.set([10,18,27,255],i*4);
 for(const[im,x,label]of [[left,16,leftLabel],[right,left.width+32,rightLabel]]){
  let cursor=x;
  for(const ch of label){const rows=glyphs[ch];if(!rows)throw new Error("Unsupported label "+ch);for(let y=0;y<7;y++)for(let xx=0;xx<5;xx++)if(rows[y][xx]==="1")for(let sy=0;sy<2;sy++)for(let sx=0;sx<2;sx++)pixels.set([187,225,168,255],((10+y*2+sy)*width+cursor+xx*2+sx)*4);cursor+=12;}
 }
 for(const[im,x]of [[left,16],[right,left.width+32]])for(let y=0;y<im.height;y++)pixels.set(im.pixels.subarray(y*im.width*4,(y+1)*im.width*4),((y+32)*width+x)*4);
 return encodePNG(width,height,pixels);
}
await writeFile(folder+"/reference-comparison.png",pair(reference,current,"REFERENCE","IMPLEMENTATION"));
const beforeBytes=await readFile(folder+"/before-390.png"),afterBytes=await readFile(folder+"/home-390-full.png");
await writeFile(folder+"/before-after.png",pair(decodePNG(beforeBytes),decodePNG(afterBytes),"BEFORE","AFTER"));
const captures=[];
for(const file of ["home-390x844.png","home-360x800.png","home-720x1280.png","home-empty-360.png","home-safe-area-390.png","home-safe-area-360.png","home-two-columns.png"]){const b=await readFile(folder+"/"+file),p=decodePNG(b);captures.push({file,width:p.width,height:p.height,sha256:hash(b)});}
await writeFile(folder+"/report.json",JSON.stringify({referenceSha256:hash(referenceBytes),baselineCommit:baseline.commit,fixtureSha256:state.gameSha256,identicalBeforeAfterGameState:true,
 fixture:{seed:state.game.seed,count:Object.keys(state.game.individuals).length,money:state.game.money,food:state.game.food,capacity:state.game.capacity,date:state.game.lastDate,legacyNumericTraits:true,notPlayerDefaults:true},
 captures,referenceComparison:{scale:1,sourceWidth:720,sourceHeight:1280,screenshotWidth:720,screenshotHeight:1280,labelsOutsideImages:true},
 notes:["Actual mobile-touch Chromium screenshots of live IndexedDB-backed UI. No concept artwork used as a gecko or fake data panel.",
 "Reference JPEG decoded at native size; implementation PNG copied at native size; pixels are not rescaled, recolored or retouched.",
 "Native phone status bar is part of the supplied reference, not simulated inside the web game.",
 "Existing renderer 2.0.1 and game data determine actual geckos, IDs, morphs, resources and breeding state; terrarium background is a separately generated environment asset."],
 beforeSha256:hash(beforeBytes),afterFullSha256:hash(afterBytes)},null,2)+"\n");
console.log({captures:captures.length,identicalGameState:true,nativeComparison:"720×1280 at 1:1"});
