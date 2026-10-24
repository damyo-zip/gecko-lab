import {emptyChallenges} from './challenges';
import type {HardcoreGame,Gecko} from './model';
import type {GeneticsRecord} from '@/genetics/advanced/model';

/** Add the renderer marker and reset obsolete challenge progress as requested.
 * DNA, conception outcomes, livestock, money and lifecycle records stay intact. */
export function migrateForge(source:HardcoreGame):HardcoreGame {
  if(source.forge?.version===1){
    if(source.breedingChallenges?.version!==1)return source;
    const next=structuredClone(source);next.breedingChallenges=emptyChallenges(2,next.turn);next.revision++;return next;
  }
  const game=structuredClone(source);game.forge={version:1};
  const mark=(r:GeneticsRecord|undefined)=>{if(r&&!r.forge)r.forge={version:1};};
  const markGecko=(g:Gecko)=>mark(g.genetics);
  Object.values(game.individuals).forEach(markGecko);
  Object.values(game.eggs).forEach(e=>markGecko(e.embryo));
  Object.values(game.shop.offers).forEach(o=>{markGecko(o.individual);if(o.family){markGecko(o.family.father);markGecko(o.family.mother);}});
  Object.values(game.matings).forEach(m=>{if(m.genetics){mark(m.genetics.father);mark(m.genetics.mother);}m.lifecycle?.offspring.forEach(o=>markGecko(o.embryo));});
  // Award portraits are the same immutable birth evidence as their egg records.
  game.breedingChallenges?.completed.forEach(c=>markGecko(c.specimen));
  if(game.breedingChallenges?.version===1){game.breedingChallenges=emptyChallenges(2,game.turn);game.revision++;}
  return game;
}
