import { seedId } from "@/genetics/random";
import { readSave } from "@/game/save";
import { BALANCE, LEGACY_BALANCE } from "./balance";
import type { Gecko, HardcoreGame, Rules, TimeMode } from "./model";
import { addDays, dateNumber, type GameDate } from "./time";
import { legacyRecord } from "./genetics";

export function createLegacyGame(seed: string, date: GameDate, overrides: Partial<Rules> = {}, timeMode: TimeMode = "turn"): HardcoreGame {
  dateNumber(date);
  if (!seed.trim() || seed.length > 128) throw new Error("시드는 1~128자여야 합니다.");
  const rules = { ...LEGACY_BALANCE, ...overrides, traitVariation: { ...LEGACY_BALANCE.traitVariation, ...overrides.traitVariation } };
  return { saveVersion: 5, rulesVersion: 2, gameId: "h-" + seedId(seed, "hardcore"), seed,
    revision: 0, turn: 0, nextClutch: 1, startedDate: date, lastDate: date, rules,
    time: { mode: timeMode, realtimeAnchorDate: date },
    money: rules.initialMoney, food: 0, capacity: rules.initialCapacity, expansions: 0,
    individuals: {}, matings: {}, eggs: {}, sales: [], lineages: {}, nextLineage: 1,
    shop: { date, offers: {} }, marketVersion: "", notices: [], migration: null };
}
export function createV6Game(seed: string, date: GameDate, overrides: Partial<Rules> = {}, timeMode: TimeMode = "turn"): HardcoreGame {
  if(timeMode!=="turn")throw new Error("v1.2는 플레이어가 턴을 마쳐야 진행됩니다.");
  const game=createLegacyGame(seed,date,overrides);
  game.saveVersion=6;game.rulesVersion=4;
  game.rules={...game.rules,fertilizationChance:BALANCE.fertilizationChance,hatchChance:BALANCE.hatchChance,
    adultAfter:BALANCE.adultAfter,juvenileAfter:BALANCE.juvenileAfter,recoveryDays:BALANCE.recoveryDays};
  return game;
}
export function createGame(seed:string,date:GameDate,overrides:Partial<Rules>={},timeMode:TimeMode="turn"):HardcoreGame {
  const game=createV6Game(seed,date,overrides,timeMode);game.saveVersion=7;game.shop.batch=0;return game;
}
/** Phase 2 had no wall-clock anchor: start daily care at migration, never invent past neglect. */
export function migrateV2(envelope: unknown, date: GameDate): HardcoreGame {
  const legacy = readSave(envelope);
  const game = createLegacyGame(legacy.seed, date, { adultAfter: legacy.rules.adultAfter,
    juvenileAfter: legacy.rules.juvenileAfter, traitVariation: legacy.rules.traitVariation });
  game.gameId = legacy.gameId; game.turn = legacy.turn; game.revision = legacy.revision;
  game.nextClutch = legacy.nextClutch;
  const convert = (g: typeof legacy.individuals[string]): Gecko => ({ ...structuredClone(g),
    birthDate: addDays(date, g.birthTurn - legacy.turn), status: "owned", hearts: 5,
    lastFedDate: null, diedDate: null, cycleAnchor: date,
    recoverUntil: addDays(date, Math.max(0, g.nextBreedTurn - legacy.turn)),
    lineageIds: [], provenance: "known", genetics: legacyRecord(g) });
  game.individuals = Object.fromEntries(Object.values(legacy.individuals).map(g => [g.id, convert(g)]));
  game.eggs = Object.fromEntries(Object.values(legacy.eggs).map(e => [e.id, {
    id: e.id, matingId: null, laidDate: addDays(date, e.laidTurn - legacy.turn),
    dueDate: addDays(date, e.dueTurn - legacy.turn), embryo: convert(e.embryo), hatchChance: 1,
    seed: legacy.seed + "|import:" + e.id, status: e.status,
    resolvedDate: e.status === "hatched" ? addDays(date, e.dueTurn - legacy.turn) : null,
  }]));
  game.capacity = Math.max(game.capacity, Object.keys(game.individuals).length +
    Object.values(game.eggs).filter(e => e.status === "incubating").length);
  game.migration = { from: 2, date };
  game.notices = ["Phase 2 데이터를 이전했습니다. 오늘부터 하트 관리가 시작됩니다. 기존 알과 성장 기간은 보존했습니다."];
  return game;
}
