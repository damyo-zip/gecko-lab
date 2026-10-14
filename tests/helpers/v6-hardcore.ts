/** Historical v6/rules4 fixtures retain the prior catalog, while using production gameplay.
 * Latest v7 market and v2–v6 migrations are covered in shop-family.test.ts. */
import {createV6Game} from '@/game/hardcore/create';
import {refreshLegacyShop} from '@/game/hardcore/shop';
import {validateGame} from '@/game/hardcore/validation';
import {readV6Save} from '@/game/hardcore/save';
import type {Rules,TimeMode} from '@/game/hardcore/model';
import type {GameDate} from '@/game/hardcore/time';
import {MARKET,type PriceTable} from '@/game/hardcore/market';
export {act,synchronize} from '@/game/hardcore/play';
export {makeSave,checksum,exportBackup} from '@/game/hardcore/save';
export const readSave=readV6Save;
export function parseBackup(input:string,date:GameDate){return readV6Save(JSON.parse(input),date);}
export function newGame(seed:string,date:GameDate,rules:Partial<Rules>={},table:PriceTable=MARKET,timeMode:TimeMode='turn'){
 const g=createV6Game(seed,date,rules,timeMode);refreshLegacyShop(g,table);validateGame(g);return g;
}
