import {test,expect} from 'vitest';
import oldSaves from './fixtures/three-clutch-v6.json';
import {newGame,act} from '@/game/hardcore/play';
import {actWithTime} from '@/game/hardcore/time-source';
import {readSave,makeSave,exportBackup,parseBackup} from '@/game/hardcore/save';
import {breedingCheck} from '@/game/hardcore/breeding';
import {freeSlots,reserved} from '@/game/hardcore/survival';
import {addDays} from '@/game/hardcore/time';
import {validateGame} from '@/game/hardcore/validation';
import type {HardcoreGame} from '@/game/hardcore/model';
const DATE='2026-10-14';
const turn=(g:HardcoreGame)=>actWithTime(g,{type:'endTurn'},DATE);
function pair(capacity=4){
 let g=newGame('two-slot-pair',DATE,{initialCapacity:capacity,initialMoney:3_000_000});const [father,mother]=Object.keys(g.shop.offers);
 for(const id of [father,mother])g=act(g,{type:'buyGecko',offerId:id},DATE);g=act(g,{type:'buyFood',amount:1000},DATE);
 return {g,father,mother};
}
test.each([0,1,2])('exactly %i free slots permits breeding only from two and reports the actual shortage',available=>{
 const {g,father,mother}=pair(available+2),before=structuredClone(g),check=breedingCheck(g,father,mother);
 expect(freeSlots(g)).toBe(available);expect(check.reasons.length===0).toBe(available>=2);
 if(available<2){expect(check.reasons.join()).toContain(`${2-available}개 부족`);expect(()=>act(g,{type:'breed',fatherId:father,motherId:mother},DATE)).toThrow();expect(g).toEqual(before);}
 else {const next=act(g,{type:'breed',fatherId:father,motherId:mother},DATE);expect(reserved(next)).toBe(2);expect(freeSlots(next)).toBe(0);expect(Object.values(next.matings)[0].lifecycle!.offspring).toHaveLength(2);}
});
test('two simultaneous matings reserve disjoint pairs; no purchase or third mating can consume reserved slots',()=>{
 let {g,father,mother}=pair(8);const other=Object.values(g.shop.offers).filter(o=>o.individual.sex==='female'&&o.individual.stage==='adult').slice(0,2);
 for(const o of other)g=act(g,{type:'buyGecko',offerId:o.id},DATE);expect(freeSlots(g)).toBe(4);
 for(const id of [mother,other[0].id])g=act(g,{type:'breed',fatherId:father,motherId:id},DATE);
 expect(reserved(g)).toBe(4);expect(freeSlots(g)).toBe(0);expect(breedingCheck(g,father,other[1].id).reasons.join()).toContain('2개 부족');
 expect(()=>act(g,{type:'buyGecko',offerId:Object.keys(g.shop.offers)[0]},DATE)).toThrow('공간');
 const stored=parseBackup(exportBackup(g),DATE);expect(stored).toEqual(g);g=turn(turn(stored));
 expect(Object.values(g.eggs)).toHaveLength(4);expect(new Set(Object.keys(g.eggs)).size).toBe(4);expect(Object.values(g.matings).every(m=>m.status==='laid')).toBe(true);expect(reserved(g)).toBe(4);validateGame(g);
});
test('female rests for four turns after laying, then can begin a separate two-egg mating',()=>{
 let {g,father,mother}=pair(8);g=act(g,{type:'breed',fatherId:father,motherId:mother},DATE);
 for(let age=1;age<=6;age++){
  g=turn(g);expect(g.individuals[mother].nextBreedTurn).toBe(6);
  if(age<6){expect(breedingCheck(g,father,mother).reasons.join()).toContain('회복 기간');expect(()=>act(g,{type:'breed',fatherId:father,motherId:mother},g.lastDate)).toThrow();}
 }
 expect(breedingCheck(g,father,mother).reasons).toEqual([]);g=act(g,{type:'breed',fatherId:father,motherId:mother},g.lastDate);
 const matings=Object.values(g.matings);expect(matings).toHaveLength(2);expect(matings[0].status).toBe('laid');expect(matings[1].lifecycle!.offspring).toHaveLength(2);expect(reserved(g)).toBe(2);
 g=turn(turn(g));expect(Object.values(g.eggs)).toHaveLength(4);expect(new Set(Object.keys(g.eggs)).size).toBe(4);validateGame(g);
});
test('single-clutch observation history is bounded by its two embryos while historical records remain valid',()=>{
 let {g,father,mother}=pair();g=act(g,{type:'breed',fatherId:father,motherId:mother},DATE);const m=Object.values(g.matings)[0],knowledge=g.individuals[father].genetics!.knowledge;
 m.genetics!.updates=Array.from({length:5},()=>({id:father,before:structuredClone(knowledge),after:structuredClone(knowledge)}));expect(()=>validateGame(g)).toThrow('유전 상속');
 for(const envelope of Object.values(oldSaves))validateGame(readSave(envelope,envelope.game.lastDate));
});
test.each(['beforeLaying','laid1','laid2','laid3'] as const)('old v6 %s migration preserves existing eggs/genetics and ends unlaid extra clutches exactly once',key=>{
 const envelope=structuredClone(oldSaves[key]) as unknown as ReturnType<typeof makeSave>,original=structuredClone(envelope),old=envelope.game;
 let g=readSave(envelope,old.lastDate);const m=Object.values(g.matings)[0],prior=Object.values(old.matings)[0],laid=prior.lifecycle!.clutchesLaid;
 expect(envelope).toEqual(original);expect(g.rulesVersion).toBe(4);expect(g.turn).toBe(old.turn);expect(g.lastDate).toBe(old.lastDate);expect(g.nextClutch).toBe(old.nextClutch);
 expect(g.eggs).toEqual(old.eggs);expect(m.lifecycle!.offspring).toEqual(prior.lifecycle!.offspring.slice(0,Math.max(1,laid)*2));expect(m.genetics).toEqual(prior.genetics);expect(m.seed).toBe(prior.seed);
 for(const id of Object.keys(old.individuals)){
  const a=g.individuals[id],b=old.individuals[id];for(const k of ['genotype','genetics','potential','visualSeed','parents','lineageIds','generation','birthTurn','birthDate'] as const)expect(a[k]).toEqual(b[k]);
 }
 expect(m.status).toBe(laid?'laid':'fertilized');expect(reserved(g)).toBe((laid?0:2)+Object.values(old.eggs).filter(e=>e.status==='incubating').length);
 const lastLay=laid?2+(laid-1)*4:2;expect(g.individuals[m.parents.motherId].nextBreedTurn).toBe(lastLay+4);expect(g.individuals[m.parents.motherId].recoverUntil).toBe(addDays(DATE,(lastLay+4)*7));
 expect(readSave(makeSave(g),g.lastDate)).toBe(g);expect(parseBackup(exportBackup(g),g.lastDate)).toEqual(g);
 for(let n=0;n<14;n++)g=turn(g);expect(Object.values(g.eggs)).toHaveLength(Math.max(1,laid)*2);validateGame(g);
});
test('an older single-clutch v6 schedule already laid normalizes its marker without changing eggs or rest',()=>{
 const old=structuredClone(oldSaves.laid1.game) as unknown as HardcoreGame,m=Object.values(old.matings)[0];m.status='laid';m.resolvedDate=old.lastDate;m.lifecycle!.maxClutches=1;m.lifecycle!.offspring=m.lifecycle!.offspring.slice(0,2);
 old.individuals[m.parents.motherId].nextBreedTurn=6;old.individuals[m.parents.motherId].recoverUntil=addDays(DATE,42);
 const next=readSave(makeSave(old),old.lastDate);expect(next.eggs).toEqual(old.eggs);expect(Object.values(next.matings)[0].lifecycle!.nextLayTurn).toBe(2);expect(next.individuals[m.parents.motherId].nextBreedTurn).toBe(6);validateGame(next);
});
test('migration never overwrites the latest mating recovery with an older completed record',()=>{
 let g=readSave(structuredClone(oldSaves.laid3),DATE);for(let n=0;n<4;n++)g=turn(g);
 const first=Object.values(g.matings)[0];g=act(g,{type:'breed',...first.parents},g.lastDate);const latest=Object.values(g.matings)[1];
 g.rulesVersion=3;g.matings[first.id].lifecycle!.nextLayTurn=14;const old=makeSave(g),next=readSave(old,g.lastDate);
 expect(next.individuals[latest.parents.motherId].nextBreedTurn).toBe(20);expect(next.individuals[latest.parents.motherId].recoverUntil).toBe(addDays(DATE,140));
 expect(next.matings[latest.id].lifecycle!.offspring).toEqual(latest.lifecycle!.offspring);validateGame(next);
});
