import { patternTraits } from "@/genetics/advanced/pattern-traits";
import { phenotype } from "@/genetics/advanced/phenotype";
import { buildPatternPlan } from "@/engine/pattern-plan";
import { classifyPattern } from "@/phenotype/names";
import type { Gecko } from "./model";
import {forgeView} from './forge-appearance';

export const appearanceKey=(g:Gecko)=>JSON.stringify([g.genetics?.genome,g.genetics?.forge,g.genetics?.appearanceVersion,g.genetics?.unresolvedComplex,g.genotype,g.potential,g.visualSeed]);
type Profile={traits:ReturnType<typeof patternTraits>;observation:ReturnType<typeof buildPatternPlan>['observation'];names:ReturnType<typeof classifyPattern>;displayName?:string};
// Keep only small observations/names here, never hundreds of native sprite buffers.
const profiles=new Map<string,Profile|null>();

/** Current records use native Forge observations. Unmarked records retain the
 * frozen historical geometry and naming for save replay and regression tests. */
export function appearanceProfile(g:Gecko) {
  const key=appearanceKey(g);if(profiles.has(key)){const p=profiles.get(key)!;profiles.delete(key);profiles.set(key,p);return p;}
  const current=forgeView(g);let result:Profile|null=null;
  if(current)result={traits:current.traits,observation:current.observation,names:current.names,displayName:current.displayName};
  else if(g.genetics?.appearanceVersion==='patterns-1'&&g.genetics.genome){
    const traits=patternTraits(g.genetics.genome),plan=buildPatternPlan(traits,g.visualSeed);
    result={traits,observation:plan.observation,names:classifyPattern(traits,plan.observation,phenotype(g.genetics.genome).geneticMorphs)};
  }
  profiles.set(key,result);if(profiles.size>512)profiles.delete(profiles.keys().next().value!);
  return result;
}
