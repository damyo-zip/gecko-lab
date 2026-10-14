import {newGame,act} from './legacy-catalog';
import {turns} from './lifecycle';
/** Real played fixture: two unrelated females, staggered single clutches, six usable egg slots. */
export function incubatorFixture(){
 let g=newGame('incubator-reference-v1','2026-10-14',{initialCapacity:9,initialMoney:2_000_000});
 const offers=Object.values(g.shop.offers),father=offers[0].id,mother=offers[1].id,other=offers[2].id;
 for(const id of [father,mother,other])g=act(g,{type:'buyGecko',offerId:id},g.lastDate);
 g=act(g,{type:'buyFood',amount:100},g.lastDate);g=act(g,{type:'breed',fatherId:father,motherId:mother},g.lastDate);
 g=turns(g,2);g=act(g,{type:'breed',fatherId:father,motherId:other},g.lastDate);
 return turns(g,3);
}
