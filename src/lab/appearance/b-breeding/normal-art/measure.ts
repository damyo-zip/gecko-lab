import {renderNormalArt} from './render';
import {insidePolygon} from '@/engine/raster';
import {B_ANATOMY as A} from '../anatomy';
const dorsal=[[35,28],[49,30],[69,35],[80,42],[77,45],[67,40],[50,36],[36,35]] as const;
/** Descriptive pixel observations, NOT a genetic score, price or art-quality
 * grade. Count visible 4-connected cream components (>=3px); protected anatomy
 * may split a drawn contour. Face/crest cream is excluded from all eight. */
export function measureNormalArt(id:string){
 const r=renderNormalArt(id),visited=new Uint8Array(9216),sizes:number[]=[];
 let area=0,domain=0,edge=0,back=0,flank=0,tail=0,limbs=0;
 for(let i=0;i<9216;i++){
  if(r.editable[i])domain++;if(!r.mask[i])continue;area++;
  const x=i%96,y=Math.floor(i/96);
  if(A.tail[i])tail++;
  else if(insidePolygon(x,y,dorsal))back++;
  else if(A.body[i])flank++;else limbs++;
  const neighbours=[x>0?i-1:-1,x<95?i+1:-1,y>0?i-96:-1,y<95?i+96:-1];
  edge+=neighbours.filter(j=>j<0||!r.mask[j]).length;
  if(visited[i])continue;const queue=[i];visited[i]=1;let size=0;
  for(let n=0;n<queue.length;n++){const j=queue[n];size++;const xx=j%96,yy=Math.floor(j/96);
   for(const k of [xx>0?j-1:-1,xx<95?j+1:-1,yy>0?j-96:-1,yy<95?j+96:-1])if(k>=0&&r.mask[k]&&!visited[k]){visited[k]=1;queue.push(k);}
  }sizes.push(size);
 }
 sizes.sort((a,b)=>b-a);
 return {area,domain,coverage:area/domain,back,flank,tail,limbs,components:sizes.filter(n=>n>=3).length,largest:sizes[0]??0,largestFraction:(sizes[0]??0)/Math.max(1,area),boundary:edge/Math.sqrt(Math.max(1,area)),sizes};
}
