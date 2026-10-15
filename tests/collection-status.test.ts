import {test,expect} from 'vitest';
import {collectionStatus} from '@/components/hardcore/collection-status';
import {newGame,act} from '@/game/hardcore/play';
import {actWithTime} from '@/game/hardcore/time-source';
import {breedingCheck} from '@/game/hardcore/breeding';
import {breedingRisk} from '@/game/hardcore/breeding-risk';
import {freeSlots,owned,reserved} from '@/game/hardcore/survival';
import {exportBackup,parseBackup} from '@/game/hardcore/save';
import {addDays} from '@/game/hardcore/time';
import type {HardcoreGame} from '@/game/hardcore/model';
const DATE='2026-10-14';
function pair(capacity=20){
  let game=newGame('collection-status',DATE,{initialCapacity:capacity,initialMoney:2_000_000});
  const [father,mother]=Object.keys(game.shop.offers);
  for(const id of [father,mother])game=act(game,{type:'buyGecko',offerId:id},DATE);
  game=act(game,{type:'buyFood',amount:100},DATE);game=act(game,{type:'refreshShop'},DATE);return {game,father,mother};
}
const end=(game:HardcoreGame)=>actWithTime(game,{type:'endTurn'},DATE);
function mate(game:HardcoreGame,father:string,mother:string){return act(game,{type:'breed',fatherId:father,motherId:mother,riskAcknowledgement:breedingRisk(game,game.individuals[father],game.individuals[mother]).acknowledgement},DATE);}

test('growth is 2 → 1 → adult/ready on the actual turn engine and survives backup',()=>{
  let {game,father,mother}=pair();const g=game.individuals[father];g.stage='juvenile';g.birthTurn=game.turn-10;g.birthDate=addDays(DATE,-70);g.nextBreedTurn=2;g.recoverUntil=addDays(DATE,14);
  expect(collectionStatus(game,g)).toMatchObject({kind:'growth',label:'성장 중 · 2턴',remainingTurns:2});
  game=end(game);game=parseBackup(exportBackup(game),DATE);expect(collectionStatus(game,game.individuals[father]).label).toBe('성장 중 · 1턴');
  game=end(game);expect(game.individuals[father].stage).toBe('adult');expect(collectionStatus(game,game.individuals[father])).toMatchObject({kind:'ready',action:'breed'});expect(breedingCheck(game,father,mother).reasons).toEqual([]);
});
test('actual pending laying is distinct from rest, which ends exactly with engine recovery',()=>{
  let {game,father,mother}=pair();game=mate(game,father,mother);
  expect(collectionStatus(game,game.individuals[mother]).label).toBe('산란 대기 · 2턴');game=end(game);
  expect(collectionStatus(game,game.individuals[mother]).label).toBe('산란 대기 · 1턴');game=end(game);
  expect(collectionStatus(game,game.individuals[mother]).label).toBe('휴식기 · 4턴');game=end(end(game));
  expect(collectionStatus(game,game.individuals[mother]).label).toBe('휴식기 · 2턴');game=end(game);
  expect(collectionStatus(game,game.individuals[mother]).label).toBe('휴식기 · 1턴');game=end(game);
  expect(collectionStatus(game,game.individuals[mother])).toMatchObject({kind:'ready',action:'breed'});expect(breedingCheck(game,father,mother).reasons).toEqual([]);
});
test('growth stays the priority over full housing, and maturity rechecks space',()=>{
  let {game,father}=pair(2);const g=game.individuals[father];g.stage='juvenile';g.birthTurn=-11;g.birthDate=addDays(DATE,-77);g.nextBreedTurn=1;
  expect(freeSlots(game)).toBe(0);expect(collectionStatus(game,g).label).toBe('성장 중 · 1턴');game=end(game);
  expect(collectionStatus(game,game.individuals[father])).toMatchObject({kind:'space',action:'expand'});
});
test('a finished rest rechecks space rather than unconditionally promising breeding',()=>{
  let {game,father,mother}=pair(4);game=mate(game,father,mother);game=end(end(end(end(end(game)))));
  expect(collectionStatus(game,game.individuals[mother]).label).toBe('휴식기 · 1턴');game=end(game);
  game.capacity=owned(game).length+reserved(game)+1;
  expect(collectionStatus(game,game.individuals[mother])).toMatchObject({kind:'space',action:'expand'});expect(breedingCheck(game,father,mother).reasons.join(' ')).toContain('1개 부족');
});
test('an unrelated cooldown is not mislabeled reproductive rest',()=>{
  const {game,father}=pair();game.individuals[father].nextBreedTurn=2;
  expect(collectionStatus(game,game.individuals[father])).toMatchObject({kind:'waiting',label:'교배 대기 · 2턴',remainingTurns:2});
});
test('manual eligibility follows stored nextBreedTurn, not a stale legacy date',()=>{
  const {game,father,mother}=pair();game.individuals[mother].recoverUntil=addDays(DATE,70);
  expect(collectionStatus(game,game.individuals[mother]).kind).toBe('ready');expect(breedingCheck(game,father,mother).reasons).toEqual([]);
});
test('care, retirement and non-owned records cannot open the ready shortcut',()=>{
  const {game,father}=pair();const g=game.individuals[father];g.hearts=2;expect(collectionStatus(game,g).kind).toBe('care');
  g.hearts=5;g.birthTurn=-60;expect(collectionStatus(game,g).kind).toBe('retired');expect(collectionStatus(game,g).action).toBeUndefined();
  g.status='sold';expect(collectionStatus(game,g).kind).toBe('unavailable');
});
test('status queries and restoration do not add counters or change reproductive/genetic records',()=>{
  let {game,father,mother}=pair();game=mate(game,father,mother);game=end(end(end(end(game))));
  const before=structuredClone(game);const status=collectionStatus(game,game.individuals[mother]);
  expect(collectionStatus(parseBackup(exportBackup(game),DATE),game.individuals[mother])).toEqual(status);expect(status.label).toBe('휴식기 · 2턴');expect(game).toEqual(before);
});
