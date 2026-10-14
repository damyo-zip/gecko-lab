import { expect, test } from "vitest";
import { newGame, act, synchronize } from "./helpers/legacy-hardcore";
import { makeSave, readSave, checksum } from "./helpers/legacy-hardcore";
import { createNewGame, applyAction } from "@/game/play";
import { makeSave as oldSave } from "@/game/save";
import { migrateV2 } from "@/game/hardcore/create";
import { forecastCross, inheritGenotype } from "@/genetics/mendel";
import { expandedGenotype, HARDCORE_LOCI } from "@/genetics/hardcore";
import { ovulating, breedingCheck } from "@/game/hardcore/breeding";
import { addDays } from "@/game/hardcore/time";
import { validateGame } from "@/game/hardcore/validation";

const date="2026-10-13";
function breedingGame() {
  let g=newGame("integrity",date,{fertilizationChance:1,hatchChance:1,adultAfter:6,juvenileAfter:3});
  const [a,b]=Object.keys(g.shop.offers);g=act(g,{type:"buyGecko",offerId:a},date);g=act(g,{type:"buyGecko",offerId:b},date);
  return act(g,{type:"breed",fatherId:a,motherId:b},date);
}
test("death freezes growth permanently and excludes feeding, selling and breeding",()=>{
  let g=synchronize(breedingGame(),addDays(date,3));const child=Object.values(g.individuals).find(i=>i.parents)!;
  g.individuals[child.id].hearts=1;g=synchronize(g,addDays(date,12));
  expect(g.individuals[child.id]).toMatchObject({status:"dead",hearts:0,stage:"hatchling",diedDate:addDays(date,4)});
  expect(()=>act(g,{type:"feed",id:child.id},g.lastDate)).toThrow();expect(()=>act(g,{type:"sell",id:child.id},g.lastDate)).toThrow();
  expect(breedingCheck(g,child.id,Object.keys(g.individuals)[1]).reasons.join()).toContain("생존");
  validateGame(g);
});
test("fertile window derives from a stored per-animal anchor and honors recovery",()=>{
  let g=newGame("cycle",date),offer=Object.values(g.shop.offers)[1];g=act(g,{type:"buyGecko",offerId:offer.id},date);
  const female=g.individuals[offer.id];
  expect(ovulating(female,g)).toBe(true);expect(ovulating(female,{...g,lastDate:addDays(date,1)})).toBe(true);
  for(let n=2;n<=5;n++)expect(ovulating(female,{...g,lastDate:addDays(date,n)})).toBe(false);
  expect(ovulating(female,{...g,lastDate:addDays(date,6)})).toBe(true);
  female.recoverUntil=addDays(date,7);expect(ovulating(female,{...g,lastDate:addDays(date,6)})).toBe(false);
});
test("earlier v2 multi-clutch history, renamed descendants and pending eggs migrate intact",()=>{
  let old=createNewGame("old-history");const [male,female]=Object.values(old.individuals);
  old=applyAction(old,{type:"breed",fatherId:male.id,motherId:female.id});old=applyAction(old,{type:"advance",turns:5});
  const child=Object.values(old.individuals).find(i=>i.parents)!;old=applyAction(old,{type:"rename",id:child.id,name:"이전 자손"});
  old=applyAction(old,{type:"breed",fatherId:male.id,motherId:female.id});
  const g=migrateV2(oldSave(old),date);validateGame(g);
  expect(g.individuals[child.id]).toMatchObject(old.individuals[child.id]);expect(g.nextClutch).toBe(3);
  const later=synchronize(g,addDays(date,2));expect(Object.values(later.eggs).every(e=>e.status==="hatched")).toBe(true);
  expect(Object.keys(later.individuals)).toHaveLength(10);
});
test("structural corruption is rejected even when the accidental-integrity checksum is recomputed",()=>{
  const g=synchronize(breedingGame(),addDays(date,3)),egg=Object.values(g.eggs)[0];
  const corruptions=[
    (x:typeof g)=>{x.individuals[egg.embryo.id].sex=x.individuals[egg.embryo.id].sex==="male"?"female":"male";},
    (x:typeof g)=>{Object.values(x.matings)[0].fatherGenotype.loci["lilly-white"]=["n","Lw"];},
    (x:typeof g)=>{x.capacity=2;},
    (x:typeof g)=>{x.individuals[egg.embryo.id].parents!.fatherId="missing";},
    (x:typeof g)=>{Object.values(x.matings)[0].date=addDays(date,-1);},
  ];
  for(const damage of corruptions){const envelope=makeSave(structuredClone(g));damage(envelope.game);envelope.checksum=checksum(envelope.game);expect(()=>readSave(envelope,date)).toThrow();}
});
test("Lilly/Ax probabilities normalize and carrier cross frequencies match 25/50/25",()=>{
  const g=newGame("genes",date),carrier=expandedGenotype(Object.values(g.shop.offers)[3].individual.genotype);
  const probabilities=forecastCross(carrier,carrier,HARDCORE_LOCI);
  for(const locus of probabilities.loci)expect(locus.outcomes.reduce((s,o)=>s+o.probability,0)).toBeCloseTo(1);
  const counts=[0,0,0];for(let n=0;n<10000;n++){
    const child=inheritGenotype(carrier,carrier,"ax-sim-"+n,HARDCORE_LOCI).genotype;
    counts[child.loci.axanthic.filter(a=>a==="ax").length]++;
  }
  [.25,.5,.25].forEach((p,n)=>expect(Math.abs(counts[n]/10000-p)).toBeLessThan(.02));
});

test("maximum-length user seeds still breed, hatch and restore derived RNG inputs",()=>{
  let g=newGame("x".repeat(128),date,{fertilizationChance:1,hatchChance:1});const [father,mother]=Object.keys(g.shop.offers);
  g=act(g,{type:"buyGecko",offerId:father},date);g=act(g,{type:"buyGecko",offerId:mother},date);
  g=act(g,{type:"breed",fatherId:father,motherId:mother},date);g=synchronize(g,addDays(date,3));
  expect(Object.values(g.eggs)).toHaveLength(2);expect(Object.values(g.eggs)[0].seed.length).toBeGreaterThan(128);
  expect(readSave(makeSave(g),g.lastDate)).toEqual(g);
});
