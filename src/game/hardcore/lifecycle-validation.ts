import { canonicalJSON } from "@/game/save";
import { seededRandom } from "@/genetics/random";
import type { HardcoreGame } from "./model";
import { addDays } from "./time";
import { V12 } from "./lifecycle";
import { seasonEggSeed } from "./season";
import { createEmbryo } from "./offspring";
import { TRAIT_KEYS } from "@/genetics/traits";

const equal=(a:unknown,b:unknown)=>canonicalJSON(a)===canonicalJSON(b);
function assert(condition:unknown):asserts condition {if(!condition)throw new Error("v1.2 턴·성장·산란·수명 기록이 손상되었습니다.");}
function keys(value:object,names:string):void {assert(value&&Object.keys(value).sort().join()===names.split(" ").sort().join());}
export function validateLifecycle(game:HardcoreGame):void {
  assert(game.saveVersion===6&&game.rulesVersion===3&&game.time.mode==="turn");
  assert(game.rules.adultAfter===12&&game.rules.juvenileAfter===6&&game.rules.fertilizationChance===.95&&game.rules.hatchChance===.95&&game.rules.recoveryDays===4);
  for(const g of [...Object.values(game.individuals),...Object.values(game.shop.offers).map(o=>o.individual)]){
    assert(Number.isSafeInteger(g.lastProcessedTurn)&&g.lastProcessedTurn!<=game.turn);
    if(g.status==="owned")assert(g.lastProcessedTurn===game.turn);
    if(g.status==="dead")assert(g.deathCause==="starvation"||g.deathCause==="natural");
  }
  for(const m of Object.values(game.matings)){
    assert(Object.hasOwn(m,"lifecycle"));const s=m.lifecycle;if(!s)continue;
    keys(s,"startTurn nextLayTurn clutchesLaid maxClutches offspring");
    assert(m.fertilizationChance===V12.fertileChance&&m.hatchChance===V12.hatchChance);
    assert(m.resolvedDate!==null&&m.resolvedDate>=m.date&&m.resolvedDate<=game.lastDate);
    assert(Number.isSafeInteger(s.startTurn)&&s.startTurn<=game.turn&&s.startTurn>=0);
    assert([1,3].includes(s.maxClutches)&&Number.isSafeInteger(s.clutchesLaid)&&s.clutchesLaid>=0&&s.clutchesLaid<=s.maxClutches);
    assert(s.nextLayTurn===s.startTurn+2+s.clutchesLaid*4&&s.offspring.length===s.maxClutches*2);
    assert(m.status!=="pending"&&m.status!=="failed");
    assert(m.status==="laid"?s.clutchesLaid===s.maxClutches:m.status==="cancelled"||s.clutchesLaid<s.maxClutches&&s.nextLayTurn>game.turn);
    for(let i=0;i<s.offspring.length;i++){
      const o=s.offspring[i],clutch=Math.floor(i/2)+1,n=i%2+1,seed=seasonEggSeed(m,clutch,n);
      keys(o,"embryo fertilized");
      assert(o.fertilized===(seededRandom(seed,"fertilization")()<.95));
      const birthTurn=s.startTurn+2+(clutch-1)*4+4;
      assert(o.embryo.birthTurn===birthTurn&&o.embryo.birthDate===addDays(m.date,(birthTurn-s.startTurn)*7));
      const expected=createEmbryo(game,m,seed,o.embryo.id,o.embryo.name,birthTurn,o.embryo.birthDate);
      // Exp-derived phenotype scores can differ by one ULP between JS engines.
      // Genomes, seeds, all discrete records and the stored values remain exact.
      assert(TRAIT_KEYS.every(k=>Number.isFinite(o.embryo.potential[k])&&Math.abs(o.embryo.potential[k]-expected.potential[k])<=1e-12));
      assert(equal({...o.embryo,potential:expected.potential},expected));
      const egg=game.eggs[o.embryo.id+"-egg"];
      if(clutch<=s.clutchesLaid)assert(egg&&equal(egg.embryo,o.embryo)&&egg.seed===seed&&egg.lifecycle?.fertilized===o.fertilized);
      else assert(!egg);
    }
  }
  for(const egg of Object.values(game.eggs)){
    assert(Object.hasOwn(egg,"lifecycle"));const e=egg.lifecycle;if(!e){assert(egg.status!=="incubating");continue;}
    keys(e,"laidTurn dueTurn fertilized failure");
    assert(egg.hatchChance===V12.hatchChance);
    assert(Number.isSafeInteger(e.laidTurn)&&Number.isSafeInteger(e.dueTurn)&&e.laidTurn<=game.turn&&e.dueTurn===e.laidTurn+4);
    assert(egg.dueDate===addDays(egg.laidDate,28)&&egg.embryo.birthTurn===e.dueTurn&&typeof e.fertilized==="boolean");
    assert(egg.status==="incubating"?e.dueTurn>game.turn&&e.failure===null:
      e.dueTurn<=game.turn&&(egg.status==="hatched"?e.fertilized&&e.failure===null:e.failure===(e.fertilized?"hatch":"infertile")));
    if(e.dueTurn<=game.turn)assert((egg.status==="hatched")===(e.fertilized&&seededRandom(egg.seed,"hatch")()<V12.hatchChance));
  }
}
