import type { Action, HardcoreGame, TimeMode } from "./model";
import { addDays, dateNumber, daysBetween, type GameDate } from "./time";
import { act, synchronize } from "./play";
import { MARKET, type PriceTable } from "./market";
import { validateGame } from "./validation";

/** A time source only chooses a logical date. All daily rules stay in calendar.ts. */
export interface TimeSource {
  automatic: boolean;
  targetDate: (game: HardcoreGame, realDate: GameDate) => GameDate;
}
export const TIME_SOURCES: Record<TimeMode, TimeSource> = {
  turn: { automatic: false, targetDate: game => game.lastDate },
  realtime: { automatic: true, targetDate: (game, realDate) =>
    addDays(game.lastDate, Math.max(0, daysBetween(game.time.realtimeAnchorDate, realDate))) },
};
export function needsTimeSync(game: HardcoreGame, realDate: GameDate): boolean {
  return TIME_SOURCES[game.time.mode].targetDate(game, realDate) > game.lastDate;
}
export function synchronizeTime(source: HardcoreGame, realDate: GameDate, table: PriceTable = MARKET): HardcoreGame {
  dateNumber(realDate); validateGame(source);
  let next = synchronize(source, TIME_SOURCES[source.time.mode].targetDate(source, realDate), table);
  if (source.time.mode === "realtime" && realDate > source.time.realtimeAnchorDate) {
    if (next === source) next = structuredClone(source);
    next.time.realtimeAnchorDate = realDate;
    if (next.revision === source.revision) next.revision++;
  }
  validateGame(next); return next;
}
export function actWithTime(source: HardcoreGame, action: Action, realDate: GameDate, table: PriceTable = MARKET): HardcoreGame {
  const game = synchronizeTime(source, realDate, table);
  if (action.type === "endTurn") {
    if (game.time.mode !== "turn") throw new Error("턴 방식에서만 턴을 마칠 수 있습니다.");
    return synchronize(game, addDays(game.lastDate, 1), table);
  }
  if (action.type === "setTimeMode") {
    if (!Object.hasOwn(TIME_SOURCES, action.mode)) throw new Error("지원하지 않는 시간 방식입니다.");
    if (game.time.mode === action.mode) return game;
    const next: HardcoreGame = { ...game, revision: game.revision + 1,
      time: { mode: action.mode, realtimeAnchorDate: realDate } };
    validateGame(next); return next;
  }
  return act(game, action, game.lastDate, table);
}
