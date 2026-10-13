import { forecastCross, inheritGenotype, lillyGenotype, normalGenotype, type CrossForecast } from "@/genetics/mendel";
import { seedId, seededRandom } from "@/genetics/random";
import { DEFAULT_VARIATION, inheritTraits, type PotentialTraits } from "@/genetics/traits";
import { checkKinship } from "./lineage";
import { growthStage, type GameAction, type GameRules, type GameState, type Individual } from "./model";
import { validateGameState, validateRules } from "./validation";

export const DEFAULT_RULES: GameRules = {
  clutchSize: 2, incubationTurns: 2, juvenileAfter: 3, adultAfter: 6, cooldownTurns: 2,
  traitVariation: { ...DEFAULT_VARIATION },
};
const FOUNDERS: { name: string; sex: Individual["sex"]; lilly: boolean; potential: PotentialTraits }[] = [
  { name: "치즈", sex: "male", lilly: false, potential: { bodyTone: .7, redIntensity: .65, creamCoverage: .2, dorsalIntensity: .35, flankIntensity: .42, spotDensity: .03 } },
  { name: "모카", sex: "female", lilly: true, potential: { bodyTone: .65, redIntensity: .25, creamCoverage: .9, dorsalIntensity: .8, flankIntensity: .85, spotDensity: .02 } },
  { name: "할리", sex: "male", lilly: false, potential: { bodyTone: .25, redIntensity: .35, creamCoverage: .55, dorsalIntensity: .75, flankIntensity: .9, spotDensity: .05 } },
  { name: "도트", sex: "female", lilly: false, potential: { bodyTone: .6, redIntensity: .55, creamCoverage: .3, dorsalIntensity: .3, flankIntensity: .35, spotDensity: .75 } },
  { name: "밀크", sex: "male", lilly: true, potential: { bodyTone: .5, redIntensity: .4, creamCoverage: .85, dorsalIntensity: .8, flankIntensity: .8, spotDensity: .08 } },
  { name: "루나", sex: "female", lilly: false, potential: { bodyTone: .2, redIntensity: .2, creamCoverage: .5, dorsalIntensity: .5, flankIntensity: .7, spotDensity: .1 } },
];
export function createNewGame(seed = "GECKO-LAB-START", overrides: Partial<GameRules> = {}): GameState {
  if (!seed.trim() || seed.length > 128) throw new Error("게임 시드는 1~128자여야 합니다.");
  const rules = { ...DEFAULT_RULES, ...overrides, traitVariation: { ...DEFAULT_VARIATION, ...overrides.traitVariation } };
  validateRules(rules);
  const gameId = "g-" + seedId(seed, "game-id");
  const individuals = Object.fromEntries(FOUNDERS.map((founder, index) => {
    const id = gameId + "-f" + (index + 1);
    const individual: Individual = {
      id, name: founder.name, sex: founder.sex, birthTurn: -rules.adultAfter, stage: "adult",
      parents: null, generation: 1, genotype: founder.lilly ? lillyGenotype() : normalGenotype(),
      potential: { ...founder.potential }, visualSeed: id + "-" + seedId(seed, "founder:" + index), nextBreedTurn: 0,
    };
    return [id, individual];
  }));
  const state: GameState = {
    saveVersion: 2, rulesVersion: 1, gameId, seed, revision: 0, turn: 0, nextClutch: 1,
    rules, individuals, eggs: {},
  };
  validateGameState(state);
  return state;
}

export interface BreedingCheck { allowed: boolean; reasons: string[]; forecast: CrossForecast | null }
export function checkBreeding(game: GameState, fatherId: string, motherId: string): BreedingCheck {
  const father = game.individuals[fatherId], mother = game.individuals[motherId];
  if (!father || !mother) return { allowed: false, reasons: ["수컷과 암컷 부모를 선택해 주세요."], forecast: null };
  const reasons: string[] = [];
  if (father.sex !== "male" || mother.sex !== "female") reasons.push("수컷과 암컷을 각각 선택해야 합니다.");
  for (const parent of [father, mother]) {
    if (growthStage(parent, game.turn, game.rules) !== "adult") reasons.push(parent.name + ": 성체가 되어야 교배할 수 있습니다.");
    if (parent.nextBreedTurn > game.turn) reasons.push(parent.name + ": TURN " + parent.nextBreedTurn + "부터 다시 교배할 수 있습니다.");
  }
  const relationship = checkKinship(father, mother, game.individuals);
  if (relationship) reasons.push(relationship.message);
  const forecast = forecastCross(father.genotype, mother.genotype);
  if (forecast.nonViableProbability > 0) reasons.push("릴리화이트 × 릴리화이트: 동형접합 비생존 위험이 있어 실행을 차단합니다.");
  if (Object.keys(game.individuals).length + Object.values(game.eggs).filter((egg) => egg.status === "incubating").length + 2 > 3000)
    reasons.push("이 저장 슬롯의 개체 한도(3,000마리)에 도달했습니다. JSON 백업을 먼저 보관하세요.");
  return { allowed: reasons.length === 0, reasons, forecast };
}

export function breed(game: GameState, fatherId: string, motherId: string): GameState {
  const check = checkBreeding(game, fatherId, motherId);
  if (!check.allowed) throw new Error(check.reasons.join(" "));
  const father = game.individuals[fatherId], mother = game.individuals[motherId];
  const parents = { fatherId, motherId };
  const dueTurn = game.turn + game.rules.incubationTurns;
  const next: GameState = { ...game, revision: game.revision + 1, nextClutch: game.nextClutch + 1,
    individuals: { ...game.individuals }, eggs: { ...game.eggs } };
  for (const parent of [father, mother])
    next.individuals[parent.id] = { ...parent, nextBreedTurn: game.turn + game.rules.cooldownTurns };
  for (let ordinal = 1; ordinal <= 2; ordinal++) {
    const seed = game.seed + "|clutch:" + game.nextClutch + "|egg:" + ordinal + "|parents:" + fatherId + ":" + motherId;
    const inheritance = inheritGenotype(father.genotype, mother.genotype, seed);
    if (!inheritance.viable) throw new Error("비생존 결과는 알이나 컬렉션에 등록하지 않습니다.");
    const childId = game.gameId + "-c" + game.nextClutch + "-" + ordinal;
    const embryo: Individual = {
      id: childId, name: "해칭 " + game.nextClutch + "-" + ordinal,
      sex: seededRandom(seed, "sex")() < .5 ? "male" : "female", birthTurn: dueTurn,
      stage: "hatchling", parents: { ...parents }, generation: Math.max(father.generation, mother.generation) + 1,
      genotype: inheritance.genotype, potential: inheritTraits(father.potential, mother.potential, seed, game.rules.traitVariation),
      visualSeed: childId + "-" + seedId(seed, "visual"), nextBreedTurn: dueTurn + game.rules.adultAfter,
    };
    const eggId = childId + "-egg";
    next.eggs[eggId] = { id: eggId, clutch: game.nextClutch, laidTurn: game.turn, dueTurn,
      parents: { ...parents }, embryo, status: "incubating", hatchedTurn: null };
  }
  return next;
}

export function advanceTurns(game: GameState, turns: number): GameState {
  if (!Number.isInteger(turns) || turns < 1 || turns > 30) throw new Error("시간은 한 번에 1~30턴 진행할 수 있습니다.");
  const turn = game.turn + turns;
  const next: GameState = { ...game, revision: game.revision + 1, turn,
    individuals: { ...game.individuals }, eggs: { ...game.eggs } };
  for (const egg of Object.values(game.eggs)) {
    if (egg.status === "incubating" && egg.dueTurn <= turn) {
      next.individuals[egg.embryo.id] = structuredClone(egg.embryo);
      next.eggs[egg.id] = { ...egg, status: "hatched", hatchedTurn: egg.dueTurn };
    }
  }
  for (const individual of Object.values(next.individuals))
    next.individuals[individual.id] = { ...individual, stage: growthStage(individual, turn, game.rules) };
  return next;
}

export function applyAction(game: GameState, action: GameAction): GameState {
  validateGameState(game);
  let next: GameState;
  if (action.type === "breed") next = breed(game, action.fatherId, action.motherId);
  else if (action.type === "advance") next = advanceTurns(game, action.turns);
  else {
    const name = action.name.trim(), individual = game.individuals[action.id];
    if (!individual) throw new Error("개체를 찾을 수 없습니다.");
    if (!name || name.length > 24) throw new Error("이름은 1~24자여야 합니다.");
    next = { ...game, revision: game.revision + 1, individuals: { ...game.individuals, [action.id]: { ...individual, name } } };
  }
  validateGameState(next);
  return next;
}
