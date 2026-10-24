import type { Embryo, HardcoreGame, TimedEgg } from './model';
import { addDays } from './time';
import { V12, ageTurns, lifecycleRules } from './lifecycle';
import { bornIndividual } from './egg-outcome';

export const waitingForCollection=(egg:TimedEgg)=>!!egg.care&&egg.care.collectedTurn===null;
export const holdsIncubatorSlot=(egg:TimedEgg)=>egg.care?egg.care.settledTurn===null:egg.status==='incubating';
export const awaitingPickup=(egg:TimedEgg)=>!!egg.care&&egg.status==='hatched'&&egg.care.settledTurn===null;
export const awaitingRemoval=(egg:TimedEgg)=>!!egg.care&&egg.status==='failed'&&egg.care.settledTurn===null;
export function waitingClutches(game:HardcoreGame,motherId:string){
  return [...new Set(Object.values(game.eggs).filter(e=>waitingForCollection(e)&&e.embryo.parents?.motherId===motherId).map(e=>e.matingId!))];
}
/** Only birth/calendar metadata moves. Conception genomes, appearance and rolls remain immutable. */
export function birthMetadata(turn:number,date:string,rules: {adultAfter:number;daysPerTurn:number}=V12) {
  const adultDate=addDays(date,rules.adultAfter*rules.daysPerTurn);
  return {birthTurn:turn,birthDate:date,nextBreedTurn:turn+rules.adultAfter,lastProcessedTurn:turn,cycleAnchor:adultDate,recoverUntil:adultDate};
}
export function atBirth(embryo:Embryo,turn:number,date:string,rules: {adultAfter:number;daysPerTurn:number}=V12):Embryo {
  return Object.assign(structuredClone(embryo),birthMetadata(turn,date,rules));
}
export function collectEggs(game:HardcoreGame,matingId:string):void {
  const eggs=Object.values(game.eggs).filter(e=>e.matingId===matingId&&waitingForCollection(e));
  // A repeated action cannot restart incubation or create a second pair.
  if(!eggs.length)return;
  if(eggs.length!==2)throw new Error('수거할 알 두 개의 기록을 확인할 수 없습니다.');
  for(const egg of eggs){
    const V12=egg.timing?{...lifecycleRules(game),hatchAfter:egg.timing.hatchAfter}:lifecycleRules({rulesVersion:4});
    egg.care!.collectedTurn=game.turn;
    egg.lifecycle!.dueTurn=game.turn+V12.hatchAfter;
    egg.dueDate=addDays(game.lastDate,V12.hatchAfter*V12.daysPerTurn);
    egg.embryo=atBirth(egg.embryo,egg.lifecycle!.dueTurn,egg.dueDate,V12);
  }
}
export function receiveHatchling(game:HardcoreGame,eggId:string):void {
  const egg=game.eggs[eggId];
  if(!egg?.care)throw new Error('수령할 새끼를 찾을 수 없습니다.');
  if(egg.care.settledTurn!==null)return;
  if(!awaitingPickup(egg))throw new Error('아직 부화한 새끼가 없습니다.');
  if(game.individuals[egg.embryo.id])throw new Error('이미 등록된 개체입니다.');
  const child=bornIndividual(egg.embryo),age=ageTurns(game,child);
  child.stage=age>=game.rules.adultAfter?'adult':age>=game.rules.juvenileAfter?'juvenile':'hatchling';
  child.lastProcessedTurn=game.turn;
  game.individuals[child.id]=child;
  egg.care.settledTurn=game.turn; // One reserved slot becomes one owned housing space.
}
export function removeFailedEgg(game:HardcoreGame,eggId:string):void {
  const egg=game.eggs[eggId];
  if(!egg?.care)throw new Error('제거할 알을 찾을 수 없습니다.');
  if(egg.care.settledTurn!==null)return;
  if(!awaitingRemoval(egg))throw new Error('판정이 끝난 실패 알만 제거할 수 있습니다.');
  egg.care.settledTurn=game.turn; // Keep the failure and conception evidence in history.
}
/** Old active eggs keep their original countdown. Completed records stay already settled. */
export function migrateBroodCare(source:HardcoreGame):HardcoreGame {
  if(source.saveVersion>=10)return source;
  const game=structuredClone(source);game.saveVersion=10;
  for(const egg of Object.values(game.eggs))if(egg.status==='incubating'){
    egg.care={version:1,collectedTurn:egg.lifecycle!.laidTurn,settledTurn:null};
  }
  return game;
}
