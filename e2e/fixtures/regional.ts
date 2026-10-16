import {sampleGenome} from '../../src/engine/sample-genome';
import {legacyTraits} from '../../src/genetics/advanced/phenotype';
import {polyScores} from '../../src/genetics/advanced/polygenic';
import type {Gecko,HardcoreGame} from '../../src/game/hardcore/model';
/** TEST-ONLY: explicit new-engine founder setup for historical UI scenarios.
 * Called before mating; never a player save migration or inferred real genome. */
export function regionalFixture(game:HardcoreGame):HardcoreGame {
 const records=[...Object.values(game.individuals),...Object.values(game.shop.offers).flatMap(o=>[o.individual,...(o.family?[o.family.father,o.family.mother]:[])])];
 for(const g of records){
  if(!g.genetics?.genome){const t=g.potential;const genome=sampleGenome({bodyColor:t.bodyTone<.42?'brown':'orange',patternStyle:g.genotype.loci['lilly-white'].includes('Lw')?'lilly':'normal',dorsalCoverage:t.dorsalIntensity,flankCoverage:t.flankIntensity,spotCount:Math.round(t.spotDensity*100)});
   genome.mendelian.loci['lilly-white']=g.genotype.loci['lilly-white'];genome.mendelian.loci.axanthic=g.genotype.loci.axanthic??['A','A'];
   g.genetics={...g.genetics!,version:1,genome,appearanceVersion:'regional-2'};
  }else g.genetics.appearanceVersion='regional-2';
  g.genotype={modelVersion:1,loci:{'lilly-white':g.genetics.genome!.mendelian.loci['lilly-white'],axanthic:g.genetics.genome!.mendelian.loci.axanthic}};
  g.potential=legacyTraits(polyScores(g.genetics.genome!.polygenic));
 }
 game.saveVersion=11;return game;
}
