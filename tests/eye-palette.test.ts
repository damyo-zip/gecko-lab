import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {expect,test} from "vitest";
import {decodePNG} from "../scripts/png.mjs";
import {createBaseSprite} from "@/engine/art";
import {renderSprite} from "@/engine/render";
import {MORPH_PRESETS,specimenFromPreset} from "@/engine/presets";
const base=createBaseSprite(),source=decodePNG(readFileSync("public/art/gecko-v2/normal-base.png"));
const rgba=(p:Uint8ClampedArray,i:number)=>Array.from(p.subarray(i*4,i*4+4));
const selected=(pixels:Uint8ClampedArray,mask:Uint8Array)=>Buffer.from(Array.from(mask).flatMap((v,i)=>v?rgba(pixels,i):[]));
const hash=(p:Uint8Array|Uint8ClampedArray)=>createHash("sha256").update(p).digest("hex");
const luminance=(rgb:number[])=>rgb[0]*.3+rgb[1]*.59+rgb[2]*.11;

test("only the previously frozen eye-surround changes; every iris/pupil and all other pixels retain original output",()=>{
 expect(base.eye.filter(Boolean)).toHaveLength(66);expect(base.eyeSurround.filter(Boolean)).toHaveLength(75);
 for(let i=0;i<9216;i++)if(base.eye[i]||base.eyeSurround[i]){
  expect(base.face[i]).toBe(255);expect(base.silhouette[i]).toBe(255);expect(base.outline[i]).toBe(0);
  expect(!!base.eye[i]&&!!base.eyeSurround[i]).toBe(false);
 }
 const outside=Uint8Array.from(base.eyeSurround,v=>v?0:255);
 for(const p of MORPH_PRESETS){const old=decodePNG(readFileSync("docs/phase6/eye-fix/before/"+p.id+".png")),after=renderSprite(specimenFromPreset(p,"phase6-comparison"));
  expect(hash(selected(after.pixels,base.eye))).toBe(hash(selected(old.pixels,base.eye)));
  expect(hash(selected(after.pixels,base.eye))).toBe(hash(selected(source.pixels,base.eye)));
  expect(hash(selected(after.pixels,outside))).toBe(hash(selected(old.pixels,outside)));
  expect(hash(selected(after.pixels,base.eyeSurround))).not.toBe(hash(selected(old.pixels,base.eyeSurround)));
 }
});
test("six face palettes differ, Lilly skin is cream, Ax skin is gray, and authored tonal depth remains",()=>{
 const images=MORPH_PRESETS.map(p=>renderSprite(specimenFromPreset(p,"phase6-comparison")).pixels);
 expect(new Set(images.map(p=>hash(selected(p,base.eyeSurround)))).size).toBe(6);
 const skin=Array.from(base.eyeSurround).flatMap((v,i)=>v?[i]:[]);
 for(const image of images){
  expect(new Set(skin.map(i=>rgba(image,i).join(","))).size).toBeGreaterThan(8);
  // Distinct authored highlights stay lighter than authored shadows, rather
  // than flattening the region into one painted skin color.
  for(const a of skin)for(const b of skin)if(luminance(rgba(source.pixels,a))-luminance(rgba(source.pixels,b))>15)
   expect(luminance(rgba(image,a))).toBeGreaterThan(luminance(rgba(image,b)));
 }
 const mean=(image:Uint8ClampedArray)=>skin.reduce((sum,i)=>sum+luminance(rgba(image,i)),0)/skin.length;
 expect(mean(images[1])).toBeGreaterThan(mean(images[0]));
 for(const i of skin){const [r,g,b]=rgba(images[1],i);expect(r).toBeGreaterThanOrEqual(g);expect(g).toBeGreaterThanOrEqual(b);
  const gray=rgba(images[2],i).slice(0,3);expect(Math.max(...gray)-Math.min(...gray)).toBeLessThanOrEqual(20);}
});
test("individual color/cream/fire inputs change skin reproducibly while the shared eye and masks remain fixed",()=>{
 const g=specimenFromPreset(MORPH_PRESETS[4],"eye-expression"),before=JSON.stringify(g);
 const expression={red:0,orange:.5,brightness:.5,cream:0,harlequin:.5,pinstripe:.5,contrast:.5};
 const variants=[g,{...g,state:{fire:"down" as const}},
  {...g,appearance:{...g.appearance,expression}},
  {...g,appearance:{...g.appearance,expression:{...expression,red:1,cream:1}}}];
 const results=variants.map(v=>renderSprite(v));
 expect(new Set(results.map(r=>hash(selected(r.pixels,base.eyeSurround)))).size).toBe(4);
 for(let n=0;n<results.length;n++){
  expect(hash(selected(results[n].pixels,base.eye))).toBe(hash(selected(source.pixels,base.eye)));
  expect(hash(results[n].pixels)).toBe(hash(renderSprite(JSON.parse(JSON.stringify(variants[n]))).pixels));
  expect(results[n].layers.map(l=>hash(l.mask))).toEqual(results[0].layers.map(l=>hash(l.mask)));
 }expect(JSON.stringify(g)).toBe(before);
});
