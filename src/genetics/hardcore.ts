import { LILLY_LOCUS, validateGenotype, type Genotype, type LocusDefinition } from "./mendel";

/** Single compatible Axanthic line, breeder-observed recessive working model.
 * Not a DNA assay or a claim that every real-world Axanthic line is interchangeable.
 */
export const AXANTHIC_LOCUS: LocusDefinition = {
  id: "axanthic", name: "Axanthic (동일 계통 모델)", alleles: ["A", "ax"], nonViablePairs: [],
  evidence: "브리더 관찰 기반 열성 작업 모델. 계통 간 호환성·복합 모프는 검증하지 않았습니다.",
};
export const HARDCORE_LOCI = [LILLY_LOCUS, AXANTHIC_LOCUS] as const;
export function expandedGenotype(g: Genotype): Genotype {
  if (!g || g.modelVersion !== 1 || !g.loci || Object.keys(g).some(k => k !== "modelVersion" && k !== "loci"))
    throw new Error("지원하지 않는 유전 모델입니다.");
  const result = { modelVersion: 1 as const, loci: { ...g.loci, axanthic: g.loci.axanthic ?? ["A", "A"] as const } };
  validateGenotype(result, HARDCORE_LOCI);
  return result;
}
export function axanthicState(g: Genotype): "normal" | "carrier" | "visual" {
  const count = expandedGenotype(g).loci.axanthic.filter(a => a === "ax").length;
  return count === 2 ? "visual" : count === 1 ? "carrier" : "normal";
}
export function geneticLabel(g: Genotype): string {
  const expanded = expandedGenotype(g);
  return HARDCORE_LOCI.map(l => l.name + ": " + expanded.loci[l.id].join("/")).join(" · ");
}
