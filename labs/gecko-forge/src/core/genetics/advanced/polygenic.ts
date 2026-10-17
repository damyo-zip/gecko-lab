import { seededRandom } from "../random";
import { FEATURES, type Feature, type PolyGenome, type Scores } from "./model";

export const FEATURE_LABELS: Record<Feature,string> = {red:"붉은 발색",orange:"노랑·오렌지",brightness:"체색 명도",cream:"크림 면적",dorsal:"등 패턴",flank:"옆구리 패턴",harlequin:"할리퀸 면적",spots:"반점 밀도",pinstripe:"핀스트라이프 연결",contrast:"색·패턴 대비"};
/** Explicit game configuration: 60 virtual loci, allele effects -1..1, no mutation. */
export const POLY_CONFIG = {
  version:1, lociPerFeature:6, alleleEffects:[-1,-.5,0,.5,1], additiveScale:.75, dominance:0,
  intercept:{red:-.6,orange:0,brightness:0,cream:-1,dorsal:0,flank:-.9,harlequin:-1,spots:-2,pinstripe:0,contrast:0} as Scores,
  /** Pleiotropy is a declared GAME model; no real chromosome or causal gene claim. */
  shared:[{from:"flank",to:"harlequin",weight:.3},{from:"cream",to:"harlequin",weight:.2},{from:"brightness",to:"contrast",weight:-.2}] as {from:Feature;to:Feature;weight:number}[],
  mutation:{enabled:false,rate:0},
};
export const POLY_IDS = FEATURES.flatMap(f=>Array.from({length:POLY_CONFIG.lociPerFeature},(_,i)=>f+"-"+i));
export function validatePoly(g: PolyGenome): void {
  if (!g || g.version!==1 || Object.keys(g).sort().join()!=="loci,version" || !g.loci || Object.keys(g.loci).length!==POLY_IDS.length) throw new Error("가상 다유전자 모델 오류");
  for (const id of POLY_IDS) {const pair=g.loci[id];if(!Array.isArray(pair)||pair.length!==2||pair.some(a=>!Number.isInteger(a)||a<0||a>=POLY_CONFIG.alleleEffects.length))throw new Error("가상 대립유전자 오류");}
}
export function founderPoly(seed:string, subdued=false):PolyGenome {
  const loci=Object.fromEntries(POLY_IDS.map(id=>{const rng=seededRandom(seed,"poly-founder:"+id);
    const allele=()=>{const x=rng();return x<.1?0:x<.3?1:x<.7?2:x<.9?3:4;};
    // Affordable beginner pair has mild pattern alleles, not an overwritten phenotype.
    const pair:readonly [number,number]=subdued && /^(spots|flank|cream)-/.test(id)?[1,2]:[allele(),allele()];
    return [id,pair];
  }));return {version:1,loci};
}
export function inheritPoly(father:PolyGenome,mother:PolyGenome,seed:string):PolyGenome {
  validatePoly(father);validatePoly(mother);
  return {version:1,loci:Object.fromEntries(POLY_IDS.map(id=>{const rng=seededRandom(seed,"poly-inherit:"+id);
    return [id,[father.loci[id][rng()<.5?0:1],mother.loci[id][rng()<.5?0:1]]];}))};
}
export function polyScores(g:PolyGenome):Scores {
  validatePoly(g);const effects=POLY_CONFIG.alleleEffects;
  const sums=Object.fromEntries(FEATURES.map(f=>[f,Array.from({length:POLY_CONFIG.lociPerFeature},(_,i)=>g.loci[f+"-"+i]).reduce((s,p)=>s+effects[p[0]]+effects[p[1]]+POLY_CONFIG.dominance*(p[0]!==p[1]?1:0),0)/Math.sqrt(2*POLY_CONFIG.lociPerFeature)])) as Scores;
  return Object.fromEntries(FEATURES.map(f=>{const shared=POLY_CONFIG.shared.filter(p=>p.to===f).reduce((s,p)=>s+p.weight*sums[p.from],0);
    return [f,1/(1+Math.exp(-(POLY_CONFIG.intercept[f]+POLY_CONFIG.additiveScale*(sums[f]+shared))))];})) as Scores;
}
export function diversity(population:readonly PolyGenome[]):number {
  if(!population.length)return 0;
  return POLY_IDS.reduce((sum,id)=>{const counts=new Map<number,number>();for(const g of population)for(const a of g.loci[id])counts.set(a,(counts.get(a)??0)+1);
    return sum+1-[...counts.values()].reduce((s,n)=>s+(n/(population.length*2))**2,0);},0)/POLY_IDS.length;
}
