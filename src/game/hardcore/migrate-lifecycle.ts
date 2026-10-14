import type { Gecko, HardcoreGame } from "./model";
import { BALANCE } from "./balance";
import { addDays, daysBetween } from "./time";
import { fertilizeSeason } from "./season";

/** No elapsed-time simulation, death, genetic regeneration or market re-pricing on migration. */
export function migrateV12(source:HardcoreGame):HardcoreGame {
  if(source.saveVersion===6)return source;
  const game=structuredClone(source);
  game.saveVersion=6;game.rulesVersion=3;game.time.mode="turn";
  game.rules={...game.rules,adultAfter:12,juvenileAfter:6,recoveryDays:4,fertilizationChance:.95,hatchChance:.95};
  const convert=(g:Gecko,future=false)=>{
    if(!future&&g.status==="owned"){
      // Keep adults adult; immature animals use their existing turn age with fixed thresholds.
      if(g.stage==="adult")g.birthTurn=Math.min(g.birthTurn,game.turn-12);
      const age=game.turn-g.birthTurn;g.stage=age>=12?"adult":age>=6?"juvenile":"hatchling";
      g.nextBreedTurn=Math.max(g.nextBreedTurn,g.birthTurn+12,0);
    }
    g.deathCause=g.status==="dead"?"starvation":null;g.lastProcessedTurn=future?g.birthTurn:game.turn;
  };
  Object.values(game.individuals).forEach(g=>convert(g));
  Object.values(game.shop.offers).forEach(o=>convert(o.individual));
  for(const egg of Object.values(game.eggs)){
    convert(egg.embryo,true);egg.lifecycle=null;
    if(egg.status==="incubating"){
      const elapsed=Math.min(3,Math.max(0,daysBetween(egg.laidDate,game.lastDate)));
      egg.laidDate=addDays(game.lastDate,-elapsed*7);egg.dueDate=addDays(egg.laidDate,28);
      egg.lifecycle={laidTurn:game.turn-elapsed,dueTurn:game.turn-elapsed+4,fertilized:true,failure:null};
      egg.hatchChance=BALANCE.hatchChance;egg.embryo.birthTurn=egg.lifecycle.dueTurn;egg.embryo.birthDate=egg.dueDate;
      egg.embryo.nextBreedTurn=egg.embryo.birthTurn+12;egg.embryo.lastProcessedTurn=egg.embryo.birthTurn;
      egg.embryo.cycleAnchor=egg.embryo.recoverUntil=addDays(egg.dueDate,84);
    }else{
      const child=game.individuals[egg.embryo.id];
      if(child){egg.embryo.birthTurn=child.birthTurn;egg.embryo.nextBreedTurn=child.birthTurn+12;egg.embryo.lastProcessedTurn=child.birthTurn;}
    }
  }
  for(const m of Object.values(game.matings)){
    m.lifecycle=null;
    if(m.status==="pending"||m.status==="fertilized"){
      const elapsed=Math.min(1,Math.max(0,daysBetween(m.date,game.lastDate))),startTurn=Math.max(0,game.turn-elapsed);
      m.date=addDays(game.lastDate,-(game.turn-startTurn)*7);
      fertilizeSeason(game,m,startTurn,1);
    }
  }
  game.notices=[...game.notices,"v1.2 이전 완료 · 1턴 7일 · 자동 급여 · 12턴 성체 · 시간은 턴 마치기로만 진행"].slice(-60);
  game.revision++;
  return game;
}
