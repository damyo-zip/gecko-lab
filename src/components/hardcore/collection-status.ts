import type {Gecko,HardcoreGame,Mating} from "@/game/hardcore/model";
import {isV12,ageTurns,lifecycleRules} from "@/game/hardcore/lifecycle";
import {ovulating} from "@/game/hardcore/breeding";
import {freeSlots} from "@/game/hardcore/survival";
import {daysBetween} from "@/game/hardcore/time";

export interface CollectionStatus {
  kind:"unavailable"|"retired"|"growth"|"care"|"laying"|"rest"|"waiting"|"ovulation"|"space"|"records"|"ready";
  label:string;
  ready:boolean;
  remainingTurns?:number;
  action?:"breed"|"expand";
}
/** Read-only presentation of the existing calendar/eligibility; never persisted. */
export interface StatusContext {matings:readonly Mating[];slots:number;recordCount:number}
export function collectionStatus(game:HardcoreGame,g:Gecko,careWarning=true,context?:StatusContext):CollectionStatus {
  const V12=lifecycleRules(game),v12=isV12(game),age=v12?ageTurns(game,g):daysBetween(g.birthDate,game.lastDate);
  const state=(kind:CollectionStatus["kind"],label:string,remainingTurns?:number):CollectionStatus=>({kind,label,ready:false,...(remainingTurns===undefined?{}:{remainingTurns})});
  if(g.status!=="owned"||g.hearts<1)return state("unavailable","교배 불가");
  if(v12&&age>=V12.retireAfter)return state("retired","번식 은퇴");
  if(g.stage!=="adult"||(v12&&age<V12.adultAfter)){
    const remaining=Math.max(1,game.rules.adultAfter-age);
    return state("growth",`성장 중 · ${remaining}턴`,remaining);
  }
  // Preserve the collection's existing low-condition warning priority.
  if(careWarning&&g.hearts<=2)return state("care","급여 필요");
  const matings=g.sex==="female"?(context?.matings??Object.values(game.matings).filter(m=>m.parents.motherId===g.id)):[];
  const pending=matings.find(m=>m.status==="pending"||m.status==="fertilized");
  if(pending){
    const remaining=pending.lifecycle?Math.max(0,pending.lifecycle.nextLayTurn-game.turn):0;
    return remaining>0?state("laying",`산란 대기 · ${remaining}턴`,remaining):state("laying","번식 진행 중");
  }
  // v1.2 eligibility uses nextBreedTurn; legacy ovulation also checks recoverUntil.
  const remaining=Math.max(0,g.nextBreedTurn-game.turn,v12?0:daysBetween(game.lastDate,g.recoverUntil));
  if(remaining>0){
    const resting=matings.some(m=>m.status==="laid"||m.status==="failed")||!!game.compact&&Object.values(game.compact.origins).some(o=>o.mating.parents.motherId===g.id);
    return state(resting?"rest":"waiting",`${resting?"휴식기":"교배 대기"} · ${remaining}턴`,remaining);
  }
  // Under v1.2 the checks above already cover every ovulating() condition.
  if(!v12&&g.sex==="female"&&!ovulating(g,game))return state("ovulation","배란 대기");
  if((context?.slots??freeSlots(game))<2)return {...state("space","공간 확보 필요"),action:"expand"};
  if((context?.recordCount??Object.keys(game.individuals).length+Object.keys(game.eggs).length)+2>30000)return state("records","기록 한도 도달");
  return {kind:"ready",label:"브리딩 가능",ready:true,action:"breed"};
}
