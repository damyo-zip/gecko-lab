import { toSpecimen, phenotypeOf } from "@/game/adapter";
import { axanthicState } from "@/genetics/hardcore";
import type { Gecko } from "./model";
import { carrierProbability } from "@/genetics/advanced/inference";
import { publicKnowledge } from "./genetics";
import { polyScores } from "@/genetics/advanced/polygenic";
import { phenotype } from "@/genetics/advanced/phenotype";

function legacyView(g: Gecko) {
  return { ...g, genotype: { modelVersion: 1 as const, loci: { "lilly-white": g.genotype.loci["lilly-white"] } } };
}
export function morph(g: Gecko): string {
  const lilly = g.genotype.loci["lilly-white"].includes("Lw"), ax = axanthicState(g.genotype);
  if (ax === "visual") return lilly ? "Axanthic + Lilly (복합 외형)" : "Axanthic";
  const label = phenotypeOf(legacyView(g)).description;
  const complex=g.genetics?.genome?phenotype(g.genetics.genome).geneticMorphs.filter(m=>m!=="Lilly White"&&m!=="Axanthic"):[];
  const p=carrierProbability(publicKnowledge(g));
  return [label,...complex].join(" · ") + (p===null?" · 유전 정보 미확인":p>1-1e-9?" · 100% het Ax":p>0?" · "+(p*100).toFixed(1)+"% possible het Ax":"");
}
/** Preserve the renderer; only the adapter knows the added locus. */
export function specimen(g: Gecko,fire:"up"|"down"="up") {
  const result = toSpecimen(legacyView(g));
  if(g.genetics?.genome){const s=polyScores(g.genetics.genome.polygenic),lilly=g.genotype.loci["lilly-white"].includes("Lw");
    if(!lilly){result.appearance.bodyColor=s.red>.55||s.orange>.58?"orange":s.brightness<.42?"brown":s.cream>.7?"cream":"orange";
      result.appearance.dorsalCoverage=(s.dorsal*.4+s.cream*.3+s.pinstripe*.3)*(.8+.2*s.contrast);
      result.appearance.flankCoverage=(s.flank*.4+s.harlequin*.35+s.cream*.25)*(.8+.2*s.contrast);}
  }
  if (axanthicState(g.genotype) === "visual") {
    result.appearance.bodyColor = "slate";
    if (!g.genotype.loci["lilly-white"].includes("Lw")) result.appearance.patternStyle = "axanthic";
  }
  result.state.fire=fire;
  return result;
}
export function disclosedSex(g: Gecko): string {
  return g.stage === "adult" ? g.sex === "male" ? "수컷 ♂" : "암컷 ♀" : "미구분 · 성체 때 공개";
}
