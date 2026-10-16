import {test,expect} from 'vitest';
import {breederRankGames} from './helpers/breeder-rank-game';
import {challengeClutch,challengeTurn} from './helpers/challenge-game';
import {foodDemand,processCareAndLifespan} from '@/game/hardcore/lifecycle';
import {owned} from '@/game/hardcore/survival';
import {act,newGame} from '@/game/hardcore/play';
import {breederRank} from '@/game/hardcore/breeder-rank';
import {exportBackup,parseBackup} from '@/game/hardcore/save';
import {validateGame} from '@/game/hardcore/validation';
import {addDays} from '@/game/hardcore/time';
const states=breederRankGames();
const state=(n:number)=>structuredClone(states[n]);

test.each([0,1,2,3,4,5])('%i distinct completed goals give that many free meals, consume only the remainder and never replay',count=>{
 const game=state(count);game.food=50;
 for(const g of owned(game))g.hearts=3;
 expect(foodDemand(game)).toEqual({animals:10,exempt:count,needed:10-count,missing:0});
 const next=challengeTurn(game);expect(next.food).toBe(50-(10-count));
 expect(owned(next).every(g=>g.hearts===4&&g.lastFedDate===next.lastDate)).toBe(true);
 const snapshot=structuredClone(next);processCareAndLifespan(next);expect(next).toEqual(snapshot);
 expect(next.breedingChallenges).toEqual(game.breedingChallenges);validateGame(next);
});

test.each([0,2,5])('%i livestock cap the five-goal allowance; unused meals never turn into stock or carry over',count=>{
 let game=state(5);
 for(const g of owned(game).slice(count))game=act(game,{type:'sell',id:g.id},game.lastDate);
 game.food=0;expect(foodDemand(game)).toEqual({animals:count,exempt:count,needed:0,missing:0});
 for(let n=0;n<3;n++)game=challengeTurn(game);
 expect(game.food).toBe(0);expect(owned(game)).toHaveLength(count);expect(owned(game).every(g=>g.hearts===5)).toBe(true);
 expect(breederRank(game).completed).toBe(5);validateGame(game);
});

test('free and paid feeding share deterministic low-heart priority; unfed animals retain the starvation rule',()=>{
 const game=state(2),animals=owned(game).sort((a,b)=>a.id.localeCompare(b.id));game.food=1;
 animals.forEach((g,i)=>g.hearts=i<2?1:2);
 expect(foodDemand(game)).toEqual({animals:10,exempt:2,needed:8,missing:7});
 const next=challengeTurn(game);expect(next.food).toBe(0);
 for(let i=0;i<10;i++)expect(next.individuals[animals[i].id].hearts).toBe(i<2?2:i===2?3:1);
 expect(next.notices.join(' ')).toContain('자동 급여 3마리 · 사료 1개 소비 · 먹이 면제 2마리 · 7마리 미급여');
 const starving=state(2);starving.food=0;for(const g of owned(starving))g.hearts=1;
 const after=challengeTurn(starving);expect(owned(after)).toHaveLength(2);expect(owned(after).every(g=>g.hearts===2)).toBe(true);
 expect(Object.values(after.individuals).filter(g=>g.status==='dead')).toHaveLength(8);
 expect(breederRank(after).completed).toBe(2);validateGame(after);
});

test('earned hatch reward begins next turn, pending babies/eggs do not eat, receipt adds a normal feeding target',()=>{
 let {game,eggId}=challengeClutch('white');game.food=8;
 game=act(game,{type:'selectChallenge',challengeId:'white'},game.lastDate);
 for(let n=0;n<4;n++)game=challengeTurn(game);
 expect(game.breedingChallenges!.completed).toHaveLength(1);expect(game.food).toBe(0);
 expect(foodDemand(game)).toEqual({animals:2,exempt:1,needed:1,missing:1});
 game=act(game,{type:'receiveHatchling',eggId},game.lastDate);
 expect(foodDemand(game)).toEqual({animals:3,exempt:1,needed:2,missing:2});
 game.food=2;game=challengeTurn(game);expect(game.food).toBe(0);expect(owned(game).every(g=>g.hearts===5)).toBe(true);validateGame(game);
});

test('v10 legacy reward fields restore as working distinct-goal exemptions; sale/rename and selection cannot erase them; new game resets',()=>{
 let game=state(3);const records=structuredClone(game.breedingChallenges!.completed);
 game=parseBackup(exportBackup(game),game.lastDate);expect(foodDemand(game).exempt).toBe(3);
 game=act(game,{type:'rename',id:owned(game)[0].id,name:'새 이름'},game.lastDate);
 game=act(game,{type:'sell',id:owned(game)[0].id},game.lastDate);
 game=act(game,{type:'selectChallenge',challengeId:'monochrome'},game.lastDate);
 expect(foodDemand(game).exempt).toBe(3);expect(game.breedingChallenges!.completed).toEqual(records);
 expect(parseBackup(exportBackup(game),game.lastDate)).toEqual(game);
 const duplicate=structuredClone(game);duplicate.breedingChallenges!.completed.push(duplicate.breedingChallenges!.completed[0]);expect(foodDemand(duplicate).exempt).toBe(3);
 expect(()=>validateGame(duplicate)).toThrow('도전');
 const fresh=newGame('fresh-feed',game.lastDate);expect(foodDemand(fresh)).toEqual({animals:0,exempt:0,needed:0,missing:0});
});

test('free food does not prevent natural death and a deceased founder never removes the permanent reward',()=>{
 let game=state(1);const target=owned(game)[0];
 for(const g of owned(game).slice(1))game=act(game,{type:'sell',id:g.id},game.lastDate);
 const g=game.individuals[target.id];g.birthTurn=game.turn+1-90;g.birthDate=addDays(game.startedDate,g.birthTurn*7);g.stage='adult';
 game.food=0;game=challengeTurn(game);
 expect(game.individuals[target.id]).toMatchObject({status:'dead',deathCause:'natural',hearts:0});
 expect(game.food).toBe(0);expect(breederRank(game).completed).toBe(1);expect(foodDemand(game).exempt).toBe(0);validateGame(game);
});
