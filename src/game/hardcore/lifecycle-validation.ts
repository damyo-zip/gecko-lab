import { canonicalJSON } from "@/game/save";
import { seededRandom } from "@/genetics/random";
import type { HardcoreGame } from "./model";
import { addDays } from "./time";
import { V12, MONTHLY, isMonthly, lifecycleRules } from "./lifecycle";
import {turnDate} from './monthly-calendar';
import {dateNumber} from './time';
import { seasonEggSeed } from "./season";
import { createEmbryo } from "./offspring";
import { TRAIT_KEYS } from "@/genetics/traits";
import { atBirth, waitingForCollection } from './brood-care';
import { fertileChance, eggFailure } from './egg-outcome';

const equal=(a:unknown,b:unknown)=>canonicalJSON(a)===canonicalJSON(b);
function assert(condition:unknown):asserts condition {if(!condition)throw new Error("v1.2 턴·성장·산란·수명 기록이 손상되었습니다.");}
function keys(value:object,names:string):void {assert(value&&Object.keys(value).sort().join()===names.split(" ").sort().join());}
export function validateLifecycle(game:HardcoreGame):void {
  assert([6,7,8,9,10].includes(game.saveVersion)&&[3,4,5].includes(game.rulesVersion)&&game.time.mode==="turn");
  const current=lifecycleRules(game);
  if(isMonthly(game)){
    const c=game.monthlyCalendar;assert(c);keys(c,"version turn date legacy");
    assert(c.version===1&&typeof c.legacy==='boolean'&&Number.isSafeInteger(c.turn)&&c.turn>=0&&c.turn<=game.turn);dateNumber(c.date);
    assert(c.date>=game.startedDate&&c.date<=game.lastDate&&(!c.legacy?c.turn===0&&c.date===game.startedDate:true));
    assert(game.lastDate===turnDate(game,game.turn));
  }else assert(!Object.hasOwn(game,'monthlyCalendar'));
  assert(game.rules.adultAfter===current.adultAfter&&game.rules.juvenileAfter===6&&game.rules.fertilizationChance===.95&&game.rules.hatchChance===.95&&game.rules.recoveryDays===current.restAfter);
  for(const g of [...Object.values(game.individuals),...Object.values(game.shop.offers).map(o=>o.individual)]){
    assert(Number.isSafeInteger(g.lastProcessedTurn)&&g.lastProcessedTurn!<=game.turn);
    if(g.status==="owned")assert(g.lastProcessedTurn===game.turn);
    if(g.status==="dead")assert(g.deathCause==="starvation"||g.deathCause==="natural");
  }
  for(const m of Object.values(game.matings)){
    if(Object.hasOwn(m,'timingVersion'))assert(isMonthly(game)&&m.timingVersion===2&&m.lifecycle);
    const timing=m.timingVersion===2?MONTHLY:V12;
    assert(Object.hasOwn(m,"lifecycle"));const s=m.lifecycle;if(!s)continue;
    keys(s,"startTurn nextLayTurn clutchesLaid maxClutches offspring");
    assert(m.fertilizationChance===V12.fertileChance&&m.hatchChance===V12.hatchChance);
    assert(m.resolvedDate!==null&&m.resolvedDate>=m.date&&m.resolvedDate<=game.lastDate);
    assert(Number.isSafeInteger(s.startTurn)&&s.startTurn<=game.turn&&s.startTurn>=0);
    assert(Number.isSafeInteger(s.clutchesLaid)&&s.clutchesLaid>=0&&s.clutchesLaid<=s.maxClutches);
    if(game.rulesVersion===3){
      // Validate the previous schema before migrating it; never create these schedules.
      assert([1,3].includes(s.maxClutches)&&s.nextLayTurn===s.startTurn+2+s.clutchesLaid*4);
    }else{
      const historical=s.clutchesLaid>1&&["laid","cancelled"].includes(m.status);
      assert(s.maxClutches===1||historical&&[2,3].includes(s.maxClutches)&&s.maxClutches===s.clutchesLaid);
      const lastLay=Object.values(game.eggs).filter(e=>e.matingId===m.id).reduce((last,e)=>Math.max(last,e.lifecycle?.laidTurn??last),s.startTurn+timing.firstLayAfter);
      assert(s.nextLayTurn===(historical?lastLay:s.startTurn+timing.firstLayAfter));
    }
    assert(s.offspring.length===s.maxClutches*2);
    assert(m.status!=="pending"&&m.status!=="failed");
    assert(m.status==="laid"?s.clutchesLaid===s.maxClutches:m.status==="cancelled"||s.clutchesLaid<s.maxClutches&&s.nextLayTurn>game.turn);
    for(let i=0;i<s.offspring.length;i++){
      const o=s.offspring[i],clutch=Math.floor(i/2)+1,n=i%2+1,seed=seasonEggSeed(m,clutch,n);
      keys(o,"embryo fertilized");
      assert(o.fertilized===(seededRandom(seed,"fertilization")()<fertileChance(m)));
      const egg=game.eggs[o.embryo.id+"-egg"];
      const historical=game.rulesVersion>=4&&clutch>1;
      const birthTurn=historical?egg?.lifecycle?.dueTurn:s.startTurn+timing.firstLayAfter+(clutch-1)*timing.restAfter+timing.hatchAfter;
      assert(birthTurn!==undefined&&o.embryo.birthTurn===birthTurn&&o.embryo.birthDate===(historical?egg?.dueDate:addDays(m.date,(birthTurn-s.startTurn)*timing.daysPerTurn)));
      // Replay the validated saved appearance version, not the current factory
      // default. Pending old embryos must keep their original pixels after upgrade.
      const replay=m.timingVersion===2?game:{...game,rulesVersion:4 as const,rules:{...game.rules,adultAfter:12}};
      const expected=createEmbryo(replay,m,seed,o.embryo.id,o.embryo.name,birthTurn,o.embryo.birthDate,o.embryo.genetics?.appearanceVersion==="patterns-1");
      if(game.saveVersion>=9&&!m.riskModel)expected.healthGenome=o.embryo.healthGenome;
      // Exp-derived phenotype scores can differ by one ULP between JS engines.
      // Genomes, seeds, all discrete records and the stored values remain exact.
      assert(TRAIT_KEYS.every(k=>Number.isFinite(o.embryo.potential[k])&&Math.abs(o.embryo.potential[k]-expected.potential[k])<=1e-12));
      assert(equal({...o.embryo,potential:expected.potential},expected));
      if(clutch<=s.clutchesLaid)assert(egg&&equal(egg.embryo,egg.care?atBirth(o.embryo,egg.lifecycle!.dueTurn,egg.dueDate,egg.timing?MONTHLY:V12):o.embryo)&&egg.seed===seed&&egg.lifecycle?.fertilized===o.fertilized);
      else assert(!egg);
    }
  }
  for(const egg of Object.values(game.eggs)){
    assert(Object.hasOwn(egg,"lifecycle"));const e=egg.lifecycle;if(!e){assert(!egg.timing&&egg.status!=="incubating");continue;}
    keys(e,"laidTurn dueTurn fertilized failure");
    if(egg.timing){keys(egg.timing,"version hatchAfter");assert(isMonthly(game)&&egg.timing.version===2&&[3,4].includes(egg.timing.hatchAfter));}
    const hatchAfter=egg.timing?.hatchAfter??4;
    assert(egg.hatchChance===V12.hatchChance);
    assert(Number.isSafeInteger(e.laidTurn)&&Number.isSafeInteger(e.dueTurn)&&e.laidTurn<=game.turn&&e.dueTurn===(egg.care?.collectedTurn??e.laidTurn)+hatchAfter);
    assert(egg.dueDate===(egg.timing?turnDate(game,e.dueTurn):addDays(egg.laidDate,(e.dueTurn-e.laidTurn)*7))&&egg.embryo.birthTurn===e.dueTurn&&typeof e.fertilized==="boolean");
    if(waitingForCollection(egg))continue;
    assert(egg.status==="incubating"?e.dueTurn>game.turn&&e.failure===null:
      e.dueTurn<=game.turn&&(egg.status==="hatched"?e.fertilized&&e.failure===null:e.failure===eggFailure(egg)));
    if(e.dueTurn<=game.turn)assert((egg.status==="hatched")===(eggFailure(egg)===null));
  }
}
