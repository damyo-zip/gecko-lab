import type {HardcoreGame,TimedEgg} from './model';

/** Local to one action/validation. Do not cache mutable in-flight game objects. */
export function eggsByMating(game:Pick<HardcoreGame,'eggs'>):Map<string,TimedEgg[]> {
 const result=new Map<string,TimedEgg[]>();
 for(const egg of Object.values(game.eggs))if(egg.matingId){const list=result.get(egg.matingId)??[];list.push(egg);result.set(egg.matingId,list);}
 return result;
}
