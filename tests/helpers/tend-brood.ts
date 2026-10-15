import {act} from '../../src/game/hardcore/play';
import type {HardcoreGame} from '../../src/game/hardcore/model';
/** Test driver explicitly performs the three player actions; never used by the game. */
export function tendBrood(source:HardcoreGame){
 let game=source;
 for(const matingId of new Set(Object.values(game.eggs).filter(e=>e.care?.collectedTurn===null).map(e=>e.matingId!)))game=act(game,{type:'collectEggs',matingId},game.lastDate);
 for(const egg of Object.values(game.eggs))if(egg.care&&egg.care.settledTurn===null&&egg.status!=='incubating')game=act(game,{type:egg.status==='hatched'?'receiveHatchling':'removeFailedEgg',eggId:egg.id},game.lastDate);
 return game;
}
