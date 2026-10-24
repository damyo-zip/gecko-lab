import {test,expect} from 'vitest';
import {challengeParents,challengeClutch,challengeTurn} from './helpers/challenge-game';
import {act,newGame} from '@/game/hardcore/play';
import {LEGACY_CHALLENGES as BREEDING_CHALLENGES,type ChallengeId} from '@/game/hardcore/challenge-rules';
import {evaluateBreedingChallenge} from '@/game/hardcore/challenge-evaluator';
import {challengeLockRemaining,challengeFeedSlots} from '@/game/hardcore/challenges';
import {exportBackup,parseBackup} from '@/game/hardcore/save';
import {seasonEvents} from '@/game/hardcore/season';
import {validateGame} from '@/game/hardcore/validation';
import {specimen} from '@/game/hardcore/adapter';
const select=(g:ReturnType<typeof newGame>,id:ChallengeId)=>act(g,{type:'selectChallenge',challengeId:id},g.lastDate);

test.each(BREEDING_CHALLENGES)('$name has a reachable current-engine phenotype from an actual inherited hatch',c=>{
 const {game,eggId}=challengeClutch(c.id),before=structuredClone(game),selected=select(game,c.id);
 let end=selected;for(let n=0;n<4;n++)end=challengeTurn(end);
 const record=end.breedingChallenges!.completed[0];
 expect(record?.challengeId).toBe(c.id);expect(record.achievedTurn).toBe(6);
 expect(end.eggs[eggId].status).toBe('hatched');expect(end.individuals[record.specimen.id]).toBeUndefined();
 expect(record.specimen.parents).toEqual(end.eggs[record.eggId].embryo.parents);expect(challengeLockRemaining(end)).toBe(0);
 expect(end.breedingChallenges!.activeId).toBe(c.id);expect(record.reward).toEqual({feedExemptionSlots:1,titleId:c.id});expect(end.breedingChallenges!.equippedTitle).toBeNull();
 expect(specimen(record.specimen)).toEqual(specimen(end.eggs[record.eggId].embryo));
 // Challenge evaluation cannot alter genotype, external appearance, RNG or money.
 let control=before;for(let n=0;n<4;n++)control=challengeTurn(control);
 const projection=structuredClone(end);delete projection.breedingChallenges;projection.revision=control.revision;
 expect(projection).toEqual(control);validateGame(end);
});

test('10-turn lock, same selection no reset, persistence past expiry, change starts another exact lock',()=>{
 let g=select(newGame('challenge-lock','2026-10-16'),'midnight');
 expect(challengeLockRemaining(g)).toBe(10);expect(()=>select(g,'sun')).toThrow('10턴');
 for(let n=0;n<9;n++)g=challengeTurn(g);expect(challengeLockRemaining(g)).toBe(1);
 const again=select(g,'midnight');expect(again.breedingChallenges).toEqual(g.breedingChallenges);expect(()=>select(g,'sun')).toThrow('1턴');
 g=challengeTurn(g);expect(challengeLockRemaining(g)).toBe(0);expect(g.breedingChallenges!.activeId).toBe('midnight');
 g=select(g,'sun');expect(g.breedingChallenges!.unlockTurn).toBe(20);expect(challengeLockRemaining(g)).toBe(10);
 expect(parseBackup(exportBackup(g),g.lastDate)).toEqual(g);
});

test('no retroactive awards for prior hatch, receipt or purchase; eggs laid before selection qualify',()=>{
 let {game:g,eggId}=challengeClutch('white');for(let n=0;n<4;n++)g=challengeTurn(g);
 expect(g.breedingChallenges).toBeUndefined();g=select(g,'white');g=act(g,{type:'receiveHatchling',eggId},g.lastDate);
 expect(g.breedingChallenges!.completed).toHaveLength(0);
 const offer=Object.values(g.shop.offers)[0];g=act(g,{type:'buyGecko',offerId:offer.id},g.lastDate);expect(g.breedingChallenges!.completed).toHaveLength(0);
 const pending=challengeClutch('white').game;let late=pending;for(let n=0;n<3;n++)late=challengeTurn(late);late=select(late,'white');late=challengeTurn(late);
 expect(late.breedingChallenges!.completed).toHaveLength(1);
});

test('a clutch, duplicate event and receipt never double-pay; award snapshot survives sale, death, rename and save',()=>{
 let g=select(challengeClutch('sun').game,'sun');for(let n=0;n<4;n++)g=challengeTurn(g);
 const original=structuredClone(g.breedingChallenges!.completed[0]),id=original.specimen.id;
 seasonEvents(g);seasonEvents(g);expect(g.breedingChallenges!.completed).toHaveLength(1);expect(challengeFeedSlots(g)).toBe(1);
 g=act(g,{type:'receiveHatchling',eggId:original.eggId},g.lastDate);g=act(g,{type:'rename',id,name:'바뀐 이름'},g.lastDate);const forDeath=structuredClone(g);g=act(g,{type:'sell',id},g.lastDate);
 // One free meal protects the first low-heart parent; the other unfed records
 // still follow the existing starvation rule and cannot erase an achievement.
 expect(g.breedingChallenges!.completed[0]).toEqual(original);let dead=forDeath;dead.food=0;for(const g of Object.values(dead.individuals))if(g.status==='owned')g.hearts=1;dead=challengeTurn(dead);expect(dead.individuals[id].status).toBe('dead');expect(parseBackup(exportBackup(dead),dead.lastDate).breedingChallenges!.completed[0]).toEqual(original);
 expect(parseBackup(exportBackup(g),g.lastDate).breedingChallenges!.completed[0]).toEqual(original);
 g=act(g,{type:'equipChallengeTitle',challengeId:'sun'},g.lastDate);g=select(g,'white');expect(g.breedingChallenges!.equippedTitle).toBe('sun');
 expect(()=>act(g,{type:'equipChallengeTitle',challengeId:'stars'},g.lastDate)).toThrow('획득');
 g=act(g,{type:'acknowledgeChallenge',challengeId:'sun'},g.lastDate);expect(g.breedingChallenges!.completed[0].announced).toBe(true);expect(challengeFeedSlots(g)).toBe(1);
});

test('missing state safely defaults on old v10 saves; corrupt extension/duplicate rewards are rejected',()=>{
 const old=challengeParents('midnight');expect(parseBackup(exportBackup(old),old.lastDate)).toEqual(old);
 const g=select(old,'midnight');const bad=structuredClone(g);bad.breedingChallenges!.unlockTurn=9;expect(()=>validateGame(bad)).toThrow('도전');
 const unknown=structuredClone(g);(unknown.breedingChallenges as unknown as {activeId:string}).activeId='invented';expect(()=>validateGame(unknown)).toThrow('도전');
 let complete=select(challengeClutch('stars').game,'stars');for(let n=0;n<4;n++)complete=challengeTurn(complete);
 complete.breedingChallenges!.completed.push(complete.breedingChallenges!.completed[0]);expect(()=>validateGame(complete)).toThrow('도전');
});

test('legacy and wrong phenotypes never gain unmeasurable traits by name alone',()=>{
 const g=challengeParents('sun').individuals['challenge-male'];expect(evaluateBreedingChallenge(g,'sun')).toBe(true);
 for(const id of ['midnight','stars','white','monochrome'] as const)expect(evaluateBreedingChallenge(g,id)).toBe(false);
 g.name='릴잔틱 최상급 블랙';g.genetics!.appearanceVersion='5.0';for(const c of BREEDING_CHALLENGES)expect(evaluateBreedingChallenge(g,c.id)).toBe(false);
});


test('failed/infertile hatches, waiting uncollected eggs and unrelated active targets do not award',()=>{
 let {game:g}=challengeClutch('white');g=select(g,'midnight');for(let n=0;n<4;n++)g=challengeTurn(g);expect(g.breedingChallenges!.completed).toHaveLength(0);
 let waiting=challengeParents('white','waiting-challenge');waiting=act(waiting,{type:'breed',fatherId:'challenge-male',motherId:'challenge-female'},waiting.lastDate);
 waiting=challengeTurn(challengeTurn(waiting));waiting=select(waiting,'white');for(let n=0;n<10;n++)waiting=challengeTurn(waiting);
 expect(Object.values(waiting.eggs).every(e=>e.status==='incubating'&&e.care?.collectedTurn===null)).toBe(true);expect(waiting.breedingChallenges!.completed).toHaveLength(0);

 for(const cause of ['infertile','hatch'] as const){
  let pending=challengeClutch('white').game;
  for(const egg of Object.values(pending.eggs)){
   if(cause==='infertile')egg.lifecycle!.fertilized=false;
   else egg.hatchChance=0;
  }
  // Isolate the existing event processor: artificial failure inputs test its
  // negative branch, not a fabricated live/save-compatible conception record.
  pending=selectUnchecked(pending);pending.turn=6;pending.lastDate='2026-11-27';seasonEvents(pending);
  expect(Object.values(pending.eggs).every(e=>e.status==='failed')).toBe(true);expect(pending.breedingChallenges!.completed).toHaveLength(0);
 }
 function selectUnchecked(pending:ReturnType<typeof newGame>){pending.breedingChallenges={version:1,activeId:'white',selectedTurn:2,unlockTurn:12,completed:[],equippedTitle:null};return pending;}
});
