import type { HardcoreGame } from './model';
import { atBirth, awaitingPickup, waitingForCollection } from './brood-care';
import { bornIndividual } from './egg-outcome';
import { addDays } from './time';
import { freeSlots } from './survival';

function assert(value:unknown):asserts value {if(!value)throw new Error('알 수거·새끼 수령 기록이 손상되었습니다.');}
export function validateBroodCare(game:HardcoreGame):void {
  const groups=new Map<string,number>(),collections=new Map<string,number|null>();
  for(const egg of Object.values(game.eggs)){
    if(game.saveVersion>=10&&egg.status==='incubating')assert(egg.care);
    if(!Object.hasOwn(egg,'care'))continue;
    const c=egg.care;
    assert(game.saveVersion>=10&&c&&Object.keys(c).sort().join()==='collectedTurn,settledTurn,version'&&c.version===1&&egg.lifecycle);
    const validTurn=(turn:number|null)=>turn===null||Number.isSafeInteger(turn)&&turn>=egg.lifecycle!.laidTurn&&turn<=game.turn;
    assert(validTurn(c.collectedTurn)&&validTurn(c.settledTurn));
    if(egg.matingId){
      const key=egg.matingId+':'+egg.lifecycle.laidTurn;
      if(collections.has(key))assert(collections.get(key)===c.collectedTurn);
      else collections.set(key,c.collectedTurn);
    }
    if(c.collectedTurn===null){
      assert(egg.status==='incubating'&&c.settledTurn===null&&egg.matingId);
      groups.set(egg.matingId,(groups.get(egg.matingId)??0)+1);
    }
    if(c.settledTurn!==null)assert(c.collectedTurn!==null&&egg.status!=='incubating'&&c.settledTurn>=egg.lifecycle.dueTurn);
    if(egg.status==='incubating')assert(c.settledTurn===null);
    const child=game.individuals[egg.embryo.id];
    assert(egg.status==='hatched'&&c.settledTurn!==null?!!child:!child);
  }
  for(const count of groups.values())assert(count===2);
  assert(freeSlots(game)>=0);
}
/** Project only a validation clone into the historical structural validator.
 * Waiting babies are represented as temporary owned records here, never in the saved game.
 * Genetics, actual birth metadata and care transitions are validated separately.
 */
export function projectBroodCare(base:HardcoreGame):void {
  for(const egg of Object.values(base.eggs)){
    if(!egg.care)continue;
    if(waitingForCollection(egg)){
      egg.dueDate=addDays(base.lastDate,28);
      egg.embryo=atBirth(egg.embryo,base.turn+4,egg.dueDate);
    }
    if(awaitingPickup(egg)){
      const child=bornIndividual(egg.embryo),age=base.turn-child.birthTurn;
      child.stage=age>=base.rules.adultAfter?'adult':age>=base.rules.juvenileAfter?'juvenile':'hatchling';
      child.lastProcessedTurn=base.turn;base.individuals[child.id]=child;
    }
    delete egg.care;
  }
}
