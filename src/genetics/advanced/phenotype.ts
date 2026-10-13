import type { PotentialTraits } from "../traits";
import { pairKey, locusById } from "./loci";
import { polyScores } from "./polygenic";
import type { Genome, Scores } from "./model";

export interface Phenotype { scores:Scores; geneticMorphs:string[]; visualClasses:string[]; environment:{stage:string;fire:"up"|"down"} }
export function observedLoci(g:Genome):Record<string,string> {
  return Object.fromEntries(Object.entries(g.mendelian.loci).map(([id,pair])=>{const l=locusById(id);return [id,l.phenotypes[pairKey(pair,l)]];}));
}
export function phenotype(g:Genome,environment:Phenotype["environment"]={stage:"adult",fire:"up"}):Phenotype {
  const scores=polyScores(g.polygenic),observed=observedLoci(g),geneticMorphs=Object.values(observed).filter(label=>label!=="Normal");
  // Base breeding values stay immutable; fire/age are a separate expression layer.
  const factor=environment.fire==="down"?.85:1;
  const expressed={...scores,red:scores.red*factor,orange:scores.orange*factor};
  const visualClasses=[scores.harlequin>.55?"할리퀸 외형":"",scores.spots>.5?"달마시안 외형":"",scores.pinstripe>.7?"핀스트라이프 외형":"",scores.red>.7&&scores.cream>.45?"트라이컬러 외형":""].filter(Boolean);
  return {scores:expressed,geneticMorphs,visualClasses,environment};
}
export function legacyTraits(scores:Scores):PotentialTraits {
  return {bodyTone:scores.brightness,redIntensity:scores.red,creamCoverage:scores.cream,dorsalIntensity:scores.dorsal,
    flankIntensity:Math.min(1,scores.flank*.7+scores.harlequin*.3),spotDensity:scores.spots};
}
