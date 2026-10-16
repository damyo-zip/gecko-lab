import { createBaseSprite, PART } from "./art";
import { PIXEL_COUNT } from "./model";
import { patternAnchors, patternScore } from "./patterns";
import { randomFor } from "./random";
import { ellipse, line } from "./raster";
import type { LineObservation, PatternObservation, PatternTraits } from "@/phenotype/model";

const B=createBaseSprite();
/** The historical crest channel includes interior cream flecks. Only exterior
 * crest scales are structural protection in the new skin model; interior flecks
 * retain authored shading but must not impose the same pattern on every gecko. */
export const isPatternCrest=(i:number)=>!!B.crest[i]&&Math.floor(i/96)<39&&
  (B.parts[i]===PART.body||B.parts[i]===PART.head)&&(!B.silhouette[i-96]||!B.silhouette[i-192]);
export const patternSkinPixel=(i:number)=>i>=0&&i<PIXEL_COUNT&&!!B.silhouette[i]&&!B.outline[i]&&!B.face[i]&&!isPatternCrest(i);
const allowed=patternSkinPixel;
const limb=(i:number)=>[PART.frontLeg,PART.hindLeg,PART.farLeg].includes(B.parts[i] as 2|5|6);
export interface PatternPlan {
  dorsal:Uint8Array; flank:Uint8Array; secondary:Uint8Array; pins:Uint8Array; edges:Uint8Array; spots:Uint8Array;
  spotCenters:readonly {x:number;y:number;radius:number}[];
  observation:PatternObservation;
  /** Geometry intent, checked against final regional pixels before naming. */
  shapes:{drips:Uint8Array[];bars:Uint8Array[];wall:Uint8Array};
}
const cache=new Map<string,PatternPlan>();
export const patternCacheSize=()=>cache.size;

/** Oblique projection of two dorsal ridges + two lateral lines onto the existing
 * side-view PNG. The far flank is schematic, not a new anatomical art asset. */
function route(offset:number):readonly (readonly [number,number])[] {
  const points:(readonly [number,number])[]=[];
  for(let x=49;x<=74;x++){
    let y=28+Math.round((x-49)*.18)+offset;
    if(!allowed(y*96+x)&&allowed((y+1)*96+x))y++;
    points.push([x,y]);
  }
  return points;
}
export const PATTERN_ROUTES=[route(1),route(4),route(8),route(11)];
function drawPath(target:Uint8Array,points:readonly (readonly [number,number])[],strength:number,seed:string):LineObservation {
  const rng=randomFor(seed,"line-gaps"),bits=points.map(()=>rng()<Math.max(0,(strength-.25)/.68));
  let longestRun=0,run=0,gapCount=0,covered=0;
  for(let n=0;n<points.length;n++){
    const [x,y]=points[n];bits[n]=bits[n]&&allowed(y*96+x);
    if(bits[n]){covered++;run++;longestRun=Math.max(longestRun,run);target[y*96+x]=255;
      if(n&&bits[n-1])line(target,points[n-1],points[n]);
    }else{if(!n||bits[n-1])gapCount++;run=0;}
  }
  return {coverage:covered/points.length,longestRun,gapCount,length:points.length};
}
const fraction=(mask:Uint8Array,region:Uint8Array)=>{
  let n=0,d=0;for(let i=0;i<PIXEL_COUNT;i++)if(region[i]&&allowed(i)){d++;if(mask[i])n++;}return d?n/d:0;
};
const limbRegion=Uint8Array.from(B.parts,(_,i)=>limb(i)?255:0);
const torsoRegion=Uint8Array.from(B.parts,(_,i)=>B.parts[i]===PART.body?255:0);

/** Single anatomical plan supplies both rendering and classification. Domain-separated
 * RNG never reads game turn, sex, hidden alleles or the assigned name. Bounded LRU. */
export function buildPatternPlan(t:PatternTraits,seed:string):PatternPlan {
  const key=seed+"|"+JSON.stringify(t);const prior=cache.get(key);
  if(prior){cache.delete(key);cache.set(key,prior);return prior;}
  const dorsal=new Uint8Array(PIXEL_COUNT),flank=new Uint8Array(PIXEL_COUNT),secondary=new Uint8Array(PIXEL_COUNT),pins=new Uint8Array(PIXEL_COUNT),edges=new Uint8Array(PIXEL_COUNT),spots=new Uint8Array(PIXEL_COUNT),wall=new Uint8Array(PIXEL_COUNT);
  const da=patternAnchors(seed,"dorsal"),fa=patternAnchors(seed,"flank"),striped=t.tiger>.34,broken=t.brindle>.88;
  for(let y=0;y<96;y++)for(let x=0;x<96;x++){
    const i=y*96+x;if(!allowed(i))continue;
    if(B.dorsalRegion[i]&&!striped&&patternScore(x,y,da).score<t.dorsal*.96)dorsal[i]=255;
    if(B.flankRegion[i]&&!striped){
      const p=patternScore(x,y,fa),coverage=limb(i)?t.limbs:t.flank;
      if(p.score<coverage*(.85+t.complexity*.3)){
        flank[i]=255;if(p.secondary&&t.contrast>.58)secondary[i]=255;
      }
    }
  }
  const rng=randomFor(seed,"patterns-v1:shape"),barPixels:number[]=[],barMasks:Uint8Array[]=[],dripMasks:Uint8Array[]=[];
  if(striped)for(let n=0;n<6;n++){
    const cx=39+n*7+Math.floor(rng()*2),mask=new Uint8Array(PIXEL_COUNT),bend=(rng()-.5)*2;
    for(let y=20;y<49;y++){
      const x=Math.round(cx+(y-30)*.25+bend+(broken?Math.sin(y*.8+n)*2:0));
      if(broken&&y%6===n%6)continue;
      for(let w=0;w<2;w++){const i=y*96+x+w;if(allowed(i)&&[PART.body,PART.head,PART.hindLeg].includes(B.parts[i] as 3|4|6)){mask[i]=255;dorsal[i]=255;secondary[i]=255;}}
    }
    barPixels.push(mask.filter(Boolean).length);barMasks.push(mask);
  }
  let drips=0;
  if(t.drippy>.30)for(let n=0;n<5;n++){
    const x=49+n*5+Math.floor(rng()*2),root=PATTERN_ROUTES[1][Math.min(25,x-49)]?.[1]??31,length=Math.round(2+t.drippy*12),mask=new Uint8Array(PIXEL_COUNT);
    for(let y=root;y<=root+length;y++)for(let w=0;w<(y<root+length-1?2:1);w++){
      const i=y*96+x+w;if(allowed(i)){mask[i]=255;flank[i]=255;secondary[i]=0;
        if(y>root+3)for(const xx of [x-1,x+2])if(allowed(y*96+xx))edges[y*96+xx]=255;}
    }
    if(mask.filter(Boolean).length>=8){drips++;dripMasks.push(mask);}
  }
  if(t.wall>.32)for(let x=49;x<=74;x++){
    const y=PATTERN_ROUTES[2][x-49][1],height=Math.round(t.wall*11);
    for(let yy=y;yy<y+height;yy++){const i=yy*96+x;if(allowed(i)){wall[i]=255;flank[i]=255;secondary[i]=0;}}
  }
  const pin=[drawPath(pins,PATTERN_ROUTES[0],t.pin[0],seed+"|pin-left"),drawPath(pins,PATTERN_ROUTES[1],t.pin[1],seed+"|pin-right")] as const;
  const side=[drawPath(pins,PATTERN_ROUTES[2],t.side[0],seed+"|side-left"),drawPath(pins,PATTERN_ROUTES[3],t.side[1],seed+"|side-right")] as const;
  for(let i=0;i<PIXEL_COUNT;i++)if(pins[i])for(const n of [i-96,i+96])if(allowed(n)&&!pins[n])edges[n]=255;
  for(let i=0;i<PIXEL_COUNT;i++){
    if(!allowed(i)){dorsal[i]=flank[i]=pins[i]=secondary[i]=edges[i]=0;continue;}
    if(pins[i]){if(B.dorsalRegion[i])dorsal[i]=255;else flank[i]=255;secondary[i]=0;}
  }
  const spotRng=randomFor(seed,"patterns-v1:spots"),centers:{x:number;y:number;radius:number}[]=[];
  for(let tries=0;tries<20000&&centers.length<t.spots.count;tries++){
    const x=4+Math.floor(spotRng()*88),y=10+Math.floor(spotRng()*78),i=y*96+x,radius=spotRng()<.8?.6:1+t.spots.size*.6;
    if(!B.spotRegion[i]||!allowed(i)||pins[i]||[i-1,i+1,i-96,i+96].some(n=>!B.spotRegion[n]||pins[n]))continue;
    if(centers.some(p=>(p.x-x)**2+(p.y-y)**2<(p.radius+radius+.7)**2))continue;
    centers.push({x,y,radius});ellipse(spots,x,y,radius,radius);
  }
  let eligible=0,creamN=0,secondaryN=0,spotN=0;
  for(let i=0;i<PIXEL_COUNT;i++){
    if(!allowed(i)){spots[i]=0;continue;}
    if(!B.spotRegion[i]||pins[i])spots[i]=0;
    eligible++;if(spots[i])spotN++;else if(secondary[i]&&!edges[i])secondaryN++;else if((dorsal[i]||flank[i])&&!edges[i])creamN++;
  }
  // Spot count measures actual separated marks, never the requested density alone.
  const plan:PatternPlan={dorsal,flank,secondary,pins,edges,spots,spotCenters:centers,shapes:{drips:dripMasks,bars:barMasks,wall},
    observation:{dorsal:fraction(dorsal,B.dorsalRegion),flank:fraction(flank,torsoRegion),limbs:fraction(flank,limbRegion),
      baseArea:1-(creamN+secondaryN+spotN)/eligible,creamArea:creamN/eligible,secondaryArea:secondaryN/eligible,
      pin,side,drips,wall:fraction(wall,torsoRegion),bars:barPixels.filter(n=>n>=8).length,brokenBars:broken,spots:centers.length}};
  cache.set(key,plan);if(cache.size>32)cache.delete(cache.keys().next().value!);return plan;
}
