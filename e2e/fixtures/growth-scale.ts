import {tendBrood} from '../../tests/helpers/tend-brood';
import {newGame,act} from '../../src/game/hardcore/play';
import {actWithTime} from '../../src/game/hardcore/time-source';
import {breedingRisk} from '../../src/game/hardcore/breeding-risk';

/** Two played clutches give real hatchlings, six-turn juveniles and adult parents.
 * No age, growth stage, phenotype, seed or hatch outcome is overwritten. */
export function growthScaleGame(){
  for(let n=0;n<30;n++){
    let game=newGame('growth-scale-'+n,'2026-10-15',{initialMoney:2_000_000,initialCapacity:24});
    const [fatherId,motherId]=Object.keys(game.shop.offers);
    for(const offerId of [fatherId,motherId])game=act(game,{type:'buyGecko',offerId},game.lastDate);
    game=act(game,{type:'buyFood',amount:300},game.lastDate);
    for(let clutch=0;clutch<2;clutch++){
      const risk=breedingRisk(game,game.individuals[fatherId],game.individuals[motherId]);
      game=act(game,{type:'breed',fatherId,motherId,riskAcknowledgement:risk.acknowledgement},game.lastDate);
      for(let t=0;t<6;t++)game=tendBrood(actWithTime(game,{type:'endTurn'},game.time.realtimeAnchorDate));
    }
    const animals=Object.values(game.individuals).filter(g=>g.status==='owned');
    const hatchling=animals.find(g=>g.stage==='hatchling'),juvenile=animals.find(g=>g.stage==='juvenile');
    if(hatchling&&juvenile)return {game,hatchlingId:hatchling.id,juvenileId:juvenile.id,adultId:fatherId,motherId};
  }
  throw new Error('Three-stage review fixture could not find two viable clutches');
}
