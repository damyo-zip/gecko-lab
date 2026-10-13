import {ART_PALETTE,ART_ROWS} from "./art-data";
import {PIXEL_COUNT} from "./model";
const ALPHABET="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function decode(rows:readonly string[],binary=false):Uint8Array {
  if(rows.length!==96||rows.some(row=>row.length!==96))throw new Error("아트 자산은 96×96이어야 합니다.");
  const result=new Uint8Array(PIXEL_COUNT);for(let y=0;y<96;y++)for(let x=0;x<96;x++){
    const value=ALPHABET.indexOf(rows[y][x]);if(value<0)throw new Error("아트 팔레트 인덱스 오류");result[y*96+x]=binary?value*255:value;
  }return result;
}
export const PART={tail:1,farLeg:2,body:3,head:4,frontLeg:5,hindLeg:6} as const;
export interface BaseSprite {
  silhouette:Uint8Array;parts:Uint8Array;outline:Uint8Array;shadows:Uint8Array;highlights:Uint8Array;
  crest:Uint8Array;details:Uint8Array;face:Uint8Array;dorsalRegion:Uint8Array;flankRegion:Uint8Array;spotRegion:Uint8Array;
}
export function createBaseSprite():BaseSprite {
  const details=decode(ART_ROWS["normal-base"]),parts=decode(ART_ROWS.parts);
  return {details,parts,silhouette:Uint8Array.from(details,v=>v?255:0),outline:decode(ART_ROWS.outline,true),
    shadows:decode(ART_ROWS.shadow,true),highlights:decode(ART_ROWS.highlight,true),crest:decode(ART_ROWS.crest,true),
    face:decode(ART_ROWS.face,true),dorsalRegion:decode(ART_ROWS.dorsal,true),flankRegion:decode(ART_ROWS.flank,true),spotRegion:decode(ART_ROWS.spots,true)};
}
export const artColor=(index:number)=>ART_PALETTE[index];
