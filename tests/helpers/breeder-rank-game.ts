import {newGame,act} from '../../src/game/hardcore/play';
import {LEGACY_CHALLENGES as BREEDING_CHALLENGES} from '../../src/game/hardcore/challenge-rules';
import {challengeParents,challengeTurn} from './challenge-game';
import type {HardcoreGame} from '../../src/game/hardcore/model';

let cached:HardcoreGame[]|undefined;
/** Six valid saves, 0..5 achievements, using explicit test founders and the real
 * mating, inheritance, manual egg collection and hatch/award paths. No fabricated
 * completion records or altered hatch results enter the browser fixture. */
export function breederRankGames():HardcoreGame[]{
 if(cached)return cached.map(g=>structuredClone(g));
 for(let trial=0;trial<40;trial++){
  let game=newGame('breeder-ranks-'+trial,'2026-10-16',{initialMoney:1_000_000,initialCapacity:40});game.food=1000;
  for(const c of BREEDING_CHALLENGES){
   const founders=challengeParents(c.id,game.seed+'|'+c.id);
   for(const sex of ['male','female'] as const){
    const g=founders.individuals['challenge-'+sex];g.id=c.id+'-'+sex;g.name=c.name+(sex==='male'?' 아비':' 어미');
    game.individuals[g.id]=g;
   }
  }
  const states=[structuredClone(game)];
  for(const c of BREEDING_CHALLENGES){
   game=act(game,{type:'selectChallenge',challengeId:c.id},game.lastDate);
   game=act(game,{type:'breed',fatherId:c.id+'-male',motherId:c.id+'-female'},game.lastDate);
   const mating=Object.values(game.matings).at(-1)!;
   game=challengeTurn(challengeTurn(game));game=act(game,{type:'collectEggs',matingId:mating.id},game.lastDate);
   for(let n=0;n<4;n++)game=challengeTurn(game);
   if(!game.breedingChallenges!.completed.some(r=>r.challengeId===c.id))break;
   game=act(game,{type:'acknowledgeChallenge',challengeId:c.id},game.lastDate);states.push(structuredClone(game));
  }
  if(states.length===6){cached=states;return states.map(g=>structuredClone(g));}
 }
 throw new Error('Could not find five genuinely successful challenge clutches');
}
