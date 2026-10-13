import type { GameplayAction, HardcoreGame, Rules, TimeMode } from "./model";
import { createGame } from "./create";
import { catchUp } from "./calendar";
import { feed, feedAll } from "./survival";
import { startMating } from "./breeding";
import { buyFood, buyGecko, sellGecko, expand } from "./economy";
import { nameLineage } from "./lineage";
import { refreshShop } from "./shop";
import { MARKET, updateMarket, type PriceTable } from "./market";
import { validateGame } from "./validation";
import type { GameDate } from "./time";

export function newGame(seed: string, date: GameDate, rules: Partial<Rules> = {}, table: PriceTable = MARKET, timeMode: TimeMode = "turn"): HardcoreGame {
  const game = createGame(seed, date, rules, timeMode); refreshShop(game, table); validateGame(game); return game;
}
export function synchronize(source: HardcoreGame, date: GameDate, table: PriceTable = MARKET): HardcoreGame {
  validateGame(source);
  let result = catchUp(source, date);
  if (result !== source || !result.marketVersion || result.marketVersion !== table.version) {
    if (result === source) result = structuredClone(source);
    if (result.lastDate !== source.lastDate || !result.marketVersion) refreshShop(result, table);
    else updateMarket(result, table);
    if (result.revision === source.revision) result.revision++;
  }
  validateGame(result); return result;
}
/** Daily engine only receives logical dates; the time-source adapter chooses them. */
export function act(source: HardcoreGame, action: GameplayAction, date: GameDate, table: PriceTable = MARKET): HardcoreGame {
  const game = structuredClone(synchronize(source, date, table)); game.notices = [];
  switch (action.type) {
    case "feed": feed(game, action.id); break;
    case "feedAll": feedAll(game); break;
    case "breed": startMating(game, action.fatherId, action.motherId); break;
    case "buyFood": buyFood(game, action.amount); break;
    case "buyGecko": buyGecko(game, action.offerId); break;
    case "sell": sellGecko(game, action.id, table); break;
    case "expand": expand(game); break;
    case "lineage": nameLineage(game, action.id, action.name); break;
    case "rename": {
      const i = game.individuals[action.id], name = action.name.trim();
      if (!i || !name || name.length > 24) throw new Error("개체 이름은 1~24자여야 합니다.");
      i.name = name; break;
    }
    default: throw new Error("지원하지 않는 게임 행동입니다.");
  }
  game.revision++; validateGame(game); return game;
}
