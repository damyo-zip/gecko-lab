import {sampleGenome} from '@/engine/sample-genome';
import type { GeckoSpecimen, PatternStyle } from "@/engine/model";
import { hasLilly } from "@/genetics/mendel";
import { clamp } from "@/genetics/traits";
import type { Individual } from "./model";

export interface Phenotype {
  geneticMorph: "Lilly White" | "Normal";
  visualClass: PatternStyle;
  description: string;
}
/** Visual classification is deliberately separate from the verified locus. */
export function phenotypeOf(individual: Individual): Phenotype {
  const value = individual.potential;
  if (hasLilly(individual.genotype)) return { geneticMorph: "Lilly White", visualClass: "lilly", description: "릴리화이트 이형접합체" };
  if (value.spotDensity >= .5) return { geneticMorph: "Normal", visualClass: "dalmatian", description: "일반형 · 반점 외형" };
  if (value.flankIntensity > .62 && value.creamCoverage > .35)
    return { geneticMorph: "Normal", visualClass: "harlequin", description: "일반형 · 할리퀸 외형" };
  if (value.redIntensity > .7 && value.creamCoverage > .45)
    return { geneticMorph: "Normal", visualClass: "tricolor", description: "일반형 · 트라이컬러 외형" };
  return { geneticMorph: "Normal", visualClass: "normal", description: "일반형" };
}

/** Only this bridge knows the graphics contract; genetics/game rules never import the renderer. */
export function toSpecimen(individual: Individual): GeckoSpecimen {
  const traits = individual.potential, phenotype = phenotypeOf(individual);
  const lilly = phenotype.geneticMorph === "Lilly White";
  const genome=sampleGenome({bodyColor:traits.bodyTone<.42?"brown":"orange",patternStyle:phenotype.visualClass,dorsalCoverage:traits.dorsalIntensity,flankCoverage:traits.flankIntensity,spotCount:Math.round(traits.spotDensity*100)});
  return {
    genome,schemaVersion: 1, id: individual.id, name: individual.name, seed: individual.visualSeed,
    appearance: {
      bodyColor: lilly ? "cream" : traits.redIntensity > .55 ? "orange" : traits.bodyTone < .42 ? "brown" : traits.creamCoverage > .7 ? "cream" : "orange",
      patternStyle: phenotype.visualClass,
      dorsalCoverage: clamp(lilly ? .75 + traits.creamCoverage * .25 : traits.dorsalIntensity * .65 + traits.creamCoverage * .35),
      flankCoverage: clamp(lilly ? .65 + traits.flankIntensity * .35 : traits.flankIntensity * .65 + traits.creamCoverage * .35),
      spotCount: Math.round(traits.spotDensity * 70),
    },
    state: { fire: "up" },
  };
}
