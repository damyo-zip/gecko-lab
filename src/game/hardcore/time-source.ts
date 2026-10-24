import type { Action, HardcoreGame, TimeMode } from "./model";
import { addDays, dateNumber, daysBetween, type GameDate } from "./time";
import { act, synchronize } from "./play";
import { MARKET, type PriceTable } from "./market";
import { validateGame } from "./validation";
import { foodDemand, isV12, lifecycleRules } from "./lifecycle";
import { buyFood } from "./economy";

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
  return !isV12(game)&&TIME_SOURCES[game.time.mode].targetDate(game, realDate) > game.lastDate;
}
export function synchronizeTime(source: HardcoreGame, realDate: GameDate, table: PriceTable = MARKET): HardcoreGame {
  dateNumber(realDate); validateGame(source);
  let next = synchronize(source, isV12(source)?source.lastDate:TIME_SOURCES[source.time.mode].targetDate(source, realDate), table);
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
    if(action.expectedTurn!==undefined&&action.expectedTurn!==game.turn)throw new Error("이미 처리된 턴입니다. 현재 턴을 확인하세요.");
    let prepared=game;
    if(isV12(game)&&action.autoBuyFood){
      const {missing}=foodDemand(game);
      if(missing){
        if(game.money<missing*game.rules.foodUnitPrice)throw new Error("턴 종료 전 사료 부족");
        prepared=structuredClone(game);
        // Reuse the economy rules, but expose only the complete turn result to
        // persistence. No purchase is committed if any turn processing fails.
        for(let remaining=missing;remaining>0;remaining-=1000)buyFood(prepared,Math.min(remaining,1000));
      }
    }
    return synchronize(prepared, addDays(game.lastDate, isV12(game)?lifecycleRules(game).daysPerTurn:1), table);
  }
  if (action.type === "setTimeMode") {
    if(isV12(game)&&action.mode!=="turn")throw new Error("v1.2는 턴 마치기로만 진행합니다. 현실 시간 어댑터는 이전 규칙용으로 보존됩니다.");
    if (!Object.hasOwn(TIME_SOURCES, action.mode)) throw new Error("지원하지 않는 시간 방식입니다.");
    if (game.time.mode === action.mode) return game;
    const next: HardcoreGame = { ...game, revision: game.revision + 1,
      time: { mode: action.mode, realtimeAnchorDate: realDate } };
    validateGame(next); return next;
  }
  return act(game, action, game.lastDate, table);
}
