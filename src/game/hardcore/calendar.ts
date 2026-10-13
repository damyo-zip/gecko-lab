import type { HardcoreGame } from "./model";
import { addDays, daysBetween, type GameDate } from "./time";
import { loseHearts, owned } from "./survival";

export type DailyEvents = (game: HardcoreGame) => void;
/** Process every midnight exactly once. Rewinding a device clock never undoes history. */
export function catchUp(source: HardcoreGame, date: GameDate, events?: DailyEvents): HardcoreGame {
  const count = daysBetween(source.lastDate, date);
  if (count <= 0) return source;
  // Valid Gregorian dates impose a finite bound. No offline protection or elapsed-day cap.
  const game = structuredClone(source);
  game.notices = [];
  for (let day = 0; day < count; day++) {
    game.lastDate = addDays(game.lastDate, 1); game.turn++;
    loseHearts(game);
    events?.(game);
    for (const g of owned(game)) {
      const age = daysBetween(g.birthDate, game.lastDate);
      g.stage = age >= game.rules.adultAfter ? "adult" : age >= game.rules.juvenileAfter ? "juvenile" : "hatchling";
    }
    game.shop.date = game.lastDate;
    game.notices = game.notices.slice(-60);
  }
  game.revision++;
  return game;
}
