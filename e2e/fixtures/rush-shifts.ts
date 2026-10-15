import {drawRushWorkload,drawRushDifficulty,type RushDifficulty} from '../../src/game/rush-shifts';
import {newGame} from '../../src/game/hardcore/play';
import {rushPerformanceGame} from './rush-performance';

/** Select a reproducible natural draw; never overwrite the generated workload. */
export function rushShiftSeed(total:number,difficulty?:RushDifficulty){
  for(let i=0;i<10000;i++){
    const seed='variable-shift-'+i;
    if(drawRushWorkload(seed,0).total===total&&(!difficulty||drawRushDifficulty(seed,0).id===difficulty))return seed;
  }
  throw new Error('근무 테스트 시드를 찾지 못했습니다.');
}
export function rushShiftGame(total:number,difficulty?:RushDifficulty,count=0){
  const seed=rushShiftSeed(total,difficulty);
  return count?rushPerformanceGame(count,seed):newGame(seed,'2026-10-15');
}
