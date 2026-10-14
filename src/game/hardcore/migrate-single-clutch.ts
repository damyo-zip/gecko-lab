import type { HardcoreGame } from "./model";
import { addDays } from "./time";

/** Rule 3 → 4: keep laid eggs and fixed inheritance, release only unlaid reservations. */
export function migrateSingleClutch(source:HardcoreGame):HardcoreGame {
  if(source.rulesVersion!==3)return source;
  const game=structuredClone(source);game.rulesVersion=4;game.revision++;
  const latest=new Map<string,string>();
  for(const m of Object.values(game.matings).sort((a,b)=>a.ordinal-b.ordinal))latest.set(m.parents.motherId,m.id);
  for(const m of Object.values(game.matings)){
    const s=m.lifecycle;if(!s)continue;
    const eggs=Object.values(game.eggs).filter(e=>e.matingId===m.id);
    s.maxClutches=Math.max(1,s.clutchesLaid);
    s.offspring=s.offspring.slice(0,s.maxClutches*2);
    const lastEgg=eggs.sort((a,b)=>a.laidDate.localeCompare(b.laidDate)).at(-1);
    const layTurn=lastEgg?.lifecycle?.laidTurn??s.startTurn+2;
    const layDate=lastEgg?.laidDate??addDays(m.date,14);
    s.nextLayTurn=layTurn;
    if(s.clutchesLaid>0&&m.status==="fertilized"){m.status="laid";m.resolvedDate=layDate;}
    const mother=game.individuals[m.parents.motherId];
    if(latest.get(mother.id)===m.id&&mother.status==="owned"&&m.status!=="cancelled"){
      mother.nextBreedTurn=layTurn+4;mother.recoverUntil=addDays(layDate,28);
    }
  }
  game.notices=[...game.notices,"교배 규칙 이전 완료 · 1회 산란·2알·2슬롯 예약 · 기존 알·유전·혈통 기록 보존"].slice(-60);
  return game;
}
