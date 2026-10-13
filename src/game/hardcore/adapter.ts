import { toSpecimen, phenotypeOf } from "@/game/adapter";
import { axanthicState } from "@/genetics/hardcore";
import type { Gecko } from "./model";

function legacyView(g: Gecko) {
  return { ...g, genotype: { modelVersion: 1 as const, loci: { "lilly-white": g.genotype.loci["lilly-white"] } } };
}
export function morph(g: Gecko): string {
  const lilly = g.genotype.loci["lilly-white"].includes("Lw"), ax = axanthicState(g.genotype);
  if (ax === "visual") return lilly ? "Axanthic + Lilly (복합 외형)" : "Axanthic";
  const label = phenotypeOf(legacyView(g)).description;
  return label + (ax === "carrier" ? " · Ax 보인자" : "");
}
/** Preserve the renderer; only the adapter knows the added locus. */
export function specimen(g: Gecko) {
  const result = toSpecimen(legacyView(g));
  if (axanthicState(g.genotype) === "visual") {
    result.appearance.bodyColor = "slate";
    if (!g.genotype.loci["lilly-white"].includes("Lw")) result.appearance.patternStyle = "axanthic";
  }
  return result;
}
export function disclosedSex(g: Gecko): string {
  return g.stage === "adult" ? g.sex === "male" ? "수컷 ♂" : "암컷 ♀" : "미구분 · 성체 때 공개";
}
