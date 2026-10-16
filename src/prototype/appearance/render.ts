import { PART, artColor } from '@/engine/art';
import { buildPatternPlan, isPatternCrest } from '@/engine/pattern-plan';
import { patternTraits } from '@/genetics/advanced/pattern-traits';
import { patternAnchors, patternScore } from '@/engine/patterns';
import { randomFor } from '@/engine/random';
import { mix, paint, type RGB } from '@/engine/raster';
import { LAYER_ORDER, PIXEL_COUNT, type SpriteLayer } from '@/engine/model';
import { compositeLayers } from '@/engine/render';
import { prototypePhenotype, unit } from './phenotype';
import { anatomy as A, sourceBase as B } from './anatomy';
import { PROTOTYPE_VERSION, type PrototypeInput, type PrototypeResult, type PrototypeMetrics } from './model';

const layer=(name:SpriteLayer['name']):SpriteLayer=>({name,mask:new Uint8Array(PIXEL_COUNT),pixels:new Uint8ClampedArray(PIXEL_COUNT*4)});
const put=(l:SpriteLayer,i:number,color:RGB)=>{l.mask[i]=255;paint(l.pixels,i,color);};
const lum=(c:ArrayLike<number>)=>c[0]*.30+c[1]*.59+c[2]*.11;
type Cluster={x:number;y:number;rx:number;ry:number};
function clusters(seed:string):Cluster[] {
  const rng=randomFor(seed,'prototype:regional-clusters');
  return [[15,19],[26,18],[35,24],[44,31],[53,34],[63,35],[73,38]].map(([x,y])=>
    ({x:x+(rng()-.5)*5,y:y+(rng()-.5)*4,rx:3+rng()*4,ry:2+rng()*3}));
}
const clusterScore=(x:number,y:number,cs:Cluster[])=>Math.min(...cs.map(c=>Math.hypot((x-c.x)/c.rx,(y-c.y)/c.ry)));

/** Entirely opt-in, pure lab renderer. It does not call gameplay naming, pricing,
 * challenges, storage, RNG counters, or mutate the shared legacy PatternPlan. */
export function renderAppearancePrototype(input:PrototypeInput):PrototypeResult {
  if(!input.seed||input.seed.length>128)throw new Error('외형 시드는 1~128자여야 합니다.');
  const p=prototypePhenotype(input.genome),s=p.scores,e=p.expressed,v=p.strength;
  const background=patternTraits({...input.genome,mendelian:{version:1,loci:{
    'lilly-white':['n','n'],axanthic:['A','A'],'cappuccino-complex':['n','n'],
  }}});
  const old=buildPatternPlan(background,input.seed),da=patternAnchors(input.seed,'dorsal'),fa=patternAnchors(input.seed,'flank'),cs=clusters(input.seed);
  const layers=LAYER_ORDER.map(layer),[silhouette,body,shadow,highlight,dorsal,flank,spots,details]=layers;
  const white=new Uint8Array(PIXEL_COUNT),dark=new Uint8Array(PIXEL_COUNT);
  const metrics:PrototypeMetrics={skinPixels:0,whitePixels:0,headWhite:0,headSkin:0,dorsalWhite:0,dorsalSkin:0,flankWhite:0,flankSkin:0,tailBaseWhite:0,tailTipDark:0,meanSkinLuminance:0};
  const fired=(c:RGB):RGB=>input.fire==='down'?mix(c,e.axanthic?[191,196,201]:[221,208,183],.20):c;
  const shade=(c:RGB,i:number):RGB=>{
    const light=A.light[i]*(.60+p.contrast*.55);
    return fired(light<0?mix(c,p.palette.ink,-light*.95):mix(c,e.axanthic?[255,255,255]:[255,250,231],light*.55));
  };
  for(let i=0;i<PIXEL_COUNT;i++) {
    if(!B.silhouette[i])continue;
    const x=i%96,y=Math.floor(i/96),part=B.parts[i],isHead=part===PART.head,isBody=part===PART.body,isTail=part===PART.tail,depth=A.dorsalDepth[i];
    put(silhouette,i,p.palette.ink);
    if(!A.skin[i]) {
      // Keep the real authored iris/pupil, nostrils and mouth line unchanged.
      put(details,i,B.outline[i]?p.palette.ink:artColor(B.details[i]));continue;
    }
    let kind=old.dorsal[i]||old.flank[i]?old.secondary[i]?2:1:0;
    if(old.pins[i]||isPatternCrest(i))kind=1;
    const dp=patternScore(x,y,da),fp=patternScore(x,y,fa),ds=dp.score,fs=fp.score;
    const field=unit(Math.min(ds/1.45,fs/1.40)*.78+.08*Math.sin(x*.38+y*.19));
    let material:RGB=p.palette.base,whiteMaterial=false,darkMaterial=kind===2;
    // Spatial melanin is separate from both the white coverage and light map.
    const melanin=p.melanin*unit(.38+field*.65);
    material=mix(material,p.palette.ink,melanin*(e.axanthic?.38:.16));
    if(kind===1)material=p.palette.cream;
    if(kind===2)material=p.palette.secondary;

    if(e.cappuccino) {
      // Variable fading/blending across the dorsal, rather than a pasted stamp.
      if(isBody&&depth<.78&&field>.28+v.cappuccino*.34){kind=0;material=mix(p.palette.base,p.palette.secondary,.18+v.cappuccino*.12);darkMaterial=false;}
      if(isTail) {
        const t=A.tailProgress[i],edge=(field-.4)*.045;
        if(t<.12+v.cappuccino*.20+edge){material=p.palette.white;whiteMaterial=true;darkMaterial=false;}
        if(t>.92-v.cappuccino*.20+edge){material=mix(p.palette.secondary,p.palette.ink,.45+v.cappuccino*.3);darkMaterial=true;whiteMaterial=false;}
      }
    }
    if(e.highway&&isBody) {
      // Two ridges grow toward the middle; the lower flank loses generic patches.
      const inward=Math.min(depth,1-depth),ripple=.86+.14*Math.sin(x*.53+field*4);
      const reach=(.055+v.highway*.52)*ripple;
      if(x>=44&&x<=79&&depth<.94&&inward<reach){material=p.palette.white;whiteMaterial=true;darkMaterial=false;}
      else if(depth>=.94 || field>.18+(1-v.highway)*.30){material=mix(p.palette.base,p.palette.secondary,.10);darkMaterial=false;}
    }
    if(e.sable) {
      const c=clusterScore(x,y,cs),frost=isPatternCrest(i)&&(isHead||isBody);
      if((isHead||isBody)&&(c<.30+v.sable*1.15||frost)){
        material=p.palette.white;whiteMaterial=true;darkMaterial=false;
      }else if(isBody&&kind===1){material=mix(p.palette.cream,p.palette.secondary,.10+v.sable*.20);}
    }
    if(e.lilly) {
      // Reach is inherited; the front snout is a late expansion region, not a
      // protected face rectangle. Same seed yields nested low→high white areas.
      let barrier=isHead?.28+unit((40-x)/36)*.43+unit((y-23)/18)*.15+field*.10:
        isTail?.10+field*.42:isBody?.06+field*.76:part===PART.farLeg?.18+field*.70:.13+field*.70;
      // Keep small seeded pigment islands on the torso even at maximal modifiers.
      // Extreme one-copy coverage is not a claim to reproduce the nonviable super.
      if(isBody&&dp.secondary&&ds<.60)barrier=1.02;
      const reach=isHead?v.lilly:isTail?.42+v.lilly*.57:.10+v.lilly*.89;
      if(barrier<reach){material=p.palette.white;whiteMaterial=true;darkMaterial=false;}
      else {material=kind===2?p.palette.secondary:p.palette.base;whiteMaterial=false;darkMaterial=kind===2;}
    }
    if(whiteMaterial)white[i]=255;
    if(darkMaterial)dark[i]=255;
    // Body/shadow/highlight keep independent masks. Pattern materials use their
    // own final layers, with the same local authored pixel texture underneath.
    put(body,i,shade(p.palette.base,i));
    if(A.light[i]<-.035)put(shadow,i,shade(p.palette.base,i));
    if(A.light[i]>.055)put(highlight,i,shade(p.palette.base,i));
    if(kind||whiteMaterial||darkMaterial||e.axanthic||e.cappuccino||e.highway||e.sable||e.lilly)
      put(isHead||(isBody&&depth<.75)?dorsal:flank,i,shade(material,i));
    if(old.spots[i]&&!e.lilly){put(spots,i,shade(p.palette.ink,i));dark[i]=255;white[i]=0;}
    metrics.skinPixels++;metrics.whitePixels+=Number(!!white[i]);
    if(isHead){metrics.headSkin++;metrics.headWhite+=Number(!!white[i]);}
    if(isBody){if(depth<.94){metrics.dorsalSkin++;metrics.dorsalWhite+=Number(!!white[i]);}else{metrics.flankSkin++;metrics.flankWhite+=Number(!!white[i]);}}
    if(isTail&&A.tailProgress[i]<.30)metrics.tailBaseWhite+=Number(!!white[i]);
    if(isTail&&A.tailProgress[i]>.70)metrics.tailTipDark+=Number(!!dark[i]);
  }
  const pixels=compositeLayers(layers);
  for(let i=0;i<PIXEL_COUNT;i++)if(A.skin[i])metrics.meanSkinLuminance+=lum(pixels.subarray(i*4,i*4+3));
  metrics.meanSkinLuminance/=metrics.skinPixels;
  return {sprite:{width:96,height:96,layers,pixels,version:PROTOTYPE_VERSION},phenotype:p,white,dark,metrics};
}
