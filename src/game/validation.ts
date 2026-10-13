import { canonicalPair, forecastCross, isViablePair, SUPPORTED_LOCI, validateGenotype, type Genotype } from "@/genetics/mendel";
import { TRAIT_KEYS, validateTraits } from "@/genetics/traits";
import { growthStage, type Egg, type GameRules, type GameState, type Individual, type Parents } from "./model";
import { checkKinship } from "./lineage";

const MAX_RECORDS = 3000;
function fail(reason: string): never { throw new Error("저장 데이터 오류: " + reason); }
function object(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(label + " 형식");
}
function integer(value: unknown, label: string, min = 0, max = 1_000_000_000): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) fail(label + " 수치");
}
function text(value: unknown, label: string, max = 128): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > max) fail(label + " 문자열");
}
function id(value: unknown): asserts value is string {
  text(value, "ID", 96);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]+$/.test(value) || ["constructor", "prototype"].includes(value)) fail("ID 형식");
}
function knownKeys(value: Record<string,unknown>, allowed: readonly string[], label: string): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) fail(label + "에 지원하지 않는 필드가 있습니다");
}

export function validateRules(value: unknown): asserts value is GameRules {
  object(value, "게임 규칙");
  knownKeys(value,["clutchSize","incubationTurns","juvenileAfter","adultAfter","cooldownTurns","traitVariation"],"규칙");
  if (value.clutchSize !== 2) fail("한 클러치는 알 2개여야 합니다");
  integer(value.incubationTurns, "부화 기간", 1, 30);
  integer(value.juvenileAfter, "아성체 기간", 1, 100);
  integer(value.adultAfter, "성체 기간", 2, 200);
  integer(value.cooldownTurns, "교배 대기", 0, 100);
  if (value.adultAfter <= value.juvenileAfter) fail("성장 단계 순서");
  validateTraits(value.traitVariation as GameRules["traitVariation"]);
}
function validateParents(value: unknown): asserts value is Parents {
  object(value, "부모");
  knownKeys(value,["fatherId","motherId"],"부모");
  id(value.fatherId); id(value.motherId);
  if (value.fatherId === value.motherId) fail("부모 ID 중복");
}
function validateIndividual(value: unknown): asserts value is Individual {
  object(value, "개체");
  knownKeys(value,["id","name","sex","birthTurn","stage","parents","generation","genotype","potential","visualSeed","nextBreedTurn"],"개체");
  id(value.id); text(value.name, "이름", 24); text(value.visualSeed, "외형 시드");
  if (!["male", "female"].includes(String(value.sex))) fail("성별");
  if (!["hatchling", "juvenile", "adult"].includes(String(value.stage))) fail("성장 단계");
  integer(value.birthTurn, "출생 턴", -200);
  integer(value.generation, "세대", 1, MAX_RECORDS);
  integer(value.nextBreedTurn, "다음 교배 턴");
  if (value.parents !== null) validateParents(value.parents);
  object(value.genotype, "유전형");
  validateGenotype(value.genotype as unknown as Genotype);
  for (const definition of SUPPORTED_LOCI)
    if (!isViablePair((value.genotype as unknown as Genotype).loci[definition.id], definition)) fail("비생존 유전형은 개체로 등록할 수 없습니다");
  validateTraits(value.potential as Individual["potential"]);
}

function validateParentage(child: Individual, game: GameState): void {
  if (!child.parents) {
    if (child.generation !== 1 || child.birthTurn > 0 || game.turn - child.birthTurn < game.rules.adultAfter)
      fail("시작 성체의 세대·나이");
    return;
  }
  const father = game.individuals[child.parents.fatherId], mother = game.individuals[child.parents.motherId];
  if (!father || !mother || father.id === child.id || mother.id === child.id) fail("부모 참조 누락·순환");
  if (father.sex !== "male" || mother.sex !== "female") fail("부모의 성별");
  if (checkKinship(father, mother, game.individuals)) fail("차단된 근친 교배 기록");
  // Strict generation descent also excludes every possible ancestry cycle.
  if (child.generation !== Math.max(father.generation, mother.generation) + 1) fail("혈통 세대 불일치");
  if (child.birthTurn < 0 || father.birthTurn >= child.birthTurn || mother.birthTurn >= child.birthTurn) fail("부모·자손 출생 순서");
  const forecast = forecastCross(father.genotype, mother.genotype);
  if (forecast.nonViableProbability > 0) fail("위험 교배 기록");
  for (const locus of forecast.loci) {
    const pair = canonicalPair(child.genotype.loci[locus.definition.id], locus.definition);
    if (!locus.outcomes.some((outcome) => outcome.viable && outcome.alleles[0] === pair[0] && outcome.alleles[1] === pair[1]))
      fail("부모에게 없는 대립유전자");
  }
  for (const key of TRAIT_KEYS) {
    const mean = (father.potential[key] + mother.potential[key]) / 2, variation = game.rules.traitVariation[key];
    if (child.potential[key] < Math.max(0, mean - variation) - 1e-9 ||
      child.potential[key] > Math.min(1, mean + variation) + 1e-9) fail("부모 형질의 변이 범위를 벗어난 자손");
  }
}

/** Structural AND referential validation. Untrusted imports never reach the renderer first. */
export function validateGameState(value: unknown): asserts value is GameState {
  object(value, "게임");
  knownKeys(value,["saveVersion","rulesVersion","gameId","seed","revision","turn","nextClutch","rules","individuals","eggs"],"게임");
  if (value.saveVersion !== 2 || value.rulesVersion !== 1) fail("지원하지 않는 저장·규칙 버전 (지원: 저장 v2 / 규칙 v1)");
  id(value.gameId); text(value.seed, "게임 시드");
  integer(value.revision, "리비전"); integer(value.turn, "현재 턴"); integer(value.nextClutch, "클러치 번호", 1);
  validateRules(value.rules);
  object(value.individuals, "컬렉션"); object(value.eggs, "알");
  if (!Object.keys(value.individuals).length || Object.keys(value.individuals).length > MAX_RECORDS ||
    Object.keys(value.eggs).length > MAX_RECORDS * 2) fail("저장 용량 범위");
  const game = value as unknown as GameState;
  const seenSeeds = new Map<string, string>();
  const noteSeed = (individual: Individual) => {
    const existing = seenSeeds.get(individual.visualSeed);
    if (existing && existing !== individual.id) fail("개체 외형 시드 중복");
    seenSeeds.set(individual.visualSeed, individual.id);
  };
  for (const [key, individual] of Object.entries(game.individuals)) {
    id(key); validateIndividual(individual);
    if (key !== individual.id || individual.birthTurn > game.turn ||
      individual.stage !== growthStage(individual, game.turn, game.rules)) fail("개체 ID·출생·성장 불일치");
    validateParentage(individual, game); noteSeed(individual);
  }
  const clutches = new Map<number, Egg[]>();
  const childEggs = new Set<string>();
  for (const [key, egg] of Object.entries(game.eggs)) {
    id(key); object(egg, "알"); id(egg.id);
    knownKeys(egg as unknown as Record<string,unknown>,["id","clutch","laidTurn","dueTurn","parents","embryo","status","hatchedTurn"],"알");
    if (key !== egg.id) fail("알 ID 불일치");
    integer(egg.clutch, "클러치", 1); integer(egg.laidTurn, "산란 턴"); integer(egg.dueTurn, "부화 턴");
    validateParents(egg.parents); validateIndividual(egg.embryo);
    if (egg.embryo.parents === null || egg.parents.fatherId !== egg.embryo.parents.fatherId ||
      egg.parents.motherId !== egg.embryo.parents.motherId) fail("알과 자손 부모 불일치");
    if (egg.laidTurn > game.turn || egg.dueTurn !== egg.laidTurn + game.rules.incubationTurns ||
      egg.embryo.birthTurn !== egg.dueTurn || egg.embryo.stage !== "hatchling" ||
      egg.embryo.nextBreedTurn !== egg.dueTurn + game.rules.adultAfter) fail("알의 시간·성장 정보");
    if (childEggs.has(egg.embryo.id)) fail("자손 중복");
    childEggs.add(egg.embryo.id);
    validateParentage(egg.embryo, game); noteSeed(egg.embryo);
    for (const parentId of [egg.parents.fatherId, egg.parents.motherId])
      if (egg.laidTurn - game.individuals[parentId].birthTurn < game.rules.adultAfter) fail("미성체의 산란 기록");
    const expectedStatus = game.turn >= egg.dueTurn ? "hatched" : "incubating";
    if (egg.status !== expectedStatus) fail("알 상태 불일치");
    if (egg.status === "incubating") {
      if (egg.hatchedTurn !== null || game.individuals[egg.embryo.id]) fail("부화 전 컬렉션 등록");
    } else {
      const registered = game.individuals[egg.embryo.id];
      if (!registered || egg.hatchedTurn !== egg.dueTurn) fail("부화한 자손 누락");
      const embryo = egg.embryo;
      if (registered.sex !== embryo.sex || registered.birthTurn !== embryo.birthTurn ||
        registered.generation !== embryo.generation || registered.visualSeed !== embryo.visualSeed ||
        registered.parents?.fatherId !== embryo.parents?.fatherId || registered.parents?.motherId !== embryo.parents?.motherId ||
        TRAIT_KEYS.some((trait) => registered.potential[trait] !== embryo.potential[trait]) ||
        SUPPORTED_LOCI.some((definition) => {
          const a = canonicalPair(registered.genotype.loci[definition.id], definition);
          const b = canonicalPair(embryo.genotype.loci[definition.id], definition);
          return a[0] !== b[0] || a[1] !== b[1];
        })) fail("알과 등록 자손의 유전 정보 불일치");
    }
    const clutch = clutches.get(egg.clutch) ?? [];
    clutch.push(egg); clutches.set(egg.clutch, clutch);
  }
  const maxClutch = Math.max(0, ...clutches.keys());
  if (game.nextClutch !== maxClutch + 1 || clutches.size !== maxClutch) fail("클러치 재현 카운터 누락");
  for (const eggs of clutches.values()) {
    if (eggs.length !== 2 || eggs[0].laidTurn !== eggs[1].laidTurn ||
      eggs[0].parents.fatherId !== eggs[1].parents.fatherId || eggs[0].parents.motherId !== eggs[1].parents.motherId)
      fail("클러치는 동일 부모의 독립 알 2개여야 합니다");
  }
  for (const individual of Object.values(game.individuals))
    if (individual.parents && !childEggs.has(individual.id)) fail("자손의 산란 기록 누락");
}
