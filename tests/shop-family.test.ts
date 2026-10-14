import {test,expect} from 'vitest';
import {newGame,act,synchronize} from '@/game/hardcore/play';
import {newGame as oldGame} from './helpers/v6-hardcore';
import {newGame as v5Game} from './helpers/legacy-hardcore';
import {actWithTime} from '@/game/hardcore/time-source';
import {makeSave,readSave,parseBackup,exportBackup,checksum,readV6Save} from '@/game/hardcore/save';
import {validateGame} from '@/game/hardcore/validation';
import {owned,freeSlots} from '@/game/hardcore/survival';
import {foodDemand} from '@/game/hardcore/lifecycle';
import {advancedSafety} from '@/game/hardcore/genetics';
import {inherit} from '@/genetics/advanced/inheritance';
import {inheritPoly} from '@/genetics/advanced/polygenic';
import {carrierProbability} from '@/genetics/advanced/inference';
import {valueGecko,MARKET} from '@/game/hardcore/market';
import {ancestors} from '@/game/hardcore/lineage';
import type {HardcoreGame} from '@/game/hardcore/model';
const DATE='2026-10-14',end=(g:HardcoreGame)=>actWithTime(g,{type:'endTurn'},DATE);
const stocked=(seed='real-market')=>newGame(seed,DATE,{initialMoney:100_000_000,initialCapacity:100});

test('four deterministic real descendants inherit all Mendelian and polygenic alleles, unique visuals and actual market prices',()=>{
 for(let n=0;n<30;n++){
  const g=stocked('family-'+n);expect(g).toEqual(stocked('family-'+n));expect(Object.values(g.shop.offers)).toHaveLength(4);
  for(const o of Object.values(g.shop.offers)){
   const f=o.family!,c=o.individual.genetics!.genome!;expect(advancedSafety(f.father,f.mother)).toEqual([]);
   expect(c.mendelian).toEqual(inherit(f.father.genetics!.genome!.mendelian,f.mother.genetics!.genome!.mendelian,f.seed));
   expect(c.polygenic).toEqual(inheritPoly(f.father.genetics!.genome!.polygenic,f.mother.genetics!.genome!.polygenic,f.seed));
   expect(o.individual.parents).toEqual({fatherId:f.father.id,motherId:f.mother.id});expect(o.individual.generation).toBe(2);
   expect(o.individual.visualSeed).not.toBe(f.father.visualSeed);expect(o.individual.visualSeed).not.toBe(f.mother.visualSeed);
   expect(o.askPrice).toBe(valueGecko(o.individual).ask);expect(o.marketBase).toBe(valueGecko(o.individual).marketBase);
   for(const p of [f.father,f.mother])if(!p.genotype.loci.axanthic.every(a=>a==='ax'))expect(carrierProbability(p.genetics!.knowledge)).toBeNull();
  }
 }
});
test('reroll costs exactly 2000, preserves clocks/genes/economy history, changes all IDs, repeats deterministically and rejects insufficient funds',()=>{
 const g=stocked(),before=structuredClone(g),next=act(g,{type:'refreshShop'},DATE);expect(next.money).toBe(g.money-2000);expect(next.turn).toBe(g.turn);expect(next.lastDate).toBe(g.lastDate);
 expect(Object.keys(next.shop.offers).some(id=>id in g.shop.offers)).toBe(false);expect(next).toEqual(act(g,{type:'refreshShop'},DATE));expect(g).toEqual(before);
 expect(next.individuals).toEqual(g.individuals);expect(next.sales).toEqual(g.sales);expect(next.nextClutch).toBe(g.nextClutch);
 const poor=stocked();poor.money=1999;expect(()=>act(poor,{type:'refreshShop'},DATE)).toThrow('자금');expect(poor.money).toBe(1999);
});
test('purchase keeps exact specimen, parents, pricing and purchase receipt; pedigree costs no housing/food and duplicate/insufficient purchases reject',()=>{
 let g=stocked();const o=Object.values(g.shop.offers)[0],original=structuredClone(o),money=g.money;
 g=act(g,{type:'buyGecko',offerId:o.id},DATE);expect(g.money).toBe(money-o.askPrice);expect(g.individuals[o.id]).toEqual(original.individual);expect(g.shop.offers[o.id]).toEqual({...original,purchased:true});
 expect(Object.values(g.shop.offers)).toHaveLength(4);expect(owned(g)).toHaveLength(1);expect(foodDemand(g).needed).toBe(1);expect(freeSlots(g)).toBe(g.capacity-1);
 for(const p of [original.family!.father,original.family!.mother])expect(g.individuals[p.id]).toEqual(p);
 expect(ancestors(g,o.id).size).toBe(2);expect(()=>act(g,{type:'buyGecko',offerId:o.id},DATE)).toThrow('판매');
 const poor=stocked();poor.money=o.askPrice-1;expect(()=>act(poor,{type:'buyGecko',offerId:o.id},DATE)).toThrow('자금');expect(owned(poor)).toHaveLength(0);
 const full=stocked();full.capacity=2;for(const id of Object.keys(full.shop.offers).slice(0,2))Object.assign(full,act(full,{type:'buyGecko',offerId:id},DATE));
 expect(()=>act(full,{type:'buyGecko',offerId:Object.keys(full.shop.offers)[2]},DATE)).toThrow('공간');
});
test('purchased snapshots survive rename, public inference, lineage names, sale, backup and market table repricing',()=>{
 let g=stocked();const o=Object.values(g.shop.offers)[0];g=act(g,{type:'buyGecko',offerId:o.id},DATE);
 g=act(g,{type:'rename',id:o.id,name:'새 친구'},DATE);g=act(g,{type:'lineage',id:o.id,name:'실제 부모 혈통'},DATE);g=act(g,{type:'sell',id:o.id},DATE);
 const receipt=structuredClone(g.shop.offers[o.id]);const next=synchronize(g,DATE,{...MARKET,version:'shop-test-2',buyMultiplier:1.5});expect(next.shop.offers[o.id]).toEqual(receipt);
 expect(next.sales).toEqual(g.sales);expect(parseBackup(exportBackup(next),DATE)).toEqual(next);expect(next.individuals[o.id].parents).toEqual(o.individual.parents);
});
test('v8 is stable across wall clock/reload; end-turn uses exactly the common engine and updates stock once',()=>{
 let g=stocked();const o=Object.values(g.shop.offers)[0];g=act(g,{type:'buyGecko',offerId:o.id},DATE);g=act(g,{type:'buyFood',amount:20},DATE);
 expect(readSave(makeSave(g),DATE)).toBe(g);expect(synchronize(g,DATE)).toBe(g);
 const next=end(g);expect(next.turn).toBe(1);expect(next.food).toBe(g.food-1);expect(next.shop.batch).toBe(g.shop.batch!+1);expect(next.money).toBe(g.money);expect(next.individuals[o.id].stage).toBe('adult');
 expect(Object.values(next.shop.offers)).toHaveLength(4);expect(parseBackup(exportBackup(next),DATE)).toEqual(next);
});
test.each([5,6])('v%i migration preserves original owned genes/eggs/history/unknown legacy parents and is idempotent',version=>{
 let old=(version===5?v5Game:oldGame)('shop-migration',DATE,{initialCapacity:20});const [id]=Object.keys(old.shop.offers);old=act(old,{type:'buyGecko',offerId:id},DATE);
 const original=structuredClone(old),envelope=makeSave(old),next=readSave(envelope,DATE);expect(old).toEqual(original);expect(next.saveVersion).toBe(9);expect(next.individuals[id].parents).toBeNull();
 expect(next.individuals[id].genetics).toEqual(old.individuals[id].genetics);expect(next.money).toBe(old.money);expect(next.sales).toEqual(old.sales);expect(next.nextClutch).toBe(old.nextClutch);
 for(const offer of Object.values(next.shop.offers).filter(o=>o.id in old.shop.offers)){expect(offer.family).toBeNull();const {healthGenome,...preserved}=offer.individual;expect(healthGenome).toBeDefined();expect(preserved).toEqual(readV6Save(envelope,DATE).shop.offers[offer.id].individual);expect(offer.askPrice).toBe(old.shop.offers[offer.id].askPrice);}
 expect(Object.values(next.shop.offers)).toHaveLength(4);expect(readSave(makeSave(next),DATE)).toBe(next);expect(parseBackup(exportBackup(next),DATE)).toEqual(next);
});
test('closed save schema rejects false parents, corrupted allele inheritance, purchase receipts, seeds and parent ages',()=>{
 const g=stocked();const changes:((g:HardcoreGame)=>void)[]=[x=>Object.values(x.shop.offers)[0].family!.seed+='bad',x=>Object.values(x.shop.offers)[0].purchased=true,x=>Object.values(x.shop.offers)[0].individual.parents!.fatherId='missing',x=>Object.values(x.shop.offers)[0].family!.father.birthTurn=0,x=>{delete Object.values(x.shop.offers)[0].family;},x=>{x.shop.batch=NaN;}];
 for(const change of changes){const e=makeSave(structuredClone(g));change(e.game);e.checksum=checksum(e.game);expect(()=>readSave(e,DATE)).toThrow();}
});
test('real purchased descendants breed for five further generations, avoid family crosses and keep external ancestors through backup',()=>{
 let g=stocked('market-five-generations'),[father,mother]=Object.keys(g.shop.offers);for(const id of [father,mother])g=act(g,{type:'buyGecko',offerId:id},g.lastDate);g.food=10000;
 const originals=structuredClone(g.individuals);let current=father;
 for(let gen=0;gen<5;gen++){
  let partner=gen===0?g.individuals[mother]:undefined;
  for(let tries=0;!partner&&tries<100;tries++){
   const c=g.individuals[current],o=Object.values(g.shop.offers).find(o=>!o.purchased&&o.individual.stage==='adult'&&o.individual.sex!==c.sex&&!advancedSafety(c,o.individual).length);
   if(o){g=act(g,{type:'buyGecko',offerId:o.id},g.lastDate);partner=g.individuals[o.id];}else g=act(g,{type:'refreshShop'},g.lastDate);
  }
  expect(partner).toBeDefined();const c=g.individuals[current],f=c.sex==='male'?c.id:partner!.id,m=c.sex==='female'?c.id:partner!.id;
  // A genuinely failed clutch can be retried after recovery; never force survival.
  let childId:string|undefined;
  for(let attempts=0;!childId&&attempts<4;attempts++){
   g=act(g,{type:'breed',fatherId:f,motherId:m},g.lastDate);const mating=Object.values(g.matings).at(-1)!;
   for(let t=0;t<18;t++)g=end(g);
   childId=mating.lifecycle!.offspring.find(o=>g.individuals[o.embryo.id])?.embryo.id;
  }
  expect(childId).toBeDefined();current=childId!;expect(g.individuals[current].generation).toBe(gen+3);
  expect(()=>act(g,{type:'breed',fatherId:g.individuals[current].sex==='male'?current:f,motherId:g.individuals[current].sex==='female'?current:m},g.lastDate)).toThrow();
  g=parseBackup(exportBackup(g),g.lastDate);validateGame(g);
 }
 expect(g.individuals[current].generation).toBe(7);expect(ancestors(g,current).size).toBeGreaterThan(10);
 for(const [id,p] of Object.entries(originals))expect(g.individuals[id].genetics!.genome).toEqual(p.genetics!.genome);
},30000);

test('two-slot mating reservations block vendor purchase and become two eggs, never external pedigree livestock',()=>{
 let g=newGame('family-slot-booking',DATE,{initialCapacity:4,initialMoney:3_000_000});const [f,m,extra]=Object.keys(g.shop.offers);
 for(const id of [f,m])g=act(g,{type:'buyGecko',offerId:id},DATE);g=act(g,{type:'buyFood',amount:100},DATE);g=act(g,{type:'breed',fatherId:f,motherId:m},DATE);
 expect(freeSlots(g)).toBe(0);expect(owned(g)).toHaveLength(2);expect(()=>act(g,{type:'buyGecko',offerId:extra},DATE)).toThrow('공간');
 g=end(end(g));expect(Object.values(g.eggs)).toHaveLength(2);expect(freeSlots(g)).toBe(0);expect(foodDemand(g).needed).toBe(2);expect(g.food).toBe(96);validateGame(g);
});

test('purchased receipt prices and snapshot fields remain validated even after leaving the unsold catalog',()=>{
 let g=stocked();const id=Object.keys(g.shop.offers)[0];g=act(g,{type:'buyGecko',offerId:id},DATE);
 for(const change of [(x:HardcoreGame)=>{x.shop.offers[id].askPrice=-1;},(x:HardcoreGame)=>{x.shop.offers[id].individual.name='';},(x:HardcoreGame)=>{x.shop.offers[id].family!.father.stage='unknown' as never;}]){
  const e=makeSave(structuredClone(g));change(e.game);e.checksum=checksum(e.game);expect(()=>readSave(e,DATE)).toThrow();
 }
});
