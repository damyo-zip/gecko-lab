import {describe,it,expect} from 'vitest';
import {newMonthlyGame,newForgeGame,act} from '../src/game/hardcore/play';
import {actWithTime} from '../src/game/hardcore/time-source';
import {formatAgeMonths,lifeStage,processCareAndLifespan,MONTHLY} from '../src/game/hardcore/lifecycle';
import {migrateMonthly} from '../src/game/hardcore/migrate-monthly';
import {validateGame} from '../src/game/hardcore/validation';
import {makeSave,readMonthlySave} from '../src/game/hardcore/save';
import {eggFailure} from '../src/game/hardcore/egg-outcome';
import {displayAge} from '../src/game/hardcore/family-album';
import {addTargetParents} from './helpers/current-challenge-game';
const DATE='2026-10-24';
const turn=(g:ReturnType<typeof newMonthlyGame>)=>actWithTime(g,{type:'endTurn'},DATE);
function pair(){const g=newMonthlyGame('monthly',DATE,{initialMoney:2_000_000,initialCapacity:20});g.food=1000;const ids=addTargetParents(g,'gold-tiger');for(const id of ids){g.individuals[id].birthTurn=-18;g.individuals[id].nextBreedTurn=0;}return {g,ids};}
describe('confirmed monthly lifecycle',()=>{
 it.each([[0,'0개월'],[7,'7개월'],[12,'1년'],[18,'1년 6개월'],[38,'3년 2개월'],[144,'12년']])('formats %i months as %s',(m,s)=>expect(formatAgeMonths(m)).toBe(s));
 it('starts with two adult monthly founders and advances exactly one month',()=>{let {g,ids}=pair();expect(g.rulesVersion).toBe(5);expect(g.rules.adultAfter).toBe(18);expect(g.turn-g.individuals[ids[0]].birthTurn).toBe(18);const n=turn(g);expect(n.turn).toBe(1);expect(n.lastDate).toBe('2026-11-23');expect(displayAge(n,n.individuals[ids[0]])).toBe('1년 7개월');expect(readMonthlySave(makeSave(n),DATE)).toEqual(n);});
 it.each([[5,'hatchling'],[6,'juvenile'],[17,'juvenile'],[18,'adult']])('changes growth at %i months',(age,stage)=>{let {g,ids}=pair();const x=g.individuals[ids[0]];x.birthTurn=1-age;x.stage=age-1>=18?'adult':age-1>=6?'juvenile':'hatchling';x.nextBreedTurn=Math.max(0,x.birthTurn+18);g=turn(g);expect(g.individuals[x.id].stage).toBe(stage);});
 it('lays after one turn, incubates three turns and rests for two turns',()=>{let {g,ids}=pair();g=act(g,{type:'breed',fatherId:ids[0],motherId:ids[1]},g.lastDate);const m=Object.values(g.matings)[0];expect(m.lifecycle!.nextLayTurn).toBe(1);expect(m.lifecycle!.offspring.every(o=>!o.embryo.name.startsWith('해칭 '))).toBe(true);expect(new Set(m.lifecycle!.offspring.map(o=>o.embryo.name)).size).toBe(2);g=turn(g);expect(Object.keys(g.eggs)).toHaveLength(2);expect(g.individuals[ids[1]].nextBreedTurn).toBe(3);g=act(g,{type:'collectEggs',matingId:m.id},g.lastDate);expect(Object.values(g.eggs).every(e=>e.lifecycle!.dueTurn===4)).toBe(true);g=turn(turn(g));expect(Object.values(g.eggs).every(e=>e.status==='incubating')).toBe(true);g=turn(g);expect(Object.values(g.eggs).every(e=>e.status===(eggFailure(e)===null?'hatched':'failed'))).toBe(true);expect(readMonthlySave(makeSave(g),DATE)).toEqual(g);});
 it.each([[143,'성체'],[144,'노령기'],[179,'노령기'],[180,'번식 은퇴']])('uses life stage at %i months',(age,label)=>{const {g,ids}=pair(),x=g.individuals[ids[0]];x.birthTurn=-age;expect(lifeStage(g,x)).toBe(label);});
 it('does not roll early natural death and dies at exactly 216 months',()=>{let {g,ids}=pair();const id=ids[0];g.individuals[id].birthTurn=-214;g=turn(g);expect(g.individuals[id].status).toBe('owned');g=turn(g);expect(g.individuals[id].status).toBe('dead');expect(g.individuals[id].deathCause).toBe('natural');expect(displayAge(g,g.individuals[id])).toBe('18년');const n=turn(g);expect(displayAge(n,n.individuals[id])).toBe('18년');});
 it('migrates without changing money, food, genome, IDs or historical records',()=>{const old=newForgeGame('monthly-migration',DATE);const copy=structuredClone(old),g=migrateMonthly(old);validateGame(g);expect(old).toEqual(copy);expect(migrateMonthly(g)).toBe(g);expect(g.money).toBe(old.money);expect(g.food).toBe(old.food);expect(g.shop.offers[Object.keys(g.shop.offers)[0]].individual.genetics).toEqual(old.shop.offers[Object.keys(old.shop.offers)[0]].individual.genetics);expect(g.turn).toBe(old.turn);expect(g.lastDate).toBe(old.lastDate);});
});

describe('monthly migration and breeding boundaries',()=>{
 it.each([0,1,2,3,9])('preserves a legacy pending/collected clutch at turn %i without rerolling',t=>{
  let old=newForgeGame('monthly-old-clutch',DATE,{initialMoney:2_000_000,initialCapacity:20});old.food=100;
  const ids=addTargetParents(old,'gold-tiger');old=act(old,{type:'breed',fatherId:ids[0],motherId:ids[1]},old.lastDate);
  const matingId=Object.keys(old.matings)[0];for(let n=0;n<t;n++)old=turn(old);
  if(t>=2)old=act(old,{type:'collectEggs',matingId},old.lastDate);
  const original=structuredClone(old),next=migrateMonthly(old);validateGame(next);
  expect(next.matings).toEqual(original.matings);expect(next.money).toBe(original.money);expect(next.food).toBe(original.food);
  let g=next;
  while(Object.keys(g.eggs).length===0)g=turn(g);
  g=act(g,{type:'collectEggs',matingId},g.lastDate);
  const due=Object.values(g.eggs)[0].lifecycle!.dueTurn;
  for(const egg of Object.values(g.eggs))expect(egg.embryo.genetics).toEqual(original.matings[matingId].lifecycle!.offspring.find(o=>o.embryo.id===egg.embryo.id)!.embryo.genetics);
  while(g.turn<due)g=turn(g);
  for(const egg of Object.values(g.eggs)){expect(egg.status).toBe(eggFailure(egg)===null?'hatched':'failed');if(egg.status==='hatched')g=act(g,{type:'receiveHatchling',eggId:egg.id},g.lastDate);}
  expect(readMonthlySave(makeSave(g),DATE)).toEqual(g);
 });
 it('rejects both sexes before 18 months and at 180 months, allows them at 18 and 179',async()=>{
  const {breedingCheck}=await import('../src/game/hardcore/breeding');
  for(const age of [17,18,179,180]){const {g,ids}=pair();for(const id of ids){g.individuals[id].birthTurn=-age;g.individuals[id].stage=age>=18?'adult':'juvenile';}expect(breedingCheck(g,ids[0],ids[1]).reasons.length===0).toBe(age>=18&&age<180);}
 });
 it('keeps hatch names after delayed collection, pickup, rename and backup',()=>{
  let {g,ids}=pair();g=act(g,{type:'breed',fatherId:ids[0],motherId:ids[1]},g.lastDate);g=turn(turn(g));const mid=Object.keys(g.matings)[0];
  g=act(g,{type:'collectEggs',matingId:mid},g.lastDate);g=turn(turn(turn(g)));const egg=Object.values(g.eggs).find(e=>e.status==='hatched')!;expect(egg).toBeDefined();const name=egg.embryo.name;
  g=act(g,{type:'receiveHatchling',eggId:egg.id},g.lastDate);expect(g.individuals[egg.embryo.id].name).toBe(name);
  g=act(g,{type:'rename',id:egg.embryo.id,name:'꼬물이'},g.lastDate);expect(readMonthlySave(makeSave(g),DATE).individuals[egg.embryo.id].name).toBe('꼬물이');expect(egg.embryo.name).toBe(name);
 });
});
