import { createBaseSprite, PART, artColor } from '@/engine/art';
import { PIXEL_COUNT } from '@/engine/model';
import { line } from '@/engine/raster';
import { unit } from './phenotype';

const base = createBaseSprite();
export const sourceBase = base;
const luminance = (i: number) => { const c = artColor(base.details[i]); return c[0] * .30 + c[1] * .59 + c[2] * .11; };
const tailSpine = [[78,40],[86,46],[90,54],[89,64],[85,73],[78,78],[66,80],[57,77],[55,72],[59,68]] as const;
const lengths = tailSpine.slice(1).map((p,n) => Math.hypot(p[0]-tailSpine[n][0],p[1]-tailSpine[n][1]));
const tailLength = lengths.reduce((a,b)=>a+b,0);

/** Annotate the existing pose only. No PNG edits or new silhouette. The old face
 * mask combined skin with structure; these small masks protect structure alone. */
function buildAnatomy() {
  const mouth = new Uint8Array(PIXEL_COUNT), nostrils = new Uint8Array(PIXEL_COUNT);
  for (const [a,b] of [ [[5,34],[11,35]], [[11,35],[26,35]], [[26,35],[33,33]] ] as const) line(mouth,a,b);
  for (const [x,y] of [[8,32],[9,32]] as const) nostrils[y*96+x]=255;
  for (let i=0;i<PIXEL_COUNT;i++) {
    if (!base.silhouette[i] || base.parts[i]!==PART.head) mouth[i]=nostrils[i]=0;
    // Preserve the actual dark mouth stroke, not the adjacent pale lip skin.
    if(mouth[i]&&luminance(i)>155)mouth[i]=0;
  }
  const protectedPixels = Uint8Array.from(base.silhouette,(_,i)=>base.outline[i]||base.eye[i]||mouth[i]||nostrils[i]?255:0);
  const skin = Uint8Array.from(base.silhouette,(_,i)=>base.silhouette[i]&&!protectedPixels[i]?255:0);
  const dorsalDepth = new Float32Array(PIXEL_COUNT), tailProgress = new Float32Array(PIXEL_COUNT), light = new Float32Array(PIXEL_COUNT);
  for(let i=0;i<PIXEL_COUNT;i++) {
    if(!base.silhouette[i])continue;
    const x=i%96,y=Math.floor(i/96),part=base.parts[i];
    dorsalDepth[i]=unit((y-(28+(x-48)*.22))/12);
    if(part===PART.tail) {
      let best=Infinity,progress=0,travelled=0;
      for(let n=0;n<tailSpine.length-1;n++) {
        const a=tailSpine[n],b=tailSpine[n+1],dx=b[0]-a[0],dy=b[1]-a[1];
        const t=unit(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy));
        const distance=(x-a[0]-dx*t)**2+(y-a[1]-dy*t)**2;
        if(distance<best){best=distance;progress=(travelled+lengths[n]*t)/tailLength;}
        travelled+=lengths[n];
      }
      tailProgress[i]=progress;
    }
    // Remove broad pigment stains from the original Normal painting. Keep local
    // pixel-cluster texture plus anatomical illumination, rather than treating
    // every original dark pattern as a cast shadow on every new morph.
    let sum=0,count=0;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++) {
      const xx=x+dx,yy=y+dy,j=yy*96+xx;
      if(xx>=0&&xx<96&&yy>=0&&yy<96&&base.silhouette[j]&&base.parts[j]===part&&!base.eye[j]){sum+=luminance(j);count++;}
    }
    const residual=(luminance(i)-sum/Math.max(1,count))/255;
    const illumination=part===PART.body?.20-dorsalDepth[i]*.48:part===PART.head?.18-(y-16)*.014:
      part===PART.farLeg?-.27:part===PART.tail?-.03:((y%12)/12-.5)*-.22;
    light[i]=Math.max(-.48,Math.min(.36,residual*.90+illumination));
  }
  return {skin,protectedPixels,mouth,nostrils,dorsalDepth,tailProgress,light};
}
export const anatomy = buildAnatomy();
