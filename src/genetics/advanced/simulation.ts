import { seededRandom } from "../random";
import { inherit } from "./inheritance";
import { pairKey, LOCI } from "./loci";
import { diversity, founderPoly, inheritPoly, polyScores } from "./polygenic";
import type { Feature, MendelianGenome, PolyGenome } from "./model";

export function simulateCross(father:MendelianGenome,mother:MendelianGenome,seed:string,count=100_000) {
  if(!Number.isSafeInteger(count)||count<1||count>1_000_000)throw new Error("시뮬레이션 횟수 오류");
  const counts:Record<string,number>={};for(let i=0;i<count;i++){const g=inherit(father,mother,seed+"|"+i);
    const key=LOCI.map(l=>l.id+":"+pairKey(g.loci[l.id],l)).join(";");counts[key]=(counts[key]??0)+1;
  }return {seed,count,counts};
}
/** Population breeding experiment; independent random mate choice vs phenotypic selection.
 * This utility models allele selection, NOT permission to perform related matings in the game.
 */
export function selectionExperiment(seed:string,feature:Feature,generations=20,size=100,selected=true) {
  let population=Array.from({length:size},(_,i)=>founderPoly(seed+"|founder:"+i));
  const history:{generation:number;mean:number;diversity:number}[]=[];
  for(let generation=0;generation<=generations;generation++){
    history.push({generation,mean:population.reduce((s,g)=>s+polyScores(g)[feature],0)/size,diversity:diversity(population)});
    if(generation===generations)break;
    const ranked=selected?[...population].sort((a,b)=>polyScores(b)[feature]-polyScores(a)[feature]).slice(0,Math.max(2,Math.floor(size/4))):population;
    const next:PolyGenome[]=[];for(let i=0;i<size;i++){const childSeed=seed+"|g:"+generation+"|child:"+i,rng=seededRandom(childSeed,"parents");
      next.push(inheritPoly(ranked[Math.floor(rng()*ranked.length)],ranked[Math.floor(rng()*ranked.length)],childSeed));}population=next;
  }return history;
}
