import {newGame,act} from '../../src/game/hardcore/play';
import {actWithTime} from '../../src/game/hardcore/time-source';
import {exampleGenome} from '../../src/genetics/advanced/pattern-examples';
import {legacyTraits,observedLoci} from '../../src/genetics/advanced/phenotype';
import {polyScores} from '../../src/genetics/advanced/polygenic';
import {unknownKnowledge,childKnowledge} from '../../src/genetics/advanced/inference';
import {cachedGenotype} from '../../src/game/hardcore/genetics';
import {evaluateBreedingChallenge} from '../../src/game/hardcore/challenge-evaluator';
import {eggFailure} from '../../src/game/hardcore/egg-outcome';
import type {ChallengeId} from '../../src/game/hardcore/challenge-rules';
import type {Gecko,HardcoreGame} from '../../src/game/hardcore/model';

/** Explicit test-only founder alleles; real offspring factory/inheritance and
 * hatch RNG. Never used for player generation or to overwrite hatch outcomes. */
export function challengeParents(id:ChallengeId,seed='challenge-test'):HardcoreGame {
 const game=newGame(seed,'2026-10-16',{initialMoney:1_000_000,initialCapacity:20});game.food=500;
 const family=Object.values(game.shop.offers)[0].family!;
 for(const sex of ['male','female'] as const){
  const g:Gecko=structuredClone(sex==='male'?family.father:family.mother);
  g.id='challenge-'+sex;g.name=sex==='male'?'도전 아비':'도전 어미';g.parents=null;g.status='owned';g.birthTurn=-12;g.birthDate='2026-07-24';g.nextBreedTurn=0;
  g.cycleAnchor=game.lastDate;g.recoverUntil=game.lastDate;g.visualSeed=seed+'|'+sex;
  const genome=exampleGenome(id==='stars'?'superdal':id==='white'||id==='monochrome'?'extreme':'patternless');
  const values=id==='midnight'?{brightness:0,red:0,orange:0}:id==='sun'?{brightness:2,red:0,orange:4}:id==='white'||id==='monochrome'?{cream:4,contrast:0,spots:0,pinstripe:0}:{};
  for(const [feature,a] of Object.entries(values))for(let n=0;n<6;n++)genome.polygenic.loci[feature+'-'+n]=[a,a];
  if((id==='white'||id==='monochrome')&&sex==='female')genome.mendelian.loci['lilly-white']=['n','Lw'];
  if(id==='monochrome')genome.mendelian.loci.axanthic=['ax','ax'];
  g.genetics={version:1,genome,appearanceVersion:'regional-2',knowledge:childKnowledge(unknownKnowledge(),unknownKnowledge(),observedLoci(genome),g.id)};
  g.genotype=cachedGenotype(g.genetics,g.genotype);g.potential=legacyTraits(polyScores(genome.polygenic));game.individuals[g.id]=g;
 }
 return game;
}
export const challengeTurn=(game:HardcoreGame)=>actWithTime(game,{type:'endTurn'},game.time.realtimeAnchorDate);
export function challengeClutch(id:ChallengeId){
 for(let n=0;n<40;n++){
  let game=challengeParents(id,'challenge-'+id+'-'+n);
  game=act(game,{type:'breed',fatherId:'challenge-male',motherId:'challenge-female'},game.lastDate);
  game=challengeTurn(challengeTurn(game));
  const mating=Object.values(game.matings)[0];game=act(game,{type:'collectEggs',matingId:mating.id},game.lastDate);
  const matches=Object.values(game.eggs).filter(e=>eggFailure(e)===null&&evaluateBreedingChallenge(e.embryo,id));
  if(matches.length)return {game,eggId:matches[0].id};
 }
 throw new Error('No attainable challenge fixture: '+id);
}
