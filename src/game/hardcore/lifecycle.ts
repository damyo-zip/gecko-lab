import { seededRandom } from "@/genetics/random";
import type { Gecko, HardcoreGame } from "./model";
import { owned } from "./survival";
import {challengeFeedSlots} from './challenges';

/** Confirmed v1.2 game rules. Probabilities describe the game, not veterinary advice. */
export const V12 = Object.freeze({ daysPerTurn: 7, juvenileAfter: 6, adultAfter: 12,
  firstLayAfter: 2, eggsPerClutch: 2, maxClutches: 1, restAfter: 4,
  hatchAfter: 4, fertileChance: .95, hatchChance: .95, seniorAfter: 50, retireAfter: 60 });
export const isV12 = (game: Pick<HardcoreGame,"rulesVersion">) => game.rulesVersion >= 3;
export const ageTurns = (game: Pick<HardcoreGame,"turn">, gecko: Pick<Gecko,"birthTurn">) => Math.max(0, game.turn - gecko.birthTurn);
export function naturalDeathProbability(age: number): number {
  return age < 65 ? 0 : age < 70 ? .01 : age < 75 ? .03 : age < 80 ? .08 : age < 85 ? .18 : age < 90 ? .4 : 1;
}
export function lifeStage(game: HardcoreGame, g: Gecko): string {
  const age=ageTurns(game,g);
  return age>=V12.retireAfter ? "번식 은퇴" : age>=V12.seniorAfter ? "노령기" : g.stage==="adult" ? "성체" : g.stage==="juvenile" ? "아성체" : "해칭";
}
export function foodDemand(game: HardcoreGame): { animals:number; exempt:number; needed:number; missing:number } {
  const animals=owned(game).length,exempt=isV12(game)?Math.min(animals,challengeFeedSlots(game)):0;
  const needed=animals-exempt;return {animals,exempt,needed,missing:Math.max(0,needed-game.food)};
}
function die(game: HardcoreGame, g: Gecko, cause: "starvation" | "natural"): void {
  g.status="dead";g.hearts=0;g.diedDate=game.lastDate;g.deathCause=cause;
  game.notices.push(g.name+(cause==="natural"?" 자연사":" 사료 부족으로 폐사")+" · 혈통·유전·번식 기록 보존");
}
/** Earned challenge milestones cover meals in health-priority order,
 * without assignable slots. Hatch rewards earned later this turn first affect
 * the following turn. Eggs and unclaimed hatchlings do not eat yet. */
export function processCareAndLifespan(game: HardcoreGame): void {
  const animals=owned(game).sort((a,b)=>a.hearts-b.hearts||a.id.localeCompare(b.id));
  let freeRemaining=foodDemand(game).exempt,fed=0,unfed=0,exempt=0;
  for(const g of animals){
    const free=freeRemaining>0;if(free)freeRemaining--;
    if(g.lastProcessedTurn===game.turn)continue;
    g.lastProcessedTurn=game.turn;
    if(free||game.food>0){if(free)exempt++;else game.food--;g.lastFedDate=game.lastDate;g.hearts=Math.min(5,g.hearts+1);fed++;}
    else {unfed++;g.hearts--;if(g.hearts===0)die(game,g,"starvation");}
    if(g.status!=="owned")continue;
    const probability=naturalDeathProbability(ageTurns(game,g));
    if(probability>0&&seededRandom(game.seed+"|"+g.id,"natural-death:"+ageTurns(game,g))()<probability)die(game,g,"natural");
  }
  if(fed+unfed)game.notices.push(`자동 급여 ${fed}마리 · 사료 ${fed-exempt}개 소비${exempt?` · 먹이 면제 ${exempt}마리`:""}${unfed?` · ${unfed}마리 미급여, 하트 −1`:""}`);
}
