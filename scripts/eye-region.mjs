/** Semantic annotation of the existing PNG eye, not new animal geometry.
 * The globe includes iris/pupil/glints and its dark rim; lids are skin. */
import {readFile,writeFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {decodePNG,encodePNG} from "./png.mjs";
export const EYE_ANNOTATION={x:19,y:24,rows:[
 "000111000","011111110","111111111","111111111","111111111",
 "111111111","111111111","011111110","001111000",
]};
export function eyeRegions(silhouette){
 const eye=new Uint8Array(9216),surround=new Uint8Array(9216);
 EYE_ANNOTATION.rows.forEach((row,y)=>[...row].forEach((value,x)=>{
  if(value==="1"){const i=(y+EYE_ANNOTATION.y)*96+x+EYE_ANNOTATION.x;
   if(!silhouette[i])throw new Error("Eye annotation must remain inside the original PNG");eye[i]=255;}
 }));
 for(let y=0;y<96;y++)for(let x=0;x<96;x++){const i=y*96+x;
  // This was the overly broad fixed-color region in v2.0.0. Only its actual
  // globe now retains source colors; surrounding authored pixels use skin.
  if(silhouette[i]&&!eye[i]&&((x-25)/6.8)**2+((y-27)/6.5)**2<=1)surround[i]=255;
 }return {eye,surround};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root="public/art/gecko-v2/",base=decodePNG(await readFile(root+"normal-base.png"));
 const regions=eyeRegions(Uint8Array.from({length:9216},(_,i)=>base.pixels[i*4+3]));
 for(const[name,mask]of [["eye",regions.eye],["eye-surround",regions.surround]]){
  const pixels=new Uint8ClampedArray(9216*4);for(let i=0;i<9216;i++)if(mask[i])pixels.set([255,255,255,255],i*4);
  await writeFile(root+name+".png",encodePNG(96,96,pixels));
 }console.log({eye:regions.eye.filter(Boolean).length,skin:regions.surround.filter(Boolean).length});
}
