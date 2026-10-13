import { expect, test } from "vitest";
import { newGame } from "@/game/hardcore/play";
import { actWithTime, synchronizeTime } from "@/game/hardcore/time-source";
import { addDays } from "@/game/hardcore/time";
import { checksum, exportBackup, makeSave, parseBackup, readSave } from "@/game/hardcore/save";
import type { HardcoreGame, LegacyHardcoreGame } from "@/game/hardcore/model";

const DATE = "2026-10-13";
function pair() {
  let game = newGame("time-source", DATE, { fertilizationChance: 1, hatchChance: 1 });
  const [father,mother] = Object.keys(game.shop.offers);
  game = actWithTime(game, {type:"buyGecko",offerId:father}, DATE);
  game = actWithTime(game, {type:"buyGecko",offerId:mother}, DATE);
  return { game, father, mother };
}
test("turn mode ignores wall time, actions, reload and backup without resetting hearts", () => {
  let { game } = pair(); const later = addDays(DATE,20);
  expect(game.time.mode).toBe("turn"); expect(synchronizeTime(game,later)).toBe(game);
  game = actWithTime(game,{type:"buyFood",amount:10},later);
  expect(game.lastDate).toBe(DATE); expect(game.turn).toBe(0);
  expect(Object.values(game.individuals).every(g=>g.hearts===5)).toBe(true);
  expect(synchronizeTime(parseBackup(exportBackup(game),later),later)).toEqual(game);
});
test("one end-turn advances exactly one day and once-per-day manual feeding resets", () => {
  let { game,father } = pair(); game = actWithTime(game,{type:"buyFood",amount:10},DATE);
  const source = structuredClone(game);
  game = actWithTime(game,{type:"endTurn"},addDays(DATE,30));
  expect(game.turn).toBe(1); expect(game.lastDate).toBe(addDays(DATE,1)); expect(game.individuals[father].hearts).toBe(4);
  game = actWithTime(game,{type:"feed",id:father},DATE);
  expect(game.individuals[father].hearts).toBe(5);expect(()=>actWithTime(game,{type:"feed",id:father},DATE)).toThrow();
  game = actWithTime(game,{type:"endTurn"},DATE);game = actWithTime(game,{type:"feed",id:father},DATE);
  expect(game.individuals[father].hearts).toBe(5);expect(game.food).toBe(8);expect(source.turn).toBe(0);
});
test("five completed turns cause permanent death, with no revival or record removal", () => {
  let { game,father } = pair();
  for(let n=0;n<5;n++) game = actWithTime(game,{type:"endTurn"},DATE);
  expect(game.individuals[father]).toMatchObject({hearts:0,status:"dead",diedDate:addDays(DATE,5)});
  expect(()=>actWithTime(game,{type:"feed",id:father},DATE)).toThrow();
  expect(Object.keys(game.individuals)).toHaveLength(2);
});
test("mating through adulthood uses the same daily reducer and fixed embryos in either mode", () => {
  const { game,father,mother } = pair();
  let turn = actWithTime(game,{type:"breed",fatherId:father,motherId:mother},DATE);
  let real = actWithTime(turn,{type:"setTimeMode",mode:"realtime"},DATE);
  for(let day=1;day<=4;day++) {
    turn = actWithTime(turn,{type:"endTurn"},DATE); real = synchronizeTime(real,addDays(DATE,day));
    expect(real.individuals).toEqual(turn.individuals);expect(real.eggs).toEqual(turn.eggs);expect(real.matings).toEqual(turn.matings);
    if(day===1)expect(Object.values(turn.matings)[0].status).toBe("fertilized");
    if(day===2)expect(Object.keys(turn.eggs)).toHaveLength(2);
    if(day===3)for(const egg of Object.values(turn.eggs))expect(turn.individuals[egg.embryo.id]).toEqual(egg.embryo);
  }
  expect(Object.values(turn.individuals).filter(g=>g.parents).every(g=>g.stage==="adult")).toBe(true);
});
test("switching to real time preserves a future logical date, then resumes at the next KST date", () => {
  let game = newGame("future-date",DATE);
  for(let n=0;n<10;n++) game = actWithTime(game,{type:"endTurn"},DATE);
  const before = structuredClone(game);
  game = actWithTime(game,{type:"setTimeMode",mode:"realtime"},DATE);
  expect(game.lastDate).toBe(before.lastDate);expect(game.turn).toBe(before.turn);expect(game.shop).toEqual(before.shop);
  game = synchronizeTime(game,addDays(DATE,1));expect(game.lastDate).toBe(addDays(DATE,11));expect(game.turn).toBe(11);
  expect(synchronizeTime(game,addDays(DATE,1))).toBe(game);expect(synchronizeTime(game,DATE)).toBe(game);
  expect(()=>actWithTime(game,{type:"endTurn"},addDays(DATE,1))).toThrow("턴 방식");
  const paused = actWithTime(game,{type:"setTimeMode",mode:"turn"},addDays(DATE,1));
  expect(synchronizeTime(paused,addDays(DATE,50))).toBe(paused);
});
test("real mode still processes five offline dates once and preserves its anchor on backup", () => {
  let { game,father } = pair(); game=actWithTime(game,{type:"setTimeMode",mode:"realtime"},DATE);
  game=synchronizeTime(game,addDays(DATE,5));expect(game.turn).toBe(5);expect(game.individuals[father].status).toBe("dead");
  expect(game.time.realtimeAnchorDate).toBe(addDays(DATE,5));
  expect(synchronizeTime(parseBackup(exportBackup(game),addDays(DATE,5)),addDays(DATE,5))).toEqual(game);
});
test("v3 migration keeps all records and counters and defaults to paused manual turns", () => {
  const {game,father,mother}=pair(),bred=actWithTime(game,{type:"breed",fatherId:father,motherId:mother},DATE);
  const { time: _time, ...fields }=structuredClone(bred);
  const legacy:LegacyHardcoreGame={...fields,saveVersion:3};
  const old={format:"gecko-lab-save",version:3,checksum:checksum(legacy),game:legacy};
  const migrated=readSave(old,addDays(DATE,20));expect(migrated).toMatchObject({...legacy,saveVersion:4});
  expect(migrated.time).toEqual({mode:"turn",realtimeAnchorDate:addDays(DATE,20)});
  expect(synchronizeTime(migrated,addDays(DATE,20))).toBe(migrated);
  expect(migrated.nextClutch).toBe(bred.nextClutch);
  old.checksum="broken";expect(()=>readSave(old,DATE)).toThrow("무결성");
});
test("v4 validation rejects unknown time modes, invalid anchors and missing mode data", () => {
  const g=newGame("time-integrity",DATE);
  for(const corrupt of [
    (x:HardcoreGame)=>{x.time.mode="unknown" as never;},
    (x:HardcoreGame)=>{x.time.realtimeAnchorDate="2026-02-30";},
    (x:HardcoreGame)=>{delete (x as Partial<HardcoreGame>).time;},
  ]) {const envelope=makeSave(structuredClone(g));corrupt(envelope.game);envelope.checksum=checksum(envelope.game);expect(()=>readSave(envelope,DATE)).toThrow();}
});
