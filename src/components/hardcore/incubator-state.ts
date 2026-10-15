import type {HardcoreGame,TimedEgg} from '@/game/hardcore/model';
import {freeSlots,owned,reserved} from '@/game/hardcore/survival';
import {V12} from '@/game/hardcore/lifecycle';
import {holdsIncubatorSlot,waitingForCollection} from '@/game/hardcore/brood-care';
import {daysBetween} from '@/game/hardcore/time';

/** Presentation only: never inspect an unrevealed embryo or change a saved reservation. */
export function eggProgress(game:HardcoreGame,egg:TimedEgg){
 if(waitingForCollection(egg))return {remainingTurns:V12.hatchAfter,remainingDays:V12.hatchAfter*V12.daysPerTurn,percent:0};
 const remainingTurns=egg.status!=='incubating'?0:Math.max(0,egg.lifecycle?egg.lifecycle.dueTurn-game.turn:Math.ceil(daysBetween(game.lastDate,egg.dueDate)/V12.daysPerTurn));
 const duration=egg.lifecycle?egg.lifecycle.dueTurn-(egg.care?.collectedTurn??egg.lifecycle.laidTurn):V12.hatchAfter;
 return {remainingTurns,remainingDays:remainingTurns*V12.daysPerTurn,percent:Math.min(100,Math.max(0,100*(duration-remainingTurns)/duration))};
}
export type IncubatorSlot={kind:'egg';id:string;egg:TimedEgg}|{kind:'reserved';id:string;layTurn:number;motherId:string;matingId:string;awaitingCollection?:boolean}|{kind:'empty';id:string};
export function incubatorState(game:HardcoreGame){
 const occupied=Object.values(game.eggs).filter(e=>holdsIncubatorSlot(e)&&!waitingForCollection(e));
 const waiting=Object.values(game.eggs).filter(waitingForCollection);
 const active=Object.values(game.eggs).filter(e=>e.status==='incubating'&&!waitingForCollection(e)).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.id.localeCompare(b.id));
 const available=freeSlots(game),booked=reserved(game)-occupied.length,total=game.capacity-owned(game).length;
 const slots:IncubatorSlot[]=occupied.map(egg=>({kind:'egg',id:egg.id,egg}));
 for(const m of Object.values(game.matings).sort((a,b)=>a.ordinal-b.ordinal)){
  if(!['pending','fertilized'].includes(m.status))continue;
  const count=m.lifecycle?(m.lifecycle.maxClutches-m.lifecycle.clutchesLaid)*V12.eggsPerClutch:V12.eggsPerClutch;
  for(let n=0;n<count;n++)slots.push({kind:'reserved',id:m.id+'-reserved-'+n,layTurn:m.lifecycle?.nextLayTurn??game.turn+V12.firstLayAfter,motherId:m.parents.motherId,matingId:m.id});
 }
 for(const egg of waiting)slots.push({kind:'reserved',id:egg.id,layTurn:egg.lifecycle!.laidTurn,motherId:egg.embryo.parents!.motherId,matingId:egg.matingId!,awaitingCollection:true});
 for(let n=0;n<available;n++)slots.push({kind:'empty',id:'empty-'+n});
 const next=active[0];
 return {active,occupied,waiting,available,booked,total,slots,next,nextProgress:next?eggProgress(game,next):null,hatchChance:next?.hatchChance??game.rules.hatchChance};
}
export function eggNumber(game:HardcoreGame,egg:TimedEgg){return '#E-'+String(Object.keys(game.eggs).indexOf(egg.id)+1).padStart(3,'0');}
