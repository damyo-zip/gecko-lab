import {BASE_ART} from '../base-study/art-data';
import {insidePolygon,type Point} from '@/engine/raster';
const art=BASE_ART.B;
const unit=(v:number)=>Math.max(0,Math.min(1,v));
const tailPath=[[74,42],[82,48],[88,59],[88,68],[79,79],[66,83],[55,80],[51,75],[52,71]] as const;
const length=tailPath.slice(1).map((p,n)=>Math.hypot(p[0]-tailPath[n][0],p[1]-tailPath[n][1]));
const total=length.reduce((a,b)=>a+b,0);
const tailPolygon:readonly Point[]=[[75,38],[89,47],[94,59],[94,75],[83,88],[63,89],[49,84],[47,75],[53,67],[59,75],[68,78],[77,74],[82,65],[81,55],[73,48]];
const bodyPolygon:readonly Point[]=[[29,29],[48,30],[70,36],[78,43],[71,51],[58,53],[40,47],[29,39]];
/** New pose annotations; never borrow the old sprite's regional masks. */
function build(){
 const pixels=new Uint8ClampedArray(36864),alpha=new Uint8Array(9216),skin=new Uint8Array(9216),eye=new Uint8Array(9216),structure=new Uint8Array(9216),outline=new Uint8Array(9216),head=new Uint8Array(9216),body=new Uint8Array(9216),limbs=new Uint8Array(9216),tail=new Uint8Array(9216),cream=new Uint8Array(9216),tone=new Uint8Array(9216),depth=new Float32Array(9216),progress=new Float32Array(9216);
 const index=(i:number)=>parseInt(art.rows[Math.floor(i/96)][i%96],36);
 for(let i=0;i<9216;i++)pixels.set(art.palette[index(i)],i*4);
 for(let i=0;i<9216;i++){
  const x=i%96,y=Math.floor(i/96),c=art.palette[index(i)],l=c[0]*.30+c[1]*.59+c[2]*.11;if(!c[3])continue;alpha[i]=255;
  eye[i]=((x-21)/3.5)**2+((y-25)/4.7)**2<=1?255:0;
  outline[i]=index(i)===1||[-96,-1,1,96].some(d=>!pixels[(i+d)*4+3])?255:0;
  const mouth=x>=7&&x<=31&&y>=30&&y<=34&&l<105,nostril=x>=7&&x<=10&&y>=26&&y<=29&&l<105;
  structure[i]=eye[i]||mouth||nostril?255:0;
  if(structure[i]||outline[i])continue;skin[i]=255;
  if(x<36&&y<36)head[i]=255;
  else if(insidePolygon(x,y,tailPolygon))tail[i]=255;
  else if(insidePolygon(x,y,bodyPolygon))body[i]=255;
  else limbs[i]=255;
  cream[i]=[2,3,4].includes(index(i))?255:0;
  // Separate material value from authored pigment: pale paint does not become
  // a highlight when replaced with body pigment. Six crisp tonal steps only.
  tone[i]=Math.round(unit(cream[i]?(l-169)/62:(l-48)/150)*5);
  depth[i]=unit((y-(28+(x-34)*.23))/16);
  if(tail[i]){
   let best=Infinity,travel=0;for(let n=0;n<tailPath.length-1;n++){
    const a=tailPath[n],b=tailPath[n+1],dx=b[0]-a[0],dy=b[1]-a[1],t=unit(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)),dist=(x-a[0]-dx*t)**2+(y-a[1]-dy*t)**2;
    if(dist<best){best=dist;progress[i]=(travel+length[n]*t)/total;}travel+=length[n];
   }
  }
 }
 return {pixels,alpha,skin,eye,structure,outline,head,body,limbs,tail,cream,tone,depth,progress};
}
export const B_ANATOMY=build();
