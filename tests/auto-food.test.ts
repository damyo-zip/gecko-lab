import {expect,test} from 'vitest';
import {newForgeGame,act} from '@/game/hardcore/play';
import {actWithTime} from '@/game/hardcore/time-source';
import {foodDemand} from '@/game/hardcore/lifecycle';
import {owned} from '@/game/hardcore/survival';
import {exportBackup,parseBackup} from '@/game/hardcore/save';
import {breederRankGames} from './helpers/breeder-rank-game';

const DATE='2026-10-23';
function fixture(){
 let game=newForgeGame('auto-food-review',DATE,{initialMoney:10_000_000});
 for(const offerId of Object.keys(game.shop.offers))game=act(game,{type:'buyGecko',offerId},DATE);
 game.food=1;return game;
}
const original=fixture();
test.each([false,true])('automatic purchase %s does not buy with sufficient stock',autoBuyFood=>{
 const game=structuredClone(original);game.food=20;
 const next=actWithTime(game,{type:'endTurn',autoBuyFood},DATE);
 expect(next.money).toBe(game.money);expect(next.food).toBe(20-foodDemand(game).needed);expect(next.turn).toBe(game.turn+1);
});
test('OFF retains shortage care; ON buys exactly the shortfall using the current unit price before care',()=>{
 const game=structuredClone(original);game.rules.foodUnitPrice=1379;
 const before=structuredClone(game),missing=foodDemand(game).missing;
 const off=actWithTime(game,{type:'endTurn'},DATE),on=actWithTime(game,{type:'endTurn',autoBuyFood:true},DATE);
 expect(off.money).toBe(game.money);expect(owned(off).filter(g=>g.hearts<5)).toHaveLength(missing);
 expect(on.money).toBe(game.money-missing*1379);expect(on.food).toBe(0);expect(owned(on).every(g=>g.hearts===5)).toBe(true);
 const manual=actWithTime(act(game,{type:'buyFood',amount:missing},DATE),{type:'endTurn'},DATE);
 expect({...on,revision:manual.revision}).toEqual(manual);expect(game).toEqual(before);
 expect(parseBackup(exportBackup(on),DATE)).toEqual(on);
});
test('insufficient funds reject the whole automatic action without buying partly or advancing',()=>{
 const game=structuredClone(original);game.money=foodDemand(game).missing*game.rules.foodUnitPrice-1;
 const snapshot=structuredClone(game);
 expect(()=>actWithTime(game,{type:'endTurn',autoBuyFood:true},DATE)).toThrow('사료 부족');expect(game).toEqual(snapshot);
 const skipped=actWithTime(game,{type:'endTurn',autoBuyFood:false},DATE);
 expect(skipped.money).toBe(game.money);expect(skipped.turn).toBe(game.turn+1);
});
test('exact funds buy in full; later turns recompute demand; stale turn requests never charge again',()=>{
 const game=structuredClone(original);game.money=foodDemand(game).missing*game.rules.foodUnitPrice;
 const action={type:'endTurn' as const,autoBuyFood:true,expectedTurn:game.turn};
 const next=actWithTime(game,action,DATE);expect(next.money).toBe(0);expect(next.turn).toBe(game.turn+1);
 expect(()=>actWithTime(next,action,DATE)).toThrow('이미 처리된 턴');expect(next.money).toBe(0);
 next.money=10_000;const demand=foodDemand(next),second=actWithTime(next,{type:'endTurn',autoBuyFood:true},DATE);
 expect(second.money).toBe(next.money-demand.missing*next.rules.foodUnitPrice);expect(second.turn).toBe(next.turn+1);
});
test('completed challenge exemptions and external parents use the existing food demand unchanged',()=>{
 const game=structuredClone(breederRankGames()[3]);game.food=2;
 const demand=foodDemand(game);expect(demand.exempt).toBe(3);
 const next=actWithTime(game,{type:'endTurn',autoBuyFood:true},game.lastDate);
 expect(next.money).toBe(game.money-demand.missing*game.rules.foodUnitPrice);expect(next.food).toBe(0);
 expect(owned(next).every(g=>g.hearts===5)).toBe(true);
 const empty=newForgeGame('no-food-demand',DATE);empty.money=0;
 expect(actWithTime(empty,{type:'endTurn',autoBuyFood:true},DATE).money).toBe(0);
});
