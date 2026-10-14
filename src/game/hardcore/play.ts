import type { GameplayAction, HardcoreGame, Rules, TimeMode } from "./model";
import { createGame } from "./create";
import { catchUp } from "./calendar";
import { feed, feedAll } from "./survival";
import { startMating } from "./breeding";
import { buyFood, buyGecko, sellGecko, expand } from "./economy";
import { nameLineage,renameLineage,unfavoriteLineage } from "./lineage";
import { SHOP_REFRESH_PRICE } from "./shop-family";
import { refreshShop } from "./shop";
import { MARKET, updateMarket, type PriceTable } from "./market";
import { validateGame } from "./validation";
import type { GameDate } from "./time";
import { isV12 } from "./lifecycle";

export function newGame(seed: string, date: GameDate, rules: Partial<Rules> = {}, table: PriceTable = MARKET, timeMode: TimeMode = "turn"): HardcoreGame {
  const game = createGame(seed, date, rules, timeMode); refreshShop(game, table); validateGame(game); return game;
}
export function synchronize(source: HardcoreGame, date: GameDate, table: PriceTable = MARKET): HardcoreGame {
  validateGame(source);
  let result = catchUp(source, date);
  if (result !== source || !result.marketVersion || result.marketVersion !== table.version) {
    if (result === source) result = structuredClone(source);
    if (result.shop.date !== result.lastDate || !result.marketVersion) refreshShop(result, table);
    else updateMarket(result, table);
    if (result.revision === source.revision) result.revision++;
  }
  validateGame(result); return result;
}
/** Daily engine only receives logical dates; the time-source adapter chooses them. */
export function act(source: HardcoreGame, action: GameplayAction, date: GameDate, table: PriceTable = MARKET): HardcoreGame {
  const game = structuredClone(synchronize(source, date, table)); game.notices = [];
  if(isV12(game)&&(action.type==="feed"||action.type==="feedAll"))throw new Error("v1.2는 턴 종료 시 개체당 사료 1개를 자동 급여합니다.");
  switch (action.type) {
    case "feed": feed(game, action.id); break;
    case "feedAll": feedAll(game); break;
    case "breed": startMating(game, action.fatherId, action.motherId); break;
    case "buyFood": buyFood(game, action.amount); break;
    case "refreshShop": {
      if(game.saveVersion<7)throw new Error("현재 상점으로 이전한 뒤 발품팔기를 사용할 수 있습니다.");
      if(game.money<SHOP_REFRESH_PRICE)throw new Error("발품팔기 자금이 부족합니다. 2,000원이 필요합니다.");
      game.money-=SHOP_REFRESH_PRICE;refreshShop(game,table);break;
    }
    case "buyGecko": buyGecko(game, action.offerId); break;
    case "sell": sellGecko(game, action.id, table); break;
    case "expand": expand(game); break;
    case "lineage": nameLineage(game, action.id, action.name); break;
    case "renameLineage": renameLineage(game,action.lineageId,action.name);break;
    case "unfavoriteLineage": unfavoriteLineage(game,action.lineageId);break;
    case "rename": {
      const i = game.individuals[action.id], name = action.name.trim();
      if (!i || !name || name.length > 24) throw new Error("개체 이름은 1~24자여야 합니다.");
      i.name = name; break;
    }
    default: throw new Error("지원하지 않는 게임 행동입니다.");
  }
  game.revision++; validateGame(game); return game;
}
