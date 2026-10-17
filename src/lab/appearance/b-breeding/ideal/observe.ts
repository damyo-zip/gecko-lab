import {B_ANATOMY as A} from '../anatomy';
import {idealProtected,type IdealResult} from './render';
/** Measurements of the actual final pixel/material output. Diagnostic only;
 * never used by inheritance, the renderer, prices or breeding challenges. */
export function observeIdeal(r:IdealResult){
 const white=new Uint8Array(9216),bright=new Uint8Array(9216),visited=new Uint8Array(9216),components:number[]=[];
 let whiteArea=0,brightArea=0,faceWhite=0,tailDark=0,brightLuma=0,skinLuma=0,skinCount=0;
 for(let i=0;i<9216;i++)if(!idealProtected(i)){
  const m=r.materials[i]||(A.cream[i]?(r.morph==='lilly'?3:2):1),L=r.pixels[i*4]*.30+r.pixels[i*4+1]*.59+r.pixels[i*4+2]*.11;
  if(m===3){white[i]=1;whiteArea++;if(A.head[i])faceWhite++;}
  if(m===2||m===3){bright[i]=1;brightArea++;brightLuma+=L;}else{skinLuma+=L;skinCount++;}
  if(m===4&&A.tail[i])tailDark++;
 }
 for(let i=0;i<9216;i++)if(bright[i]&&!visited[i]){
  const queue=[i];visited[i]=1;for(let n=0;n<queue.length;n++){const j=queue[n],x=j%96,y=Math.floor(j/96);
   for(const k of [x?j-1:-1,x<95?j+1:-1,y?j-96:-1,y<95?j+96:-1])if(k>=0&&bright[k]&&!visited[k]){visited[k]=1;queue.push(k);}
  }components.push(queue.length);
 }
 return {whiteArea,brightArea,faceWhite,tailDark,components:components.filter(n=>n>=3).length,largestFraction:Math.max(0,...components)/Math.max(1,brightArea),materialContrast:brightLuma/Math.max(1,brightArea)-skinLuma/Math.max(1,skinCount)};
}
