import {founderHealth} from '../../src/genetics/health';
import {newForgeGame,act} from '../../src/game/hardcore/play';
import {forgeReferenceGecko} from '../../src/game/hardcore/challenge-previews';
import {BREEDING_CHALLENGES,type CurrentChallengeId} from '../../src/game/hardcore/challenge-rules';
import {cachedGenotype} from '../../src/game/hardcore/genetics';
import {challengeTurn} from './challenge-game';
import {evaluateBreedingChallenge} from '../../src/game/hardcore/challenge-evaluator';
import {eggFailure} from '../../src/game/hardcore/egg-outcome';
import type {HardcoreGame} from '../../src/game/hardcore/model';

/** Test-only explicit founders; every egg uses production inheritance and hatch RNG. */
export function addTargetParents(game:HardcoreGame,id:CurrentChallengeId,suffix=''){
 const ids=[];
 for(const sex of ['male','female'] as const){
  const g=forgeReferenceGecko(id);g.id=id+'-'+sex+suffix;g.name=id+(sex==='male'?' 아비':' 어미');g.sex=sex;g.visualSeed+=':'+sex+suffix;g.status='owned';g.birthTurn=game.turn-12;g.birthDate='2026-07-24';g.parents=null;g.lastProcessedTurn=game.turn;g.deathCause=null;g.healthGenome=founderHealth(game.seed+'|'+g.id);
  if(sex==='male'){
   g.genetics!.genome!.mendelian.loci['lilly-white']=['n','n'];
   g.genetics!.genome!.mendelian.loci['cappuccino-complex']=['n','n'];
   g.genotype=cachedGenotype(g.genetics!,g.genotype);
  }
  game.individuals[g.id]=g;ids.push(g.id);
 }
 return ids;
}
export function currentChallengeClutch(id:CurrentChallengeId){
 // Fixed, previously measured real RNG trials avoid repeated seed-search setup.
 // If an inherited phenotype stops qualifying, the fixture fails immediately.
 const n=id==='lilly-dalmatian'?3:0;
 {
  let game=newForgeGame('eight-clutch-'+id+'-'+n,'2026-10-16',{initialMoney:1_000_000,initialCapacity:20});game.food=500;
  const [fatherId,motherId]=addTargetParents(game,id);
  game=act(game,{type:'breed',fatherId,motherId},game.lastDate);game=challengeTurn(challengeTurn(game));
  game=act(game,{type:'collectEggs',matingId:Object.keys(game.matings)[0]},game.lastDate);
  const match=Object.values(game.eggs).find(e=>eggFailure(e)===null&&evaluateBreedingChallenge(e.embryo,id));
  if(match)return {game,eggId:match.id};
 }
 throw Error('Unattainable current goal '+id);
}
let cached:HardcoreGame[]|undefined;
export function currentBreederRankGames(){
 if(cached)return cached.map(g=>structuredClone(g));
 let game=newForgeGame('eight-ranks','2026-10-16',{initialMoney:1_000_000,initialCapacity:100});game.food=10000;
 // Sixteen owned animals at every snapshot; historical parents need no replacement.
 for(const c of BREEDING_CHALLENGES)addTargetParents(game,c.id);
 const states=[structuredClone(game)];
 for(const c of BREEDING_CHALLENGES){
  let found=false;
  for(let n=0;n<80&&!found;n++){
   let candidate=structuredClone(game);
   // IDs are valid founder identities; searching here never edits an embryo.
   const father=structuredClone(candidate.individuals[c.id+'-male']),mother=structuredClone(candidate.individuals[c.id+'-female']);
   delete candidate.individuals[father.id];delete candidate.individuals[mother.id];father.id+='-trial'+n;mother.id+='-trial'+n;
   candidate.individuals[father.id]=father;candidate.individuals[mother.id]=mother;
   candidate=act(candidate,{type:'selectChallenge',challengeId:c.id},candidate.lastDate);
   candidate=act(candidate,{type:'breed',fatherId:father.id,motherId:mother.id},candidate.lastDate);
   candidate=challengeTurn(challengeTurn(candidate));const m=Object.values(candidate.matings).at(-1)!;
   candidate=act(candidate,{type:'collectEggs',matingId:m.id},candidate.lastDate);
   if(!Object.values(candidate.eggs).some(e=>e.care?.collectedTurn===candidate.turn&&eggFailure(e)===null&&evaluateBreedingChallenge(e.embryo,c.id)))continue;
   for(let j=0;j<4;j++)candidate=challengeTurn(candidate);
   if(candidate.breedingChallenges!.completed.some(x=>x.challengeId===c.id)){
    game=act(candidate,{type:'acknowledgeChallenge',challengeId:c.id},candidate.lastDate);states.push(structuredClone(game));found=true;
   }
  }
  if(!found)throw Error('No real rank hatch for '+c.id);
 }
 cached=states;return states.map(g=>structuredClone(g));
}
