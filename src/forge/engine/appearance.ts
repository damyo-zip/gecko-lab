import { phenotype, polyScores } from './genetics';
import { observedLoci } from '@/genetics/advanced/phenotype';
import type { Genome } from './genetics';
import { patternTraits } from '@/genetics/advanced/pattern-traits';
import { buildPatternPlan } from '@/engine/pattern-plan';
import { classifyPattern } from '@/phenotype/names';
import { representativeMorphName } from '@/phenotype/display-name';
import { validateGenome } from './individual';

/** Change this bridge for new appearance experiments, not Mendelian/polygenic inheritance.
 * All values come from the inherited genome. Seed changes geometry only later. */
export function calculatePhenotype(genome: Genome) {
  validateGenome(genome);
  return { inheritedScores: polyScores(genome.polygenic), genetics: phenotype(genome), traits: patternTraits(genome), observed: observedLoci(genome) };
}
export function describeAppearance(p: ReturnType<typeof calculatePhenotype>, seed: string) {
  const observation = buildPatternPlan(p.traits, seed).observation;
  const classification = classifyPattern(p.traits, observation, p.genetics.geneticMorphs);
  const name = representativeMorphName({ geneticMorphs: p.genetics.geneticMorphs,
    color: classification.color, pattern: classification.base, fallback: classification.primary });
  return { name, classification, observation };
}
