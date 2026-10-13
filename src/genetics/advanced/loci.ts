import type { AllelePair } from "../mendel";
import type { Locus, MendelianGenome } from "./model";

export const SOURCES = {
  overview: "https://www.gecktopia.com/learn/where-the-genetics-come-from",
  grades: "https://www.gecktopia.com/morphs/grades",
  psa: "https://lmreptiles.com/fg-scapppsa/",
  lilly: "https://www.corchgeckos.com/lillywhite.html",
  axanthic: "https://www.ibexotic.com/post/axanthic-crested-gecko",
};
const reviewed = "2026-10-13";
export const LOCI: readonly Locus[] = [
  { id: "lilly-white", name: "Lilly White", alleles: ["n", "Lw"], inheritance: "incomplete-dominant", modelVersion: 1,
    phenotypes: { "n/n": "Normal", "n/Lw": "Lilly White", "Lw/Lw": "Lilly 동형접합 비생존" },
    nonViable: ["Lw/Lw"], blocked: ["Lw/Lw"], evidence: {
      sources: [SOURCES.lilly, SOURCES.overview, SOURCES.grades], reviewed, level: "breeder-supported",
      claim: "브리더 관찰에 기반한 불완전 우성·동형접합 비생존 작업 모델.",
      disagreements: "분자 유전자 확인이나 개체별 사망 시점의 모델이 아닙니다.", safety: "Lilly × Lilly 차단." } },
  { id: "axanthic", name: "Axanthic · 단일 호환 라인", alleles: ["A", "ax"], inheritance: "recessive", modelVersion: 1,
    phenotypes: { "A/A": "Normal", "A/ax": "Normal", "ax/ax": "Axanthic" }, nonViable: [], blocked: [], evidence: {
      sources: [SOURCES.axanthic, SOURCES.overview, SOURCES.grades], reviewed, level: "breeder-supported",
      claim: "한 호환 라인의 열성 멘델 모델. Aa는 외형상 Normal.",
      disagreements: "모든 실제 아잔틱 라인의 상호 호환성을 주장하지 않습니다. DNA 확정 아님.", safety: "게임은 하나의 호환 라인만 생성합니다." } },
  { id: "cappuccino-complex", name: "Cappuccino / Sable / Highway · 잠정", alleles: ["n", "C", "S", "H"], inheritance: "multiple-alleles", modelVersion: 1,
    phenotypes: { "n/n": "Normal", "n/C": "Cappuccino", "n/S": "Sable", "n/H": "Highway",
      "C/C": "Super Cappuccino", "C/S": "Luwak", "C/H": "Cappuccino/Highway", "S/S": "Super Sable", "S/H": "Sable/Highway · 미검증", "H/H": "Super Highway · 미검증" },
    nonViable: [], blocked: ["C/C", "C/S", "C/H", "S/S", "S/H", "H/H"], evidence: {
      sources: [SOURCES.psa, SOURCES.overview, SOURCES.grades], reviewed, level: "provisional",
      claim: "Foundation Genetics PSA v1.2 (2026-09-08)의 동일 좌위 관찰을 잠정 채택.",
      disagreements: "같은 좌위는 브리더 모델이며 DNA 확정 아님. 건강 위험은 수정 시점 비생존과 다릅니다.",
      safety: "Super Cappuccino·Sorak·Luwak·Capp/Highway·Super Sable 보고. 두 변이 사본 조합은 모두 보수적으로 차단하며 사망 확률은 부여하지 않습니다." } },
];
export const locusById = (id: string): Locus => { const locus = LOCI.find(l => l.id === id); if (!locus) throw new Error("지원하지 않는 좌위: " + id); return locus; };
export function pairKey(pair: AllelePair, locus: Locus): string {
  if (!Array.isArray(pair) || pair.length !== 2 || pair.some(a => !locus.alleles.includes(a))) throw new Error("대립유전자 오류: " + locus.id);
  return [...pair].sort((a,b) => locus.alleles.indexOf(a) - locus.alleles.indexOf(b)).join("/");
}
export function validateMendelian(g: MendelianGenome, loci = LOCI): void {
  if (!g || g.version !== 1 || Object.keys(g).sort().join() !== "loci,version" || !g.loci || Object.keys(g.loci).length !== loci.length) throw new Error("유전체 좌위/버전 오류");
  for (const l of loci) {
    const key = pairKey(g.loci[l.id], l);
    if (!l.phenotypes[key]) throw new Error("유전형 표현 규칙 없음");
    if (l.linkage?.group) throw new Error("연관 유전은 아직 지원하지 않습니다. 독립으로 몰래 계산하지 않습니다.");
  }
}
export const wildGenome = (): MendelianGenome => ({ version: 1, loci: Object.fromEntries(LOCI.map(l => [l.id, [l.alleles[0], l.alleles[0]]])) });
