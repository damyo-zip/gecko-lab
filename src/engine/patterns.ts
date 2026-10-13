import {randomFor} from "./random";
/** Deliberately designed 9×13 motif clusters. No per-pixel random noise. */
const MOTIFS=[
  ["000110000","001111000","011111100","011111000","001111100","001111110","000111110","001111100","001111000","000111000","000110000","001100000","001000000"],
  ["000011000","000111100","001111100","001111000","011111000","011111100","001111110","000111110","000111100","000011100","000011000","000110000","000100000"],
  ["000100000","001110000","001111000","011111100","001111110","000111100","001111100","011111000","001111000","000111000","001110000","001100000","000100000"],
] as const;
export interface PatternAnchor {x:number;y:number;sx:number;sy:number;slope:number;motif:number;secondary:boolean}
/** Stable anchors independent of coverage, palette and fire. */
export function patternAnchors(seed:string,channel:"dorsal"|"flank"):PatternAnchor[] {
  const rng=randomFor(seed,"art-v2:"+channel);
  const sites=channel==="dorsal"?
    [[16,18,10,9],[30,19,10,10],[46,30,10,9],[59,33,12,9],[72,37,11,9],[86,47,8,10],[88,62,7,10],[79,79,10,8],[59,79,9,7]]:
    [[39,35,7,12],[49,42,8,14],[60,45,9,13],[71,48,9,12],[41,52,6,8],[32,60,7,7],[71,55,7,10],[67,60,8,7],[88,68,6,9],[76,80,9,6],[54,76,7,7]];
  return sites.map((p,index)=>({x:p[0]+(rng()-.5)*6,y:p[1]+(rng()-.5)*5,sx:p[2]*(.75+rng()*.5),sy:p[3]*(.8+rng()*.4),
    slope:(rng()-.5)*.75,motif:Math.floor(rng()*MOTIFS.length),secondary:index%3===0}));
}
/** Superset growth around one authored motif core; the seed never moves when
 * coverage changes. Body-region PNGs clip all coordinates before compositing. */
export function patternScore(x:number,y:number,anchors:readonly PatternAnchor[]):{score:number;secondary:boolean} {
  let score=Infinity,secondary=false;
  for(const a of anchors){const u=(x-a.x-(y-a.y)*a.slope)/a.sx,v=(y-a.y)/a.sy;
    const mx=Math.round(u*4+4),my=Math.round(v*6+6),motif=MOTIFS[a.motif];
    const distance=Math.max(Math.abs(u)*.85,Math.abs(v)*.7);
    const authored=mx>=0&&mx<9&&my>=0&&my<13&&motif[my][mx]==="1";
    const candidate=distance+(authored?0:.28);if(candidate<score){score=candidate;secondary=a.secondary;}
  }return {score,secondary};
}
