import { seededRandom } from "@/genetics/random";
import type { HardcoreGame, Mating } from "./model";
import { addDays } from "./time";
import { V12 } from "./lifecycle";
import { createEmbryo } from "./offspring";
import { observeMating } from "./genetics";
import { bornIndividual, eggFailure, fertileChance } from './egg-outcome';

export const seasonEggSeed=(m:Mating,clutch:number,egg:number)=>m.seed+"|clutch:"+clutch+"|egg:"+egg;
export function fertilizeSeason(game:HardcoreGame,m:Mating,startTurn=game.turn):void {
  m.status="fertilized";m.resolvedDate=game.lastDate;
  m.fertilizationChance=V12.fertileChance;m.hatchChance=V12.hatchChance;
  m.lifecycle={startTurn,nextLayTurn:startTurn+V12.firstLayAfter,clutchesLaid:0,maxClutches:1,offspring:[]};
  const clutch=1;
  for(let egg=1;egg<=V12.eggsPerClutch;egg++){
    const seed=seasonEggSeed(m,clutch,egg),id=game.gameId+"-c"+m.ordinal+"-"+clutch+"-"+egg;
    const birthTurn=startTurn+V12.firstLayAfter+V12.hatchAfter;
    const date=addDays(game.lastDate,(birthTurn-game.turn)*V12.daysPerTurn);
    const embryo=createEmbryo(game,m,seed,id,`해칭 ${m.ordinal}-${clutch}-${egg}`,birthTurn,date);
    m.lifecycle.offspring.push({embryo,fertilized:seededRandom(seed,"fertilization")()<fertileChance(m)});
  }
  const mother=game.individuals[m.parents.motherId];
  mother.nextBreedTurn=startTurn+V12.firstLayAfter+V12.restAfter;
  mother.recoverUntil=addDays(game.lastDate,(mother.nextBreedTurn-game.turn)*V12.daysPerTurn);
}
/** Stored counters/statuses make replay of this same turn a no-op. */
export function seasonEvents(game:HardcoreGame):void {
  for(const m of Object.values(game.matings)){
    const season=m.lifecycle;
    if(!season||m.status!=="fertilized")continue;
    const mother=game.individuals[m.parents.motherId];
    if(mother.status!=="owned"){
      m.status="cancelled";m.resolvedDate=game.lastDate;mother.nextBreedTurn=game.turn;
      game.notices.push("암컷 폐사·분양으로 남은 산란 취소 · 기존 알·혈통 기록 보존");continue;
    }
    if(game.turn<season.nextLayTurn)continue;
    const clutch=1;
    for(let n=1;n<=2;n++){
      const result=season.offspring[(clutch-1)*2+n-1],embryo=structuredClone(result.embryo),id=embryo.id+"-egg";
      game.eggs[id]={id,matingId:m.id,laidDate:game.lastDate,dueDate:embryo.birthDate,embryo,
        hatchChance:V12.hatchChance,seed:seasonEggSeed(m,clutch,n),status:"incubating",resolvedDate:null,
        ...(game.saveVersion>=10?{care:{version:1 as const,collectedTurn:null,settledTurn:null}}:{}),
        lifecycle:{laidTurn:game.turn,dueTurn:game.turn+V12.hatchAfter,fertilized:result.fertilized,failure:null}};
    }
    season.clutchesLaid=1;m.status="laid";m.resolvedDate=game.lastDate;
    mother.nextBreedTurn=game.turn+V12.restAfter;mother.recoverUntil=addDays(game.lastDate,V12.restAfter*V12.daysPerTurn);
    if(game.saveVersion<10)game.notices.push("알 2개 산란 · 산란 일정 종료 · 암컷 4턴 휴식 · 4턴 뒤 부화 판정");
  }
  for(const egg of Object.values(game.eggs)){
    if(egg.care?.collectedTurn===null||egg.status!=="incubating"||!egg.lifecycle||game.turn<egg.lifecycle.dueTurn)continue;
    const failure=eggFailure(egg),success=failure===null;
    egg.status=success?"hatched":"failed";egg.resolvedDate=egg.dueDate;
    egg.lifecycle.failure=failure;
    if(egg.care)continue;
    if(success){game.individuals[egg.embryo.id]=bornIndividual(egg.embryo);game.notices.push(egg.embryo.name+" 부화 · 정확히 12턴 후 성체");}
    else game.notices.push(failure==='genetic'?"유전적 비생존으로 부화 실패 · 공간 해제":failure==='health'?"배아 발달 실패 · 공간 해제":failure==="infertile"?"무정란 확정 · 공간 해제":"수정란 부화 실패 · 공간 해제");
  }
  for(const m of Object.values(game.matings))observeMating(game,m);
}
