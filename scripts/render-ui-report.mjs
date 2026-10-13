/** Copy real mobile browser captures and place untouched before/after pixels
 * side by side. Never creates fake UI or samples the concept reference. */
import {readFile,writeFile,readdir,mkdir,copyFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {decodePNG,encodePNG} from "./png.mjs";
const folder="docs/ui-tone",hash=data=>createHash("sha256").update(data).digest("hex");
const result=(await readdir("test-results")).find(name=>name.startsWith("ui-tone-four-")&&name.endsWith("-mobile-chromium"));
if(!result)throw new Error("Run the UI tone mobile E2E before generating this report");
const source="test-results/"+result,states=JSON.parse(await readFile(source+"/ui-state.json","utf8")),before=JSON.parse(await readFile(folder+"/before/state-hashes.json","utf8"));
const stateHashes={base:hash(JSON.stringify(states.base)),incubator:hash(JSON.stringify(states.incubator))};
if(before.base!==stateHashes.base||before.incubator!==stateHashes.incubator)throw new Error("Before/after game states differ; do not claim identical-state comparison");
await mkdir(folder+"/after",{recursive:true});
for(const name of (await readdir(source)).filter(n=>n.startsWith("ui-")&&n.endsWith(".png")))await copyFile(source+"/"+name,folder+"/after/"+name);
const glyphs={B:["11110","10001","10001","11110","10001","10001","11110"],E:["11111","10000","10000","11110","10000","10000","11111"],F:["11111","10000","10000","11110","10000","10000","10000"],O:["01110","10001","10001","10001","10001","10001","01110"],R:["11110","10001","10001","11110","10100","10010","10001"],A:["01110","10001","10001","11111","10001","10001","10001"],T:["11111","00100","00100","00100","00100","00100","00100"]};
function label(pixels,width,text,x){for(const letter of text){for(let y=0;y<7;y++)for(let xx=0;xx<5;xx++)if(glyphs[letter][y][xx]==="1")for(let sy=0;sy<2;sy++)for(let sx=0;sx<2;sx++)pixels.set([206,233,196,255],((10+y*2+sy)*width+x+xx*2+sx)*4);x+=12;}}
const screens=[];
for(const name of ["collection","details","breeding","incubator"]){
 const oldBytes=await readFile(folder+"/before/ui-"+name+".png"),newBytes=await readFile(folder+"/after/ui-"+name+".png"),old=decodePNG(oldBytes),current=decodePNG(newBytes);
 if([old,current].some(p=>p.width!==360||p.height!==800))throw new Error("Expected untouched 360×800 CSS-pixel captures");
 const width=744,height=840,pixels=new Uint8ClampedArray(width*height*4);for(let i=0;i<width*height;i++)pixels.set([9,15,23,255],i*4);
 label(pixels,width,"BEFORE",12);label(pixels,width,"AFTER",384);
 for(const[image,x]of [[old,12],[current,384]])for(let y=0;y<800;y++)pixels.set(image.pixels.subarray(y*360*4,(y+1)*360*4),((y+32)*width+x)*4);
 await writeFile(folder+"/"+name+"-comparison.png",encodePNG(width,height,pixels));
 screens.push({name,beforePngSha256:hash(oldBytes),afterPngSha256:hash(newBytes),viewport:{width:360,height:800},comparison:{width,height,scale:1}});
}
await writeFile(folder+"/report.json",JSON.stringify({date:"2026-10-14",baselineCommit:before.commit,stateHashes,identicalGameStates:true,fixture:{seed:states.base.seed,initialMoney:states.base.rules.initialMoney,initialCapacity:states.base.rules.initialCapacity,fertilizationChance:states.base.rules.fertilizationChance,hatchChance:states.base.rules.hatchChance,collectionCount:Object.keys(states.base.individuals).length,incubatorEggs:Object.keys(states.incubator.eggs).length,dates:before.dates},screens,
 provenance:"Actual Chromium mobile-touch browser captures. Identical serialized base/incubator states; labels surround exact original 360×800 screenshot pixels. Reference used for tone only."},null,2)+"\n");
console.log({screens:screens.length,identicalGameStates:true,viewport:"360×800"});
