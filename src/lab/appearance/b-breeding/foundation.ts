import {B_ANATOMY as A} from './anatomy';

export const FOUNDATIONS=[
 {id:'current',label:'현재 방식',description:'원화의 크림 무늬를 바디에 포함'},
 {id:'weak',label:'약한 패턴 베이스',description:'같은 무늬의 색소 대비를 26%로 낮춤'},
 {id:'clean',label:'패턴리스 베이스',description:'등·측면 색소와 구조 명암을 분리'},
] as const;
export type FoundationId=typeof FOUNDATIONS[number]['id'];
export interface BStudyPass {foundation:FoundationId;normalPattern?:boolean;baseOnly?:boolean;independentPattern?:boolean}

/** This is a surface annotation for the B pose, not a genetic characteristic.
 * The PNG does not contain a true unpainted lighting pass. Reconstruct torso
 * volume from its geometry, preserve within-material pixel relief, and keep
 * authored attachment creases. Never blur/resample output or change the pose.
 * Head, crest, tail, toes and limbs are intentionally outside the removal mask. */
function build(){
 const mask=new Uint8Array(9216),tone=A.tone.slice(),creases=new Uint8Array(9216);
 for(let i=0;i<9216;i++){
  if(!A.body[i])continue;
  const x=i%96,y=Math.floor(i/96),l=A.pixels[i*4]*.3+A.pixels[i*4+1]*.59+A.pixels[i*4+2]*.11;
  const attachment=(x<38&&y<42)||(x>=34&&x<=43&&y>=42&&y<=49)||(x>=62&&x<=76&&y>=43&&y<=52);
  if(l<105&&(attachment||A.depth[i]>.90)){creases[i]=255;continue;}
  mask[i]=255;
  // Estimate high-frequency relief inside the SAME pigment. Comparing a pale
  // patch with a brown neighbour would mistake the pigment boundary for relief.
  let total=0,n=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const j=(y+dy)*96+x+dx;
   if(A.body[j]&&A.cream[j]===A.cream[i]){total+=A.tone[j];n++;}
  }
  const relief=Math.max(-1,Math.min(1,A.tone[i]-total/n));
  tone[i]=Math.max(0,Math.min(5,Math.round(4.2-A.depth[i]*3.1+relief*.65)));
 }
 return {mask,tone,creases};
}
export const B_FOUNDATION=build();
export const foundationAmount=(id:FoundationId)=>id==='current'?1:id==='weak'?.26:0;
