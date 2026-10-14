import { forecastCross } from "@/genetics/mendel";
import { expandedGenotype, HARDCORE_LOCI } from "@/genetics/hardcore";
import { seededRandom } from "@/genetics/random";
import { checkKinship } from "@/game/lineage";
import type { Gecko, HardcoreGame, Mating } from "./model";
import { addDays, daysBetween } from "./time";
import { freeSlots } from "./survival";
import { advancedSafety, legacyRecord, observeMating } from "./genetics";
import { isV12, ageTurns } from "./lifecycle";
import { fertilizeSeason, seasonEvents } from "./season";
import { createEmbryo } from "./offspring";
import { breedingRisk } from './breeding-risk';

export function ovulating(g: Gecko, game: HardcoreGame): boolean {
  if(isV12(game))return g.sex==="female"&&g.status==="owned"&&g.stage==="adult"&&ageTurns(game,g)>=12&&ageTurns(game,g)<60&&game.turn>=g.nextBreedTurn&&!Object.values(game.matings).some(m=>m.parents.motherId===g.id&&m.status==="fertilized");
  const offset = daysBetween(g.cycleAnchor, game.lastDate);
  return g.sex === "female" && g.status === "owned" && g.stage === "adult" &&
    game.lastDate >= g.recoverUntil && offset >= 0 && offset % game.rules.ovulationCycleDays < game.rules.ovulationWindowDays;
}
export function nextOvulation(g: Gecko, game: HardcoreGame): string {
  if(isV12(game))return ageTurns(game,g)>=60?"번식 은퇴":addDays(game.lastDate,Math.max(0,g.nextBreedTurn-game.turn)*7);
  let date = [game.lastDate, g.recoverUntil, addDays(g.birthDate, game.rules.adultAfter), g.cycleAnchor].sort().at(-1)!;
  for (let i = 0; i < game.rules.ovulationCycleDays; i++) {
    if (daysBetween(g.cycleAnchor, date) % game.rules.ovulationCycleDays < game.rules.ovulationWindowDays) return date;
    date = addDays(date, 1);
  }
  return date;
}
export function breedingCheck(game: HardcoreGame, fatherId: string, motherId: string) {
  const father = game.individuals[fatherId], mother = game.individuals[motherId];
  if (!father || !mother) return { reasons: ["수컷과 암컷 부모를 선택하세요."], forecast: null };
  const reasons: string[] = [];
  if (father.sex !== "male" || mother.sex !== "female") reasons.push("성체 수컷과 암컷을 선택해야 합니다.");
  for (const parent of [father,mother]) {
    if (parent.status !== "owned" || parent.hearts < 1) reasons.push(parent.name + ": 보유 중인 생존 개체만 교배할 수 있습니다.");
    if (parent.stage !== "adult" || (isV12(game)&&ageTurns(game,parent)<12)) reasons.push(parent.name + ": 12턴 성체가 되어야 합니다.");
    if(isV12(game)&&ageTurns(game,parent)>=60)reasons.push(parent.name+": 60턴부터 신규 교배가 불가능합니다(번식 은퇴).");
    if (parent.nextBreedTurn > game.turn) reasons.push(parent.name + ": 회복 기간입니다.");
  }
  if (!ovulating(mother, game)) reasons.push("암컷은 배란기여야 합니다. 다음 배란: " + nextOvulation(mother, game));
  if (Object.values(game.matings).some(m => m.parents.motherId === motherId && ["pending", "fertilized"].includes(m.status))) reasons.push("이미 번식 일정이 진행 중입니다.");
  const kin = checkKinship(father, mother, game.individuals); if (kin&&game.saveVersion<9) reasons.push(kin.message);
  const forecast = forecastCross(expandedGenotype(father.genotype), expandedGenotype(mother.genotype), HARDCORE_LOCI);
  if(game.saveVersion<9){
    if (forecast.nonViableProbability > 0) reasons.push("동형접합 비생존 위험 교배를 차단합니다.");
    reasons.push(...advancedSafety(father,mother));
  }
  const slots=2,available=freeSlots(game);
  if (available < slots) reasons.push(`인큐베이터 빈 슬롯 ${available}개 / 필요 ${slots}개 · ${slots-available}개 부족합니다. 사육 공간을 확보하거나 확장하세요.`);
  if (Object.keys(game.individuals).length + Object.keys(game.eggs).length + 2 > 30000) reasons.push("이 슬롯의 기록 한도에 도달했습니다. 백업을 보관하고 새 게임을 시작하세요.");
  return { reasons, forecast };
}
/** v9 snapshots and fixes both egg outcomes at conception; old daily rules remain versioned. */
export function startMating(game: HardcoreGame, fatherId: string, motherId: string, riskAcknowledgement?:string): void {
  const check = breedingCheck(game, fatherId, motherId); if (check.reasons.length) throw new Error(check.reasons.join(" "));
  const father = game.individuals[fatherId], mother = game.individuals[motherId];
  if(game.saveVersion>=9){
    const risk=breedingRisk(game,father,mother);
    if(risk.warnings.length&&riskAcknowledgement!==risk.acknowledgement)throw new Error('교배 위험을 확인한 뒤 다시 실행하세요.');
  }
  const ordinal=game.nextClutch++;
  const id = game.gameId + "-m" + ordinal;
  game.matings[id] = { id, ordinal, date: game.lastDate, parents: { fatherId, motherId },
    fatherGenotype: structuredClone(father.genotype), motherGenotype: structuredClone(mother.genotype),
    fatherTraits: { ...father.potential }, motherTraits: { ...mother.potential },
    generation: Math.max(father.generation, mother.generation) + 1,
    lineageIds: [...new Set([...father.lineageIds, ...mother.lineageIds])],
    seed: game.seed + "|mating:" + ordinal + "|" + fatherId + "|" + motherId,
    fertilizationChance: game.rules.fertilizationChance, hatchChance: game.rules.hatchChance,
    status: "pending", resolvedDate: null, genetics: {
      father:structuredClone(father.genetics??legacyRecord(father)),mother:structuredClone(mother.genetics??legacyRecord(mother)),
      observedIds:[],updates:[] } };
  if(game.saveVersion>=9)game.matings[id].riskModel={version:1,father:structuredClone(father.healthGenome!),mother:structuredClone(mother.healthGenome!)};
  if(isV12(game)){fertilizeSeason(game,game.matings[id]);game.notices.push("교배 성공 · 인큐베이터 2칸 예약 · 2턴 후 알 2개 산란 · 유전 결과 확정");return;}
  mother.recoverUntil = addDays(game.lastDate, game.rules.recoveryDays);
  mother.nextBreedTurn = game.turn + game.rules.recoveryDays;
  game.notices.push("교배 일정 시작 · 새끼 공간 2칸 예약 · 내일 수정 결과 공개");
}
function lay(game: HardcoreGame, mating: Mating): void {
  const dueDate = addDays(mating.date, 3);
  for (let ordinal = 1; ordinal <= 2; ordinal++) {
    const seed = mating.seed + "|egg:" + ordinal;
    const childId = game.gameId + "-c" + mating.ordinal + "-" + ordinal;
    const embryo=createEmbryo(game,mating,seed,childId,"해칭 "+mating.ordinal+"-"+ordinal,game.turn+1,dueDate);
    const id = childId + "-egg";
    game.eggs[id] = { id, matingId: mating.id, laidDate: game.lastDate, dueDate, embryo,
      hatchChance: mating.hatchChance, seed, status: "incubating", resolvedDate: null };
  }
  mating.status = "laid"; mating.resolvedDate = game.lastDate;
  game.notices.push("알 2개 산란 · 내일 부화 결과 공개");
}
/** Called after old animals lose hearts; hatchlings enter with five hearts afterwards. */
export function breedingEvents(game: HardcoreGame): void {
  if(isV12(game)){seasonEvents(game);return;}
  for (const m of Object.values(game.matings)) {
    if (m.status !== "pending" && m.status !== "fertilized") continue;
    if (game.individuals[m.parents.motherId].status !== "owned") {
      m.status = "cancelled"; m.resolvedDate = game.lastDate; game.notices.push("암컷 폐사로 산란 전 번식 일정 취소"); continue;
    }
    if (m.status === "pending" && daysBetween(m.date, game.lastDate) >= 1) {
      m.status = seededRandom(m.seed, "fertilization")() < m.fertilizationChance ? "fertilized" : "failed";
      m.resolvedDate = game.lastDate;
      game.notices.push(m.status === "fertilized" ? "수정 성공 · 내일 산란 예정" : "수정 실패 · 공간 예약 해제");
    }
    if (m.status === "fertilized" && daysBetween(m.date, game.lastDate) >= 2) lay(game, m);
  }
  for (const egg of Object.values(game.eggs)) {
    if (egg.status !== "incubating" || egg.dueDate > game.lastDate) continue;
    const success = seededRandom(egg.seed, "hatch")() < egg.hatchChance;
    egg.status = success ? "hatched" : "failed"; egg.resolvedDate = egg.dueDate;
    if (success) {
      game.individuals[egg.embryo.id] = structuredClone(egg.embryo);
      game.notices.push(egg.embryo.name + " 부화 · 성체가 되면 성별 공개");
    } else game.notices.push("알 부화 실패 · 공간 예약 해제");
  }
  for(const mating of Object.values(game.matings))if(mating.status==="laid")observeMating(game,mating);
}
