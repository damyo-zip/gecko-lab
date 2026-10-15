import {newGame} from '../../src/game/hardcore/play';
import {founderRecord} from '../../src/game/hardcore/genetics';
import {legacyTraits} from '../../src/genetics/advanced/phenotype';
import {polyScores} from '../../src/genetics/advanced/polygenic';
import {exportBackup} from '../../src/game/hardcore/save';

/** Controlled, schema-validated load fixture. Never installed in a player's new game. */
export function rushPerformanceGame(count:number,seed='rush-performance'){
  const game=newGame(seed,'2026-10-15');
  const template=Object.values(game.shop.offers)[0].family!.father;
  game.capacity=Math.max(4,count);game.food=count*10;
  for(let i=0;i<count;i++){
    const id='performance-'+i,genetics=founderRecord(template.genotype,id);
    game.individuals[id]={...structuredClone(template),id,name:'크레 '+i,status:'owned',
      genetics,potential:legacyTraits(polyScores(genetics.genome!.polygenic)),visualSeed:id,
      birthTurn:-12,birthDate:'2026-07-23',nextBreedTurn:0,cycleAnchor:game.lastDate,recoverUntil:game.lastDate};
  }
  return game;
}
export const rushPerformanceBackup=(count:number)=>exportBackup(rushPerformanceGame(count));
