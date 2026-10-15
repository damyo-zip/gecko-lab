import {tendBrood} from '../../tests/helpers/tend-brood';
import {newGame,act} from '../../src/game/hardcore/play';
import {actWithTime} from '../../src/game/hardcore/time-source';

/** Real vendor families → a played, successfully hatched third generation.
 * Seeds select a genuine outcome; no genotype, phenotype or hatch result is edited. */
export function lineageFixture(){
 for(let n=0;n<100;n++){
  let game=newGame('family-album-'+n,'2026-10-14',{initialMoney:1_000_000,initialCapacity:20});
  const [fatherId,motherId]=Object.keys(game.shop.offers);
  for(const id of [fatherId,motherId])game=act(game,{type:'buyGecko',offerId:id},game.lastDate);
  game=act(game,{type:'buyFood',amount:100},game.lastDate);
  game=act(game,{type:'rename',id:fatherId,name:'시조'},game.lastDate);
  game=act(game,{type:'rename',id:motherId,name:'라임'},game.lastDate);
  game=act(game,{type:'lineage',id:fatherId,name:'시조 가문'},game.lastDate);
  game=act(game,{type:'lineage',id:motherId,name:'라임 가문'},game.lastDate);
  game=act(game,{type:'breed',fatherId,motherId},game.lastDate);
  for(let turn=0;turn<6;turn++)game=tendBrood(actWithTime(game,{type:'endTurn'},game.time.realtimeAnchorDate));
  const children=Object.values(game.individuals).filter(g=>g.parents?.fatherId===fatherId);
  if(children.length!==2)continue;
  game=act(game,{type:'rename',id:children[0].id,name:'미깡'},game.lastDate);
  game=act(game,{type:'rename',id:children[1].id,name:'새싹'},game.lastDate);
  return {game,selectedId:children[0].id,fatherId,motherId,siblingId:children[1].id};
 }
 throw new Error('Family album fixture could not find a genuine successful clutch');
}
