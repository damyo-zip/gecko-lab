import {currentChallengeClutch} from './current-challenge-game';
import {emptyChallenges} from '../../src/game/hardcore/challenges';
import {challengeParents,challengeTurn} from './challenge-game';
import {migrateForge} from '../../src/game/hardcore/migrate-forge';
import {founderForge} from '../../src/game/hardcore/forge-genetics';
import {createVeilTraits,withVeilTraits} from '../../src/forge';
import {act} from '../../src/game/hardcore/play';
import {evaluateBreedingChallenge} from '../../src/game/hardcore/challenge-evaluator';
import {eggFailure} from '../../src/game/hardcore/egg-outcome';
import {isCurrentChallengeId,type ChallengeId} from '../../src/game/hardcore/challenge-rules';

/** Explicit new founder copies; every child still uses real conception and hatch RNG. */
export function forgeChallengeClutch(id:ChallengeId){
 if(isCurrentChallengeId(id))return currentChallengeClutch(id);
 for(let n=0;n<40;n++){
  let game=migrateForge(challengeParents(id,'forge-challenge-'+id+'-'+n));
  for(const sex of['male','female']){
   const parent=game.individuals['challenge-'+sex],f=founderForge('forge-goal:'+id+sex,0,true);
   f.extensions=withVeilTraits(f.extensions,createVeilTraits('forge-goal-veil:'+id+sex,1));parent.genetics!.forge=f;
  }
  game.breedingChallenges=emptyChallenges();
  game=act(game,{type:'breed',fatherId:'challenge-male',motherId:'challenge-female'},game.lastDate);
  game=challengeTurn(challengeTurn(game));
  game=act(game,{type:'collectEggs',matingId:Object.keys(game.matings)[0]},game.lastDate);
  const match=Object.values(game.eggs).find(e=>eggFailure(e)===null&&evaluateBreedingChallenge(e.embryo,id));
  if(match)return {game,eggId:match.id};
 }
 throw Error('No attainable inherited native challenge: '+id);
}
