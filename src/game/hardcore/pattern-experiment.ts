import {founderPoly,inheritPoly} from "@/genetics/advanced/polygenic";
import {wildGenome} from "@/genetics/advanced/loci";
import {patternTraits} from "@/genetics/advanced/pattern-traits";
import {buildPatternPlan} from "@/engine/pattern-plan";
import {fullLine} from "@/phenotype/names";

/** Gene-pool experiment, not gameplay mating permission. Rank only observable
 * rendered connection/run lengths; no secret alleles or latent score selection. */
export function patternSelectionExperiment(seed:string,selected:boolean,generations=10,size=64) {
  if(!Number.isInteger(generations)||generations<1||generations>30||!Number.isInteger(size)||size<16||size>200)throw new Error("선택교배 표본 크기 오류");
  let population=Array.from({length:size},(_,i)=>founderPoly(seed+"|founder-"+i));
  const history:{generation:number;mean:number;fullRate:number;visibleQuality:number}[]=[];
  for(let generation=0;generation<=generations;generation++){
    const observed=population.map((polygenic,i)=>{
      const t=patternTraits({version:1,mendelian:wildGenome(),polygenic}),o=buildPatternPlan(t,seed+"|g-"+generation+"|visible-"+i).observation;
      return {polygenic,latent:t.pin.reduce((n,v)=>n+v,0)/2,full:o.pin.every(fullLine),quality:o.pin.reduce((n,l)=>n+(l.coverage+l.longestRun/l.length)/2,0)/2};
    });
    history.push({generation,mean:observed.reduce((n,o)=>n+o.latent,0)/size,fullRate:observed.filter(o=>o.full).length/size,visibleQuality:observed.reduce((n,o)=>n+o.quality,0)/size});
    if(generation===generations)break;
    const breeders=selected?[...observed].sort((a,b)=>b.quality-a.quality).slice(0,Math.floor(size/4)):observed;
    population=Array.from({length:size},(_,i)=>inheritPoly(breeders[i%breeders.length].polygenic,breeders[(i*7+5)%breeders.length].polygenic,seed+"|generation-"+generation+"|child-"+i));
  }
  return history;
}
