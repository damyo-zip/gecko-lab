/** Historical v5 regression fixtures. Production readSave migrates these to v8;
 * v1.2 behavior and migration are covered separately in lifecycle tests. */
import { createLegacyGame } from "@/game/hardcore/create";
import { refreshShop } from "@/game/hardcore/shop";
import { validateGame } from "@/game/hardcore/validation";
import { readLegacySave } from "@/game/hardcore/save";
import type { Rules, TimeMode } from "@/game/hardcore/model";
import type { GameDate } from "@/game/hardcore/time";
import { MARKET, type PriceTable } from "@/game/hardcore/market";
export { act, synchronize } from "@/game/hardcore/play";
export { makeSave, checksum, exportBackup } from "@/game/hardcore/save";
export const readSave=readLegacySave;
export function parseBackup(input:string,date:GameDate){return readLegacySave(JSON.parse(input),date);}
export function newGame(seed:string,date:GameDate,rules:Partial<Rules>={},table:PriceTable=MARKET,timeMode:TimeMode="turn"){
 const game=createLegacyGame(seed,date,rules,timeMode);refreshShop(game,table);validateGame(game);return game;
}
