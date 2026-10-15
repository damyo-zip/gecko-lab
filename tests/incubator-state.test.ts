import {tendBrood} from './helpers/tend-brood';
import {test,expect} from 'vitest';
import {incubatorFixture} from '../e2e/fixtures/incubator-reference';
import {incubatorState,eggProgress} from '@/components/hardcore/incubator-state';
import {newGame,act} from '@/game/hardcore/play';
import {actWithTime} from '@/game/hardcore/time-source';
import {parseBackup,exportBackup} from '@/game/hardcore/save';
import {freeSlots,owned,reserved} from '@/game/hardcore/survival';
const turn=(g:ReturnType<typeof newGame>)=>actWithTime(g,{type:'endTurn'},g.lastDate);
test('six actual slots partition into four active eggs and two usable empty slots without changing game records',()=>{
 const g=incubatorFixture(),before=structuredClone(g),s=incubatorState(g);
 expect(s).toMatchObject({total:6,available:2,booked:0});expect(s.active).toHaveLength(4);expect(s.slots).toHaveLength(6);expect(g).toEqual(before);
 expect(s.slots.filter(slot=>slot.kind==='empty')).toHaveLength(freeSlots(g));expect(s.total).toBe(g.capacity-owned(g).length);
});
test('staggered real clutches report 7/21 days and 1/3 turns from their own saved due turns',()=>{
 const g=incubatorFixture(),s=incubatorState(g);expect(s.nextProgress).toEqual({remainingDays:7,remainingTurns:1,percent:75});
 expect(s.active.map(e=>eggProgress(g,e).remainingDays)).toEqual([7,7,21,21]);expect(s.active.map(e=>eggProgress(g,e).percent)).toEqual([75,75,25,25]);
});
test('unlaid two-slot reservations are represented as reserved slots, never usable empties or eggs',()=>{
 let g=newGame('reserved-ui','2026-10-14',{initialCapacity:4,initialMoney:3_000_000});const [father,mother]=Object.keys(g.shop.offers);
 for(const id of [father,mother])g=act(g,{type:'buyGecko',offerId:id},g.lastDate);g=act(g,{type:'buyFood',amount:100},g.lastDate);
 g=act(g,{type:'breed',fatherId:father,motherId:mother},g.lastDate);
 let s=incubatorState(g);expect(s).toMatchObject({total:2,available:0,booked:2});expect(s.slots.every(slot=>slot.kind==='reserved')).toBe(true);expect(s.active).toHaveLength(0);
 g=turn(turn(g));expect(incubatorState(g).slots.every(slot=>slot.kind==='reserved')).toBe(true);g=act(g,{type:'collectEggs',matingId:Object.keys(g.matings)[0]},g.lastDate);s=incubatorState(g);expect(s).toMatchObject({total:2,available:0,booked:0});expect(s.active).toHaveLength(2);expect(s.slots.every(slot=>slot.kind==='egg')).toBe(true);expect(reserved(g)).toBe(2);
});
test('resolved eggs hold their slots until pickup or removal; received animals then occupy housing',()=>{
 let g=incubatorFixture();for(let n=0;n<3;n++)g=turn(g);
 expect(incubatorState(g).occupied).toHaveLength(4);expect(freeSlots(g)).toBe(2);g=tendBrood(g);
 const s=incubatorState(g),hatched=Object.values(g.eggs).filter(e=>e.status==='hatched').length;
 expect(s.active).toHaveLength(0);expect(s.nextProgress).toBeNull();expect(s.available).toBe(6-hatched);expect(s.total).toBe(s.available);expect(s.slots.every(slot=>slot.kind==='empty')).toBe(true);
 for(const e of Object.values(g.eggs))expect(eggProgress(g,e)).toMatchObject({remainingTurns:0,remainingDays:0,percent:100});
 expect(incubatorState(parseBackup(exportBackup(g),g.lastDate))).toEqual(s);
});
test('slot count comes from saved capacity even when it differs from the six-slot reference example',()=>{
 const g=newGame('large-ui','2026-10-14',{initialCapacity:3000});const s=incubatorState(g);expect(s.total).toBe(3000);expect(s.available).toBe(3000);expect(s.slots).toHaveLength(3000);expect(s.hatchChance).toBe(g.rules.hatchChance);
});
