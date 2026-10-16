import {readArchiveSave} from '@/game/hardcore/save';
import {test,expect} from 'vitest';
import {newGame,act} from '@/game/hardcore/play';
import {actWithTime} from '@/game/hardcore/time-source';
import {breedingRisk} from '@/game/hardcore/breeding-risk';
import {reserved,owned,freeSlots} from '@/game/hardcore/survival';
import {exportBackup,parseBackup,makeSave,readSave} from '@/game/hardcore/save';
import {validateGame} from '@/game/hardcore/validation';
import {eggFailure} from '@/game/hardcore/egg-outcome';
import {incubatorState,eggProgress} from '@/components/hardcore/incubator-state';
import type {HardcoreGame} from '@/game/hardcore/model';
const turn=(g:HardcoreGame)=>actWithTime(g,{type:'endTurn'},g.lastDate);
function start(seed='manual-care'){
 let g=newGame(seed,'2026-10-15',{initialMoney:3_000_000,initialCapacity:4});
 const [fatherId,motherId]=Object.keys(g.shop.offers);
 for(const offerId of [fatherId,motherId])g=act(g,{type:'buyGecko',offerId},g.lastDate);
 g=act(g,{type:'buyFood',amount:300},g.lastDate);
 const risk=breedingRisk(g,g.individuals[fatherId],g.individuals[motherId]);
 g=act(g,{type:'breed',fatherId,motherId,riskAcknowledgement:risk.acknowledgement},g.lastDate);
 return {g,fatherId,motherId,matingId:Object.keys(g.matings)[0]};
}
const restore=(g:HardcoreGame)=>parseBackup(exportBackup(g),g.lastDate);
test('waiting pair reserves exactly two slots across turns and collection starts a full four-turn countdown once',()=>{
 let {g,matingId}=start();expect(reserved(g)).toBe(2);expect(freeSlots(g)).toBe(0);
 g=turn(turn(g));const embryos=Object.values(g.eggs).map(e=>structuredClone(e.embryo));
 expect(Object.values(g.eggs).every(e=>e.care?.collectedTurn===null)).toBe(true);
 for(let n=0;n<7;n++)g=turn(restore(g));
 expect(Object.values(g.eggs).every(e=>e.status==='incubating'&&e.care?.collectedTurn===null)).toBe(true);
 expect(reserved(g)).toBe(2);expect(owned(g)).toHaveLength(2);
 for(const e of Object.values(g.eggs))expect(eggProgress(g,e)).toEqual({remainingTurns:4,remainingDays:28,percent:0});
 g=act(g,{type:'collectEggs',matingId},g.lastDate);const collected=g.turn;
 expect(Object.values(g.eggs).every(e=>e.care?.collectedTurn===collected&&e.lifecycle?.dueTurn===collected+4)).toBe(true);
 for(const [i,e] of Object.values(g.eggs).entries())for(const k of ['genotype','genetics','visualSeed','potential','sex'] as const)expect(e.embryo[k]).toEqual(embryos[i][k]);
 const eggs=structuredClone(g.eggs);g=act(g,{type:'collectEggs',matingId},g.lastDate);expect(g.eggs).toEqual(eggs);
 for(let n=0;n<3;n++)g=turn(g);
 expect(Object.values(g.eggs).every(e=>e.status==='incubating')).toBe(true);
 g=turn(g);expect(Object.values(g.eggs).every(e=>e.status!=='incubating')).toBe(true);expect(owned(g)).toHaveLength(2);expect(reserved(g)).toBe(2);expect(freeSlots(g)).toBe(0);
 expect(restore(g)).toEqual(g);
});
test('each hatched baby stays unowned until one-time pickup; real birth age and genes survive delayed collection',()=>{
 let {g,matingId}=start();g=turn(turn(g));g=act(g,{type:'collectEggs',matingId},g.lastDate);
 for(let n=0;n<4;n++)g=turn(g);
 const successes=Object.values(g.eggs).filter(e=>e.status==='hatched');expect(successes.length).toBeGreaterThan(0);
 for(let n=0;n<12;n++)g=turn(restore(g));
 for(const e of successes){expect(g.individuals[e.embryo.id]).toBeUndefined();
  g=act(g,{type:'receiveHatchling',eggId:e.id},g.lastDate);
  expect(g.individuals[e.embryo.id]).toMatchObject({birthTurn:e.embryo.birthTurn,visualSeed:e.embryo.visualSeed,genotype:e.embryo.genotype,stage:'adult'});
  const count=owned(g).length;g=act(g,{type:'receiveHatchling',eggId:e.id},g.lastDate);expect(owned(g)).toHaveLength(count);
 }
 expect(restore(g)).toEqual(g);expect(g.notices).toEqual([]);
});
test('infertile and other failed eggs persist and reserve until one-tap removal, without rerolling outcomes',()=>{
 let found=false;
 for(let seed=0;seed<80&&!found;seed++){
  let {g,matingId}=start('failed-'+seed);g=turn(turn(g));g=act(g,{type:'collectEggs',matingId},g.lastDate);
  for(let n=0;n<4;n++)g=turn(g);
  const e=Object.values(g.eggs).find(e=>e.lifecycle?.failure==='infertile');if(!e)continue;found=true;
  for(let n=0;n<5;n++)g=turn(restore(g));expect(reserved(g)).toBe(2);expect(g.eggs[e.id].lifecycle!.failure).toBe(eggFailure(e));
  g=act(g,{type:'removeFailedEgg',eggId:e.id},g.lastDate);expect(reserved(g)).toBe(1);expect(freeSlots(g)).toBe(1);expect(g.individuals[e.embryo.id]).toBeUndefined();
  g=act(g,{type:'removeFailedEgg',eggId:e.id},g.lastDate);expect(freeSlots(g)).toBe(1);expect(restore(g)).toEqual(g);
 }
 expect(found).toBe(true);
});
test('v9 migration keeps existing incubation dates and settled offspring, with no pending rewards re-created',()=>{
 let {g,matingId}=start();g.saveVersion=9;g=turn(turn(g));
 const old=structuredClone(g),migrated=readArchiveSave(makeSave(g),g.lastDate);
 expect(g).toEqual(old);expect(migrated.saveVersion).toBe(10);
 for(const e of Object.values(g.eggs))expect(migrated.eggs[e.id]).toMatchObject({...e,care:{version:1,collectedTurn:2,settledTurn:null}});
 for(let n=0;n<4;n++)g=turn(g);const settled=readArchiveSave(makeSave(g),g.lastDate);
 expect(settled.individuals).toEqual(g.individuals);expect(settled.eggs).toEqual(g.eggs);expect(Object.keys(settled.matings)).toContain(matingId);
});
test('tampered half-clutch collection, premature claim and reservation overflow are rejected',()=>{
 let {g,matingId}=start();g=turn(turn(g));const id=Object.keys(g.eggs)[0];
 expect(()=>act(g,{type:'receiveHatchling',eggId:id},g.lastDate)).toThrow();
 expect(()=>act(g,{type:'removeFailedEgg',eggId:id},g.lastDate)).toThrow();
 let bad=structuredClone(g);bad.eggs[id].care!.collectedTurn=bad.turn;expect(()=>validateGame(bad)).toThrow();
 bad=structuredClone(g);bad.capacity=3;expect(()=>validateGame(bad)).toThrow();
 g=act(g,{type:'collectEggs',matingId},g.lastDate);expect(restore(g)).toEqual(g);
 bad=structuredClone(g);bad.eggs[id].embryo.nextBreedTurn++;expect(()=>validateGame(bad)).toThrow();
 bad=structuredClone(g);bad.eggs[id].embryo.lastProcessedTurn!++;expect(()=>validateGame(bad)).toThrow();
});

test('two concurrent mothers cannot spend each other’s reserved slots, even before egg collection',async()=>{
 const {referenceHomeGame}=await import('../e2e/fixtures/reference-home');
 let g=referenceHomeGame();g.capacity=10;g.food=300;
 const [motherId,fatherId,,otherMotherId]=Object.keys(g.individuals);
 for(const id of [motherId,otherMotherId]){
  const risk=breedingRisk(g,g.individuals[fatherId],g.individuals[id]);
  g=act(g,{type:'breed',fatherId,motherId:id,riskAcknowledgement:risk.acknowledgement},g.lastDate);
 }
 expect(reserved(g)).toBe(4);expect(freeSlots(g)).toBe(0);
 g=turn(turn(g));expect(Object.values(g.eggs)).toHaveLength(4);expect(incubatorState(g).waiting).toHaveLength(4);
 g=act(g,{type:'collectEggs',matingId:Object.keys(g.matings)[0]},g.lastDate);
 expect(incubatorState(g).active).toHaveLength(2);expect(incubatorState(g).waiting).toHaveLength(2);expect(reserved(g)).toBe(4);expect(freeSlots(g)).toBe(0);
 expect(restore(g)).toEqual(g);
});
test('multiple waiting clutches on one mother collect one pair per action, retaining the other pair',()=>{
 let {g,fatherId,motherId,matingId}=start('multiple-waiting');g.capacity=6;
 for(let n=0;n<6;n++)g=turn(g);
 const risk=breedingRisk(g,g.individuals[fatherId],g.individuals[motherId]);
 g=act(g,{type:'breed',fatherId,motherId,riskAcknowledgement:risk.acknowledgement},g.lastDate);g=turn(turn(g));
 expect(Object.values(g.eggs).filter(e=>e.care?.collectedTurn===null)).toHaveLength(4);
 g=act(g,{type:'collectEggs',matingId},g.lastDate);
 expect(Object.values(g.eggs).filter(e=>e.care?.collectedTurn===null)).toHaveLength(2);expect(incubatorState(g).active).toHaveLength(2);expect(reserved(g)).toBe(4);
 expect(restore(g)).toEqual(g);
});
test('laid eggs remain collectible from their recorded clutch after the mother is sold',()=>{
 let {g,motherId,matingId}=start('sold-mother');g=turn(turn(g));g=act(g,{type:'sell',id:motherId},g.lastDate);
 expect(g.individuals[motherId].status).toBe('sold');expect(reserved(g)).toBe(2);
 g=act(g,{type:'collectEggs',matingId},g.lastDate);for(let n=0;n<4;n++)g=turn(g);
 for(const e of Object.values(g.eggs))if(e.status==='hatched'){
  g=act(g,{type:'receiveHatchling',eggId:e.id},g.lastDate);expect(g.individuals[e.embryo.id].parents!.motherId).toBe(motherId);
 }
 expect(restore(g)).toEqual(g);
});
