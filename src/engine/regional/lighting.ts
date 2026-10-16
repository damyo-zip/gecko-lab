import {PART,artColor} from '@/engine/art';
import {PIXEL_COUNT} from '@/engine/model';
import type {RGB,Point} from '@/engine/raster';
import {anatomy as A,sourceBase as B} from './anatomy';
import type {RegionalPhenotype} from './model';

const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));
export const luminance=(c:ArrayLike<number>)=>c[0]*.30+c[1]*.59+c[2]*.11;

/** Pose-space creases, NOT pigment boundaries. A hand annotation of this single
 * 96px pose, not a new morphology or a claim of inverse-rendering the painting.
 * All coordinates are clipped to skin; no line is drawn over eyes/mouth. */
export const FORM_CREASES:readonly (readonly Point[])[]=[
  [[22,37],[27,39],[32,41]], // lower jaw / throat
  [[29,27],[33,28],[37,28]], // behind eye / cheek
  [[39,30],[38,34],[37,38]], // neck fold
  [[45,42],[48,45],[50,49]], // front shoulder
  [[40,47],[43,49],[42,53]], // foreleg inside
  [[70,43],[68,46],[66,49],[66,52]], // hind hip
  [[74,49],[75,51],[75,53]], // hind leg inside
  [[53,48],[62,50],[68,49]], // belly / rear leg contact
];
function distance(x:number,y:number,a:Point,b:Point){
  const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy),0,1);
  return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);
}
/** Palette albedo families in normal-base.png. Brown pigment is NOT uniformly
 * labelled shadow. Removing each family's reference value retains the authored
 * pixel clusters within it without embossing all Normal stains onto white skin.
 * Update these references if the SOURCE PNG palette changes (lab only). */
const cream=new Set([13,16,18,19]),brown=new Set([8,9,11,12,15,17,22]),underside=new Set([20,21,23,24,25,26]);
function texture(i:number){
  const index=B.details[i],l=luminance(artColor(index));
  const reference=cream.has(index)?228:brown.has(index)?100:underside.has(index)?167:183;
  return clamp((l-reference)/100,-.42,.34);
}
function buildRelief(){
  const form=new Float32Array(PIXEL_COUNT),grain=new Float32Array(PIXEL_COUNT),crease=new Uint8Array(PIXEL_COUNT);
  for(let i=0;i<PIXEL_COUNT;i++){
    if(!A.skin[i])continue;
    const x=i%96,y=Math.floor(i/96),part=B.parts[i];let volume=0;
    if(part===PART.head){
      const dome=clamp((y-17)/20,0,1);
      volume=.30-dome*.48;
      if(y>=33)volume-=.12; // lip underside, independent of white nose coverage
    }else if(part===PART.body){
      const depth=clamp((y-(28+(x-48)*.22))/22,0,1);
      volume=.32-depth*.65;
    }else if(part===PART.tail){
      // Same spine/progress as the material engine; its transverse normal gives
      // the tail volume, unlike v1's constant illumination along the whole tail.
      volume=.13-clamp((A.tailNormalX[i]*.35+A.tailNormalY[i]) / 5,-1,1)*.30;
    }else if(part===PART.farLeg){volume=-.30;}
    else {
      const axis=part===PART.frontLeg?46-(y-45)*.55:74-(y-48)*.48;
      volume=.10-clamp((x-axis)/5,-1,1)*.26;
    }
    const nearest=Math.min(...FORM_CREASES.flatMap(path=>path.slice(1).map((b,n)=>distance(x,y,path[n],b))));
    // Pixel-stepped contact and a light-facing lip. No blur or alpha wash.
    // An annotation locates a fold, the authored dark pixels locate its exact
    // edge. Blindly painting every annotated path dark would invert pale lips
    // and invent creases on the wrong side of the original boundary.
    const authoredDepth=clamp((185-luminance(artColor(B.details[i])))/145,0,1);
    const contact=B.details[i]===1?-.42:nearest<1.5?-.38*authoredDepth:0;
    crease[i]=contact<-.15?255:0;
    form[i]=clamp(volume+contact,-.66,.48);
    grain[i]=texture(i);
  }
  return {form,grain,crease};
}
export const relief=buildRelief();

/** Material-aware, discrete value ramp. White gets cool/warm midtone shadows;
 * very dark skin gets reserved reflected highlights instead of mixing black
 * into nearly-black. Light is applied AFTER choosing pigment, once per layer.
 * Fire-down changes the material before lighting, so it cannot wash out folds. */
export function shadeRelief(material:RGB,i:number,p:RegionalPhenotype,fire:'up'|'down'='up'):RGB {
  const achromatic=p.expressed.axanthic;
  const c=fire==='down'?material.map((v,k)=>Math.round(v*.80+(achromatic?[191,196,201]:[221,208,183])[k]*.20)) as unknown as RGB:material;
  const l=luminance(c);
  const tone=clamp(Math.round((relief.form[i]+relief.grain[i]*(.48+p.contrast*.20))*10)/10,-.8,.7);
  // Adapt to the pigment's available value range, not a global contrast curve.
  // Leave headroom in chalk-white pigment; otherwise every lit pixel clips to
  // 255 and its texture disappears. A small bounce term exposes near-black form.
  const mid=l>220?l-16:l<55?l+9:l;
  const target=tone<0?mid*(1+tone*.88):mid+tone*(l<90?108:l>220?32:70);
  const delta=target-l;
  return c.map(v=>Math.round(clamp(tone<0?v*(target/Math.max(1,l)):v+delta,0,255))) as unknown as RGB;
}
