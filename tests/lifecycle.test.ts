import {test,expect} from "vitest";
import {newGame,act} from "@/game/hardcore/play";
import {actWithTime,synchronizeTime} from "@/game/hardcore/time-source";
import {addDays} from "@/game/hardcore/time";
import {ageTurns,naturalDeathProbability,processCareAndLifespan,foodDemand,lifeStage} from "@/game/hardcore/lifecycle";
import {breedingCheck,breedingEvents} from "@/game/hardcore/breeding";
import {reserved,owned} from "@/game/hardcore/survival";
import {seededRandom} from "@/genetics/random";
import {makeSave,readSave,exportBackup,parseBackup,checksum} from "@/game/hardcore/save";
import {newGame as legacyGame,act as legacyAct,synchronize as legacySync} from "./helpers/legacy-hardcore";
import {validateGame} from "@/game/hardcore/validation";
import {valueGecko} from "@/game/hardcore/market";
import {specimen} from "@/game/hardcore/adapter";
import {descendants} from "@/game/hardcore/lineage";
import type {HardcoreGame,Gecko} from "@/game/hardcore/model";
const DATE="2026-10-14";
const end=(game:HardcoreGame)=>actWithTime(game,{type:"endTurn"},DATE);
function advance(game:HardcoreGame,turns:number){for(let n=0;n<turns;n++)game=end(game);return game;}
function pair(seed="v12-boundaries"){
 let g=newGame(seed,DATE,{initialCapacity:100,initialMoney:100_000_000});const [father,mother]=Object.keys(g.shop.offers);
 for(const id of [father,mother])g=act(g,{type:"buyGecko",offerId:id},DATE);
 for(let n=0;n<10;n++)g=act(g,{type:"buyFood",amount:1000},DATE);return {g,father,mother};
}
function atAge(game:HardcoreGame,g:Gecko,age:number){
 g.birthTurn=game.turn-age;g.birthDate=addDays(game.lastDate,-age*7);g.stage=age>=12?"adult":age>=6?"juvenile":"hatchling";
 g.nextBreedTurn=Math.max(0,g.birthTurn+12);g.lastProcessedTurn=game.turn;return g;
}
test("v1.2 requires player turns, moves seven days, fixes growth/rates and keeps realtime adapter inactive",()=>{
 const g=newGame("clock",DATE,{adultAfter:1,hatchChance:1});expect(g).toMatchObject({saveVersion:6,rulesVersion:3,rules:{adultAfter:12,juvenileAfter:6,hatchChance:.95,fertilizationChance:.95}});
 expect(synchronizeTime(g,addDays(DATE,700))).toBe(g);expect(end(g)).toMatchObject({turn:1,lastDate:addDays(DATE,7)});
 expect(()=>actWithTime(g,{type:"setTimeMode",mode:"realtime"},DATE)).toThrow("v1.2");
 expect(parseBackup(exportBackup(g),addDays(DATE,700))).toEqual(g);
});
test.each([0,5,6,11,12])("age %i follows exact fixed growth thresholds without seed variation",age=>{
 const {g}=pair();const gecko=Object.values(g.individuals)[0];atAge(g,gecko,age);validateGame(g);
 const next=end(g),child=next.individuals[gecko.id];expect(child.stage).toBe(age+1>=12?"adult":age+1>=6?"juvenile":"hatchling");
 expect(ageTurns(next,child)).toBe(age+1);
});
test("every living owned stage and breeding state consumes one food; eggs consume zero; replay is harmless",()=>{
 let {g,father,mother}=pair();g=act(g,{type:"breed",fatherId:father,motherId:mother},DATE);
 const template=g.individuals[father];for(const age of [0,6,12,50,60]){const clone=structuredClone(template);clone.id+='-age-'+age;clone.visualSeed=clone.id;atAge(g,clone,age);g.individuals[clone.id]=clone;}
 const count=owned(g).length,before=g.food;g=advance(g,2);expect(g.food).toBe(before-count*2);expect(Object.values(g.eggs)).toHaveLength(2);
 const snapshot=structuredClone(g);processCareAndLifespan(g);breedingEvents(g);expect(g).toEqual(snapshot);
 const next=end(g);expect(next.food).toBe(g.food-count);expect(next.individuals[father].hearts).toBe(5);
});
test("food shortage is counted before a turn; health-priority feeding is deterministic; starvation preserves records",()=>{
 let {g,father,mother}=pair();g.food=1;g.individuals[mother].hearts=1;expect(foodDemand(g)).toEqual({needed:2,missing:1});
 g=end(g);expect(g.food).toBe(0);expect(g.individuals[mother].hearts).toBe(2);expect(g.individuals[father].hearts).toBe(4);
 g.individuals[father].hearts=1;const genes=structuredClone(g.individuals[father].genetics);g=end(g);
 expect(g.individuals[father]).toMatchObject({status:"dead",deathCause:"starvation",hearts:0});expect(g.individuals[father].genetics).toEqual(genes);
 expect(owned(g)).toHaveLength(1);expect(()=>act(g,{type:"feed",id:mother},g.lastDate)).toThrow("자동 급여");validateGame(g);
});
test("fertilization fixes all six genomes; clutches occur at 2/6/10, eggs resolve at 6/10/14 and rest ends at 14",()=>{
 let {g,father,mother}=pair();g=act(g,{type:"breed",fatherId:father,motherId:mother},DATE);
 const m=Object.values(g.matings)[0],snapshot=structuredClone(m.lifecycle!.offspring);expect(reserved(g)).toBe(6);expect(m.status).toBe("fertilized");
 for(let turn=1;turn<=14;turn++){
  g=end(g);expect(Object.values(g.eggs)).toHaveLength(turn<2?0:turn<6?2:turn<10?4:6);
  for(const egg of Object.values(g.eggs)){expect(egg.lifecycle!.dueTurn-egg.lifecycle!.laidTurn).toBe(4);expect(egg.dueDate).toBe(addDays(egg.laidDate,28));
   expect(egg.status==="incubating").toBe(turn<egg.lifecycle!.dueTurn);expect(egg.embryo.genetics).toEqual(snapshot.find(o=>o.embryo.id===egg.embryo.id)!.embryo.genetics);
   if(egg.status==="hatched")expect(g.individuals[egg.embryo.id].genetics!.genome).toEqual(egg.embryo.genetics!.genome);
  }
  const before=structuredClone(g);breedingEvents(g);expect(g).toEqual(before);validateGame(g);
 }
 expect(g.matings[m.id].lifecycle!.clutchesLaid).toBe(3);expect(g.matings[m.id].status).toBe("laid");expect(g.individuals[mother].nextBreedTurn).toBe(14);
 expect(breedingCheck(g,father,mother).reasons).toEqual([]);expect(reserved(g)).toBe(0);
});
test("actual hatchlings become adults exactly twelve turns after their own hatch, never earlier",()=>{
 let {g,father,mother}=pair("v12-age");g=act(g,{type:"breed",fatherId:father,motherId:mother},DATE);g=advance(g,14);
 const children=Object.values(g.individuals).filter(i=>i.parents);expect(children.length).toBeGreaterThan(0);
 for(let t=0;t<12;t++){
  for(const child of children){const c=g.individuals[child.id];expect(c.stage==="adult").toBe(ageTurns(g,c)>=12);}
  g=end(g);
 }
 expect(children.every(c=>g.individuals[c.id].stage==="adult")).toBe(true);
});
test.each([11,12,49,50,59,60])("age %i breeding/adult/senior boundaries are stable",age=>{
 const {g,father,mother}=pair();atAge(g,g.individuals[father],age);atAge(g,g.individuals[mother],age);
 const reasons=breedingCheck(g,father,mother).reasons.join();expect(reasons.length===0).toBe(age>=12&&age<60);
 expect(lifeStage(g,g.individuals[father])).toBe(age>=60?"번식 은퇴":age>=50?"노령기":age>=12?"성체":"아성체");
 if(age>=60)expect(reasons).toContain("은퇴");validateGame(g);
});
test("a season begun before retirement completes on schedule after 60, but new matings are blocked",()=>{
 let {g,father,mother}=pair();atAge(g,g.individuals[mother],59);g=act(g,{type:"breed",fatherId:father,motherId:mother},DATE);
 g=advance(g,10);expect(Object.values(g.eggs)).toHaveLength(6);expect(Object.values(g.matings)[0].status).toBe("laid");
 expect(breedingCheck(g,father,mother).reasons.join()).toContain("은퇴");
});
test.each([[64,0],[65,.01],[69,.01],[70,.03],[74,.03],[75,.08],[79,.08],[80,.18],[84,.18],[85,.4],[89,.4],[90,1]])("natural death at age %i has probability %f",(age,p)=>expect(naturalDeathProbability(age)).toBe(p));
test("64/65/90 actual mortality uses fixed RNG, consumes one food, never duplicates and keeps pedigree/phenotype/value",()=>{
 for(const age of [64,65,90]){
  let {g,father}=pair('mortality-'+age);atAge(g,g.individuals[father],age-1);
  const before=structuredClone(g.individuals[father]),food=g.food;g=end(g);const current=g.individuals[father];
  const death=seededRandom(g.seed+'|'+father,'natural-death:'+age)()<naturalDeathProbability(age);
  expect(current.status==='dead').toBe(death);expect(current.deathCause).toBe(death?'natural':null);expect(g.food).toBe(food-2);
  expect(current.genetics).toEqual(before.genetics);expect(current.potential).toEqual(before.potential);expect(specimen(current).appearance).toEqual(specimen(before).appearance);expect(valueGecko(current)).toEqual(valueGecko(before));
  const snapshot=structuredClone(g);processCareAndLifespan(g);breedingEvents(g);expect(g).toEqual(snapshot);validateGame(g);
 }
});
test("v5 migration pauses realtime and preserves genetics, appearances, prices, IDs, history and active reservation",()=>{
 let old=legacyGame('migrate-v12',DATE,{fertilizationChance:1,hatchChance:1,initialCapacity:20});const [f,m]=Object.keys(old.shop.offers);
 for(const id of [f,m])old=legacyAct(old,{type:'buyGecko',offerId:id},DATE);old=legacyAct(old,{type:'breed',fatherId:f,motherId:m},DATE);
 old.time.mode='realtime';const original=structuredClone(old),next=readSave(makeSave(old),addDays(DATE,100));
 expect(old).toEqual(original);expect(next).toMatchObject({saveVersion:6,rulesVersion:3,turn:0,lastDate:DATE,time:{mode:'turn'}});
 for(const id of [f,m]){expect(next.individuals[id].genetics).toEqual(old.individuals[id].genetics);expect(specimen(next.individuals[id])).toEqual(specimen(old.individuals[id]));expect(valueGecko(next.individuals[id])).toEqual(valueGecko(old.individuals[id]));}
 expect(next.nextClutch).toBe(old.nextClutch);expect(reserved(next)).toBe(2);expect(Object.values(next.matings)[0].lifecycle!.maxClutches).toBe(1);
 expect(parseBackup(exportBackup(next),DATE)).toEqual(next);expect(synchronizeTime(next,addDays(DATE,100))).toBe(next);
});
test("pending v5 eggs keep fixed embryos and get an exact four-turn incubation; completed history remains valid",()=>{
 let old=legacyGame('migrate-eggs',DATE,{fertilizationChance:1,hatchChance:1,initialCapacity:20});const [f,m]=Object.keys(old.shop.offers);
 for(const id of [f,m])old=legacyAct(old,{type:'buyGecko',offerId:id},DATE);old=legacyAct(old,{type:'breed',fatherId:f,motherId:m},DATE);
 old=legacySync(old,addDays(DATE,2));const next=readSave(makeSave(old),DATE);
 for(const egg of Object.values(next.eggs)){expect(egg.embryo.genetics).toEqual(old.eggs[egg.id].embryo.genetics);expect(egg.lifecycle!.dueTurn-egg.lifecycle!.laidTurn).toBe(4);}
 validateGame(next);const completed=legacySync(old,addDays(DATE,3));validateGame(readSave(makeSave(completed),DATE));
});
test("v6 rejects recomputed-checksum corruption of counters, fertility, genomes, timing, food and mortality records",()=>{
 let {g,father,mother}=pair();g=act(g,{type:'breed',fatherId:father,motherId:mother},DATE);g=advance(g,2);
 const corruptions=[(x:HardcoreGame)=>x.matings[Object.keys(x.matings)[0]].lifecycle!.clutchesLaid++,
  (x:HardcoreGame)=>x.eggs[Object.keys(x.eggs)[0]].lifecycle!.dueTurn++,
  (x:HardcoreGame)=>x.rules.adultAfter=1,(x:HardcoreGame)=>x.food=-1,
  (x:HardcoreGame)=>x.eggs[Object.keys(x.eggs)[0]].hatchChance=1,
  (x:HardcoreGame)=>x.matings[Object.keys(x.matings)[0]].hatchChance=1,
  (x:HardcoreGame)=>x.matings[Object.keys(x.matings)[0]].lifecycle!.offspring[0].fertilized=!x.matings[Object.keys(x.matings)[0]].lifecycle!.offspring[0].fertilized];
 for(const change of corruptions){const envelope=makeSave(structuredClone(g));change(envelope.game);envelope.checksum=checksum(envelope.game);expect(()=>readSave(envelope,DATE)).toThrow();}
});
test("five new generations retain immutable ancestors/genomes through natural death and backup",()=>{
 let {g,father,mother}=pair('five-v12');const founder=father;
 for(let gen=1;gen<=5;gen++){
  if(gen>1){const child=g.individuals[father],offer=Object.values(g.shop.offers).find(o=>o.individual.sex!==child.sex&&o.individual.stage==='adult'&&!o.individual.genotype.loci['lilly-white'].includes('Lw'))!;
   g=act(g,{type:'buyGecko',offerId:offer.id},g.lastDate);mother=child.sex==='female'?child.id:offer.id;father=child.sex==='male'?child.id:offer.id;}
  g=act(g,{type:'breed',fatherId:father,motherId:mother},g.lastDate);const mating=Object.values(g.matings).at(-1)!;g=advance(g,18);
  const choose=()=>Object.values(g.individuals).find(c=>c.parents&&c.stage==='adult'&&c.parents.fatherId===mating.parents.fatherId&&c.parents.motherId===mating.parents.motherId&&c.generation===gen+1);
  for(let n=0;!choose()&&n<8;n++)g=end(g);const child=choose()!;
  expect(child).toBeDefined();father=child.id;g=parseBackup(exportBackup(g),g.lastDate);
 }
 expect(g.individuals[father].generation).toBe(6);expect(descendants(g,founder).size).toBeGreaterThan(5);validateGame(g);
},30000);
test("actual independent egg fertility and conditional hatching approach 95%/95% over 2000 first-clutch eggs",()=>{
 const {g:base,father,mother}=pair('egg-probability');let fertile=0,hatched=0,bothInfertile=0,total=0;
 for(let n=0;n<1000;n++){
  const source=structuredClone(base);source.seed='egg-simulation-'+n;
  const g=act(source,{type:'breed',fatherId:father,motherId:mother},DATE);g.turn=2;g.lastDate=addDays(DATE,14);breedingEvents(g);
  const first=Object.values(g.eggs);if(first.every(e=>!e.lifecycle!.fertilized))bothInfertile++;
  fertile+=first.filter(e=>e.lifecycle!.fertilized).length;total+=first.length;
  g.turn=6;g.lastDate=addDays(DATE,42);breedingEvents(g);hatched+=first.filter(e=>e.status==='hatched').length;
 }
 expect(Math.abs(fertile/total-.95)).toBeLessThan(.015);expect(Math.abs(hatched/fertile-.95)).toBeLessThan(.015);
 expect(Math.abs(bothInfertile/1000-.0025)).toBeLessThan(.006);
},30000);
test("new lineage names reach pre-fertilized future clutches without mutating any genotype",()=>{
 let {g,father,mother}=pair('lineage-v12');g=act(g,{type:'breed',fatherId:father,motherId:mother},DATE);g=advance(g,3);
 const before=Object.values(g.matings)[0].lifecycle!.offspring.map(o=>structuredClone(o.embryo.genetics));
 g=act(g,{type:'lineage',id:father,name:'세 시즌 혈통'},g.lastDate);const line=Object.keys(g.lineages)[0];
 expect(Object.values(g.matings)[0].lifecycle!.offspring.every(o=>o.embryo.lineageIds.includes(line))).toBe(true);
 g=advance(g,11);for(const egg of Object.values(g.eggs))expect(egg.embryo.lineageIds).toContain(line);
 expect(Object.values(g.matings)[0].lifecycle!.offspring.map(o=>o.embryo.genetics)).toEqual(before);validateGame(g);
});
test("a purchased Ax hatchling becomes breed-ready at age 12 rather than 84 calendar days or turns",()=>{
 let g=newGame('shop-hatchling',DATE,{initialCapacity:20,initialMoney:20_000_000});const hatch=Object.values(g.shop.offers).find(o=>o.individual.stage==='hatchling')!;
 g=act(g,{type:'buyGecko',offerId:hatch.id},DATE);g=act(g,{type:'buyFood',amount:1000},DATE);
 expect(g.individuals[hatch.id].nextBreedTurn).toBe(12);g=advance(g,11);expect(g.individuals[hatch.id].stage).toBe('juvenile');
 g=end(g);expect(g.individuals[hatch.id].stage).toBe('adult');expect(g.individuals[hatch.id].nextBreedTurn).toBeLessThanOrEqual(g.turn);
 const partner=Object.values(g.shop.offers).find(o=>o.individual.stage==='adult'&&o.individual.sex!==hatch.individual.sex&&o.individual.name.startsWith('노멀'))!;
 g=act(g,{type:'buyGecko',offerId:partner.id},g.lastDate);
 expect(breedingCheck(g,hatch.individual.sex==='male'?hatch.id:partner.id,hatch.individual.sex==='female'?hatch.id:partner.id).reasons).toEqual([]);
});
test("serialized derived traits tolerate engine ULP differences, but genome/seed/data changes still reject",()=>{
 let {g,father,mother}=pair('portable-backup');g=act(g,{type:'breed',fatherId:father,motherId:mother},DATE);
 const egg=Object.values(g.matings)[0].lifecycle!.offspring[0].embryo;egg.potential.redIntensity+=1e-15;
 const restored=readSave(makeSave(g),DATE);expect(restored).toEqual(g);expect(Object.values(restored.matings)[0].lifecycle!.offspring[0].embryo.potential).toEqual(egg.potential);
 egg.potential.redIntensity+=1e-4;expect(()=>validateGame(g)).toThrow();
});
