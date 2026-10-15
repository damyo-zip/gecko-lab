import {tendBrood} from '../../tests/helpers/tend-brood';
import {newGame,act} from "./legacy-catalog";
import {actWithTime} from "../../src/game/hardcore/time-source";
import type {HardcoreGame} from "../../src/game/hardcore/model";
export function turns(g:HardcoreGame,count:number){for(let n=0;n<count;n++)g=tendBrood(actWithTime(g,{type:"endTurn"},g.time.realtimeAnchorDate));return g;}
/** Select a seed with two genuine successful first-clutch outcomes, never override 5%/95% rules. */
export function successfulPair(prefix:string,date:string){
 for(let n=0;n<100;n++){
  const original=newGame(prefix+n,date,{initialMoney:3_000_000,initialCapacity:20});let g=original;
  const [father,mother]=Object.keys(g.shop.offers);
  for(const id of [father,mother])g=act(g,{type:"buyGecko",offerId:id},g.lastDate);
  g=act(g,{type:"buyFood",amount:1000},g.lastDate);g=act(g,{type:"breed",fatherId:father,motherId:mother},g.lastDate);g=turns(g,6);
  const first=Object.values(g.eggs).filter(e=>e.lifecycle!.laidTurn===2);
  if(first.length===2&&first.every(e=>e.status==="hatched"))return {original,father,mother};
 }throw new Error("successful v1.2 fixture not found");
}
