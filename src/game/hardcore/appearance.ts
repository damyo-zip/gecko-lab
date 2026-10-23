import { patternTraits } from "@/genetics/advanced/pattern-traits";
import { phenotype } from "@/genetics/advanced/phenotype";
import { buildPatternPlan } from "@/engine/pattern-plan";
import { classifyPattern } from "@/phenotype/names";
import type { Gecko } from "./model";
import {forgeView} from './forge-appearance';

/** Current records use native Forge observations. Unmarked records retain the
 * frozen historical geometry and naming for save replay and regression tests. */
export function appearanceProfile(g:Gecko) {
  const current=forgeView(g);if(current)return{traits:current.traits,observation:current.observation,names:current.names};
  if(g.genetics?.appearanceVersion!=="patterns-1"||!g.genetics.genome)return null;
  const traits=patternTraits(g.genetics.genome),plan=buildPatternPlan(traits,g.visualSeed);
  const names=classifyPattern(traits,plan.observation,phenotype(g.genetics.genome).geneticMorphs);
  return {traits,observation:plan.observation,names};
}
