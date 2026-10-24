import {describe,it,expect} from 'vitest';
import {currentChallengeClutch} from './helpers/current-challenge-game';
import {act} from '../src/game/hardcore/play';
import {actWithTime} from '../src/game/hardcore/time-source';
import {compactGame} from '../src/game/hardcore/compact';
import {validateGame} from '../src/game/hardcore/validation';
import {checksum,makeSave,readMonthlySave} from '../src/game/hardcore/save';
import {createNewGame} from '../src/game/play';
import {makeSave as legacySave} from '../src/game/save';
import {migrateV2} from '../src/game/hardcore/create';
import {catchUp} from '../src/game/hardcore/calendar';
import {startMating} from '../src/game/hardcore/breeding';
const turn=(g:import('../src/game/hardcore/model').HardcoreGame)=>actWithTime(g,{type:'endTurn'},g.lastDate);
function settled(){let g=currentChallengeClutch('lilly-dalmatian',true).game;for(let n=0;n<3;n++)g=turn(g);for(const e of Object.values(g.eggs))g=act(g,{type:e.status==='hatched'?'receiveHatchling':'removeFailedEgg',eggId:e.id},g.lastDate);return g;}
describe('compact current game',()=>{
 it('preserves conception, trophies, newborn DNA, money and care while removing completed duplicate embryos',()=>{
  const source=settled(),before=checksum(source),result=compactGame(source);
  expect(checksum(source)).toBe(before);expect(result.history.length).toBeGreaterThan(0);expect(Object.keys(result.game.matings)).toHaveLength(0);
  expect(result.game.individuals).toEqual(source.individuals);expect(result.game.breedingChallenges).toEqual(source.breedingChallenges);expect(result.game.money).toBe(source.money);expect(result.game.food).toBe(source.food);
  validateGame(result.game);expect(readMonthlySave(makeSave(result.game),result.game.lastDate)).toEqual(result.game);
  const again=compactGame(result.game);expect(again.history).toEqual([]);expect(again.game).toEqual(result.game);validateGame(turn(result.game));
 },20_000);
 it('keeps pending collection, incubation and unreceived babies completely intact',()=>{
  let source=currentChallengeClutch('lilly-dalmatian',true).game;
  for(let n=0;n<4;n++){const compact=compactGame(source);expect(compact.game.eggs).toEqual(source.eggs);expect(compact.game.matings).toEqual(source.matings);validateGame(compact.game);source=turn(source);}
 });
 it('archives sold parents as direct-parent facts, preserves offspring, and never pays a sale twice',()=>{
  let source=settled();const m=Object.values(source.matings)[0],id=m.parents.fatherId;
  source=act(source,{type:'sell',id},source.lastDate);const result=compactGame(source);validateGame(result.game);
  expect(result.game.individuals[id].status).toBe('pedigree');expect(result.game.individuals[id].parents).toBeNull();expect(result.game.money).toBe(source.money);expect(result.history.some(e=>e.kind==='sale')).toBe(true);
  expect(()=>act(result.game,{type:'sell',id},source.lastDate)).toThrow();
 });
});

it('preserves pre-season offspring through migration, archival, replay validation and another monthly turn',()=>{
 let old=migrateV2(legacySave(createNewGame('compact-old-clutch')),'2026-10-13');
 old.rules={...old.rules,fertilizationChance:1,hatchChance:1};old.food=1000;old.capacity=20;
 const [father,mother]=Object.values(old.individuals);startMating(old,father.id,mother.id);
 old=catchUp(old,'2026-10-16');const source=readMonthlySave(makeSave(old),'2026-10-24');
 const result=compactGame(source);validateGame(result.game);
 expect(Object.keys(result.game.matings)).toHaveLength(0);expect(Object.values(result.game.compact!.origins).every(o=>o.rulesVersion===2)).toBe(true);
 for(const g of Object.values(source.individuals).filter(g=>g.status==='owned'))expect(result.game.individuals[g.id]).toEqual(g);
 expect(readMonthlySave(makeSave(result.game),source.lastDate)).toEqual(result.game);validateGame(turn(result.game));
});

it('rejects forged compact birth seeds, sex, DNA and parentage even with a new checksum',()=>{
 const game=compactGame(settled()).game,id=Object.keys(game.compact!.births)[0];expect(id).toBeTruthy();
 for(const change of [
  (g:typeof game)=>{g.compact!.births[id].seed+='fake';},
  (g:typeof game)=>{g.individuals[id].sex=g.individuals[id].sex==='male'?'female':'male';},
  (g:typeof game)=>{g.individuals[id].visualSeed+='fake';},
  (g:typeof game)=>{g.individuals[id].parents!.fatherId=g.individuals[id].parents!.motherId;},
 ]){const bad=structuredClone(game);change(bad);expect(()=>makeSave(bad)).toThrow();}
},20_000);

import {readFileSync} from 'node:fs';
const historic=JSON.parse(readFileSync(new URL('./fixtures/three-clutch-v6.json',import.meta.url),'utf8'));
it.each(Object.keys(historic))('preserves the validated historical %s backup during compact migration',key=>{
 const source=readMonthlySave(historic[key],'2026-10-24'),result=compactGame(source);validateGame(result.game);
 for(const g of Object.values(source.individuals))if(g.status==='owned'){
  expect(result.game.individuals[g.id].genetics).toEqual(g.genetics);expect(result.game.individuals[g.id].visualSeed).toBe(g.visualSeed);expect(result.game.individuals[g.id].birthTurn).toBe(g.birthTurn);
 }
 expect(result.game.money).toBe(source.money);expect(result.game.food).toBe(source.food);
 expect(readMonthlySave(makeSave(result.game),source.lastDate)).toEqual(result.game);
});
it('keeps a bought-and-resold current offer until that listing is refreshed',()=>{
 let game=compactGame(currentChallengeClutch('lilly-dalmatian',true).game).game;
 const offer=Object.values(game.shop.offers)[0];game.money=3_000_000;
 game=act(game,{type:'buyGecko',offerId:offer.id},game.lastDate);game=act(game,{type:'sell',id:offer.id},game.lastDate);
 const now=compactGame(game);validateGame(now.game);expect(now.game.individuals[offer.id].status).toBe('sold');
 const later=compactGame(turn(now.game));validateGame(later.game);expect(later.game.individuals[offer.id]).toBeUndefined();
});
