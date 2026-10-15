import {migrateBroodCare} from '../../src/game/hardcore/brood-care';
/** Historical UI regression scenarios keep their original vendor genotypes.
 * They run the current v8 gameplay and storage, and retain honest unknown parentage.
 * Newly generated families are exercised by shop-reference.spec.ts. */
import {newGame as v6Game} from '../../tests/helpers/v6-hardcore';
import {migrateRisk} from '../../src/game/hardcore/migrate-risk';
import {migrateAlbum} from '../../src/game/hardcore/migrate-album';
import {migrateShop} from '../../src/game/hardcore/shop-family';
import type {Rules,TimeMode} from '../../src/game/hardcore/model';
import {MARKET,type PriceTable} from '../../src/game/hardcore/market';
export {act,synchronize} from '../../src/game/hardcore/play';
export function newGame(seed:string,date:string,rules:Partial<Rules>={},table:PriceTable=MARKET,timeMode:TimeMode='turn'){
 return migrateBroodCare(migrateRisk(migrateAlbum(migrateShop(v6Game(seed,date,rules,table,timeMode)))));
}
export function axCatalog(seed:string,date:string,rules:Partial<Rules>={}){
 const g=v6Game(seed,date,rules),offers=Object.values(g.shop.offers);
 g.shop.offers=Object.fromEntries([offers[0],offers[5],offers[1],offers[2]].map(o=>[o.id,o]));return migrateBroodCare(migrateRisk(migrateAlbum(migrateShop(g))));
}
