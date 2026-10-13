/** Asset preparation only: generated ORIGINAL art -> logical pixel palette and
 * independently annotated region/mask PNGs. Never samples the reference image. */
import {readFile,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {decodePNG,encodePNG} from "./png.mjs";
import {eyeRegions,EYE_ANNOTATION} from "./eye-region.mjs";
const root="public/art/gecko-v2/",sourceBytes=await readFile(root+"source-art.png"),source=decodePNG(sourceBytes);
const palette=["000000","38221c","593126","78402c","955033","b56436","cb7438","df8a3d","efa34c","f9b65d","ffca77","ffd98f","ffe5ad","fff0c9","ad7460","c99778","deb994","edd0aa","fbe0b8","28191a","704127","a05c25","c9802e","eda94c","ffe1a3","fff8de","83584d","b48875"]
 .map(hex=>[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)));
let left=source.width,top=source.height,right=0,bottom=0;
for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(source.pixels[(y*source.width+x)*4+3]>=128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
const factor=Math.min(88/(right-left+1),82/(bottom-top+1)),w=Math.round((right-left+1)*factor),h=Math.round((bottom-top+1)*factor),ox=Math.floor((96-w)/2),oy=Math.floor((96-h)/2);
const pixels=new Uint8ClampedArray(96*96*4),indices=new Uint8Array(96*96);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const sx=Math.min(right,left+Math.floor((x+.5)/factor)),sy=Math.min(bottom,top+Math.floor((y+.5)/factor)),s=(sy*source.width+sx)*4;
 if(source.pixels[s+3]<128)continue;
 const rgb=source.pixels.subarray(s,s+3);let best=1,distance=Infinity;
 for(let n=1;n<palette.length;n++){const p=palette[n],d=(rgb[0]-p[0])**2*.3+(rgb[1]-p[1])**2*.55+(rgb[2]-p[2])**2*.15;if(d<distance){distance=d;best=n;}}
 const i=(y+oy)*96+x+ox;indices[i]=best;pixels.set([...palette[best],255],i*4);
}
await writeFile(root+"normal-base.png",encodePNG(96,96,pixels));
function inside(x,y,points){let value=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
 const[a,b]=points[i],[c,d]=points[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)value=!value;}return value;}
// Semantic annotations follow the NEW art and intersect its existing pixels.
// These polygons label anatomy; none of them generate the animal silhouette.
const regions=[
 {id:1,points:[[65,34],[82,40],[94,53],[94,87],[44,93],[43,71],[61,65],[65,75],[76,68],[83,54]]},
 {id:2,points:[[17,40],[36,40],[36,55],[16,57]]},
 {id:4,points:[[3,7],[43,7],[45,31],[39,41],[3,40]]},
 {id:5,points:[[36,38],[52,40],[52,53],[43,66],[28,67],[27,54],[34,49]]},
 {id:6,points:[[64,41],[83,43],[84,53],[79,58],[80,66],[57,67],[56,54],[65,49]]},
];
const parts=new Uint8Array(9216),outline=new Uint8Array(9216),shadow=new Uint8Array(9216),highlight=new Uint8Array(9216),crest=new Uint8Array(9216),face=new Uint8Array(9216),dorsal=new Uint8Array(9216),flank=new Uint8Array(9216),spots=new Uint8Array(9216);
for(let y=0;y<96;y++)for(let x=0;x<96;x++){const i=y*96+x;if(!indices[i])continue;parts[i]=3;for(const r of regions)if(inside(x+.5,y+.5,r.points))parts[i]=r.id;
 outline[i]=[i-1,i+1,i-96,i+96].some(j=>j<0||j>=9216||!indices[j])?255:0;
 const [r,g,b]=palette[indices[i]],lum=r*.3+g*.59+b*.11;
 const eye=((x-25)/6.8)**2+((y-27)/6.5)**2<=1;
 const mouth=parts[i]===4&&y>=30&&y<=37&&x<=34&&((r<150&&g<95)||(x<12&&y<34));
 if(eye||mouth)face[i]=255;
 const nearTop=parts[i]===4?y<23:parts[i]===3?y<44:parts[i]===1?outline[i]>0:false;
 if(lum>178&&nearTop&&g>r*.65)crest[i]=255;
 if(!outline[i]&&!face[i]&&!crest[i]){if(lum<150)shadow[i]=255;else if(lum>182)highlight[i]=255;}
 if(!outline[i]&&!face[i]&&!crest[i]){
  dorsal[i]=[1,3,4].includes(parts[i])?255:0;flank[i]=parts[i]!==2?255:0;
  // The original eye-test rectangle also stays protected for the v1 API.
  spots[i]=parts[i]!==2&&!(x>=17&&x<=33&&y>=19&&y<=36)&&!(parts[i]===4&&y>30)?255:0;
 }
}
const eye=eyeRegions(indices);
const channels={parts,outline,shadow,highlight,crest,face,eye:eye.eye,"eye-surround":eye.surround,dorsal,flank,spots};
const zoneColors=[[0,0,0],[220,110,180],[90,100,190],[70,175,100],[235,160,65],[70,180,215],[200,80,75]];
for(const[name,mask]of Object.entries(channels)){
 const rgba=new Uint8ClampedArray(9216*4);for(let i=0;i<9216;i++)if(mask[i])rgba.set(name==="parts"?[...zoneColors[mask[i]],255]:[255,255,255,255],i*4);
 await writeFile(root+name+".png",encodePNG(96,96,rgba));
}
const metadata={version:2,logicalSize:96,created:"2026-10-14",source:"Original image generated with image_gen from a descriptive prompt and concept guidance; not cropped from reference or derived from v1 polygons.",
 sourceFile:"source-art.png",sourceSha256:createHash("sha256").update(sourceBytes).digest("hex"),palette:palette.slice(1),zoneColors,
 preparation:{alphaThreshold:128,nearestNeighbor:true,bounds:{left,top,right,bottom},fit:{width:w,height:h,offsetX:ox,offsetY:oy},paletteSize:palette.length-1},
 caveat:"Generated source is not native 96px. Logical pixel sampling, explicit palette and body annotations are separate asset preparation steps; not a claim of hand-painted professional art.",
 eyeAnnotation:EYE_ANNOTATION,
 channels:["normal-base.png",...Object.keys(channels).map(n=>n+".png")]};
await writeFile(root+"manifest.json",JSON.stringify(metadata,null,2)+"\n");
console.log({source:[source.width,source.height],logical:[96,96],opaque:indices.filter(Boolean).length,palette:palette.length-1,parts:Object.fromEntries(zoneColors.slice(1).map((_,n)=>[n+1,parts.filter(v=>v===n+1).length]))});
