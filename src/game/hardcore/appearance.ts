import { patternTraits } from "@/genetics/advanced/pattern-traits";
import { phenotype } from "@/genetics/advanced/phenotype";
import { buildPatternPlan } from "@/engine/pattern-plan";
import { classifyPattern } from "@/phenotype/names";
import type { Gecko } from "./model";

/** The adapter boundary combines genetics, anatomical geometry and naming.
 * Old appearance versions remain frozen; no fabricated alleles or migrations. */
export function appearanceProfile(g:Gecko) {
  if(g.genetics?.appearanceVersion!=="patterns-1"||!g.genetics.genome)return null;
  const traits=patternTraits(g.genetics.genome),plan=buildPatternPlan(traits,g.visualSeed);
  const names=classifyPattern(traits,plan.observation,phenotype(g.genetics.genome).geneticMorphs);
  return {traits,observation:plan.observation,names};
}
