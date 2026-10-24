import type {HardcoreGame} from './model';
import {MONTHLY} from './lifecycle';
import {turnDate} from './monthly-calendar';
import {atBirth} from './brood-care';
/** Keep IDs, conception DNA, completed history and every remaining turn.
 * Existing numeric turn ages become month ages; only live growth is reclassified. */
export function migrateMonthly(source:HardcoreGame):HardcoreGame {
 if(source.rulesVersion===5)return source;
 const game=structuredClone(source);
 game.rulesVersion=5;game.monthlyCalendar={version:1,turn:game.turn,date:game.lastDate,legacy:true};
 game.rules={...game.rules,juvenileAfter:6,adultAfter:18,recoveryDays:2};
 for(const g of [...Object.values(game.individuals),...Object.values(game.shop.offers).map(o=>o.individual)]){
  if(g.status!=='owned')continue;
  const age=Math.max(0,game.turn-g.birthTurn);g.stage=age>=18?'adult':age>=6?'juvenile':'hatchling';
 }
 for(const egg of Object.values(game.eggs)){
  if(egg.status!=='incubating'||!egg.lifecycle)continue;
  egg.timing={version:2,hatchAfter:4};
  egg.dueDate=turnDate(game,egg.lifecycle.dueTurn);
  egg.embryo=atBirth(egg.embryo,egg.lifecycle.dueTurn,egg.dueDate,MONTHLY);
 }
 game.revision++;return game;
}
