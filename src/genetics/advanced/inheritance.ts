import type { AllelePair } from "../mendel";
import { seededRandom } from "../random";
import { LOCI, pairKey, validateMendelian } from "./loci";
import type { Forecast, JointOutcome, Locus, MendelianGenome } from "./model";

/** One allele from each parent. Duplicate homozygous gametes merge without changing mass. */
export function gametes(pair: AllelePair): { allele: string; probability: number }[] {
  return pair[0] === pair[1] ? [{ allele: pair[0], probability: 1 }] : pair.map(allele => ({ allele, probability: .5 }));
}
export function cross(father: MendelianGenome, mother: MendelianGenome, loci = LOCI): Forecast {
  validateMendelian(father, loci); validateMendelian(mother, loci);
  let outcomes: JointOutcome[] = [{ loci: {}, probability: 1, viableProbability: 0, viable: true, safe: true, phenotype: "" }];
  for (const l of loci) {
    const cells = new Map<string, { pair: AllelePair; probability: number }>();
    for (const a of gametes(father.loci[l.id])) for (const b of gametes(mother.loci[l.id])) {
      const key = pairKey([a.allele,b.allele], l), cell = cells.get(key);
      if (cell) cell.probability += a.probability*b.probability;
      else cells.set(key, { pair: key.split("/") as unknown as AllelePair, probability: a.probability*b.probability });
    }
    outcomes = outcomes.flatMap(o => [...cells].map(([key,c]) => ({ loci: { ...o.loci, [l.id]: c.pair },
      probability: o.probability*c.probability, viableProbability: 0, viable: o.viable && !l.nonViable.includes(key),
      safe: o.safe && !l.blocked.includes(key), phenotype: [o.phenotype,l.phenotypes[key] === "Normal" ? "" : l.phenotypes[key]].filter(Boolean).join(" + ") })));
  }
  const survival = outcomes.filter(o=>o.viable).reduce((s,o)=>s+o.probability,0);
  for (const o of outcomes) { o.viableProbability = o.viable && survival > 0 ? o.probability/survival : 0; o.phenotype ||= "Normal"; }
  const groups = new Map<string, { label:string; probability:number; viableProbability:number }>();
  for (const o of outcomes) { const old = groups.get(o.phenotype); if (old) { old.probability+=o.probability; old.viableProbability+=o.viableProbability; }
    else groups.set(o.phenotype,{label:o.phenotype,probability:o.probability,viableProbability:o.viableProbability}); }
  return { outcomes, phenotypes:[...groups.values()], nonViableProbability:1-survival,
    blockedProbability:outcomes.filter(o=>!o.safe).reduce((s,o)=>s+o.probability,0) };
}
export function inherit(father: MendelianGenome, mother: MendelianGenome, seed: string, loci = LOCI): MendelianGenome {
  validateMendelian(father,loci); validateMendelian(mother,loci);
  return {version:1,loci:Object.fromEntries(loci.map(l=>{ const rng=seededRandom(seed,"advanced-locus:"+l.id);
    return [l.id,[father.loci[l.id][rng()<.5?0:1],mother.loci[l.id][rng()<.5?0:1]]]; }))};
}
export function risks(g: MendelianGenome, loci: readonly Locus[] = LOCI): string[] {
  validateMendelian(g,loci);
  return loci.filter(l=>l.blocked.includes(pairKey(g.loci[l.id],l))).map(l=>l.name + " 위험 유전형");
}
