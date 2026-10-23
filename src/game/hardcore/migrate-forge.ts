import type {HardcoreGame,Gecko} from './model';
import type {GeneticsRecord} from '@/genetics/advanced/model';

/** Add only an engine marker. Actual alleles, public knowledge, conception rolls,
 * names, ids, prices and lifecycle counters are never inferred or regenerated. */
export function migrateForge(source:HardcoreGame):HardcoreGame {
  if(source.forge?.version===1)return source;
  const game=structuredClone(source);game.forge={version:1};
  const mark=(r:GeneticsRecord|undefined)=>{if(r&&!r.forge)r.forge={version:1};};
  const markGecko=(g:Gecko)=>mark(g.genetics);
  Object.values(game.individuals).forEach(markGecko);
  Object.values(game.eggs).forEach(e=>markGecko(e.embryo));
  Object.values(game.shop.offers).forEach(o=>{markGecko(o.individual);if(o.family){markGecko(o.family.father);markGecko(o.family.mother);}});
  Object.values(game.matings).forEach(m=>{if(m.genetics){mark(m.genetics.father);mark(m.genetics.mother);}m.lifecycle?.offspring.forEach(o=>markGecko(o.embryo));});
  // Award portraits are the same immutable birth evidence as their egg records.
  game.breedingChallenges?.completed.forEach(c=>markGecko(c.specimen));
  return game;
}
