import { isViablePair, forecastCross } from "@/genetics/mendel";
import { expandedGenotype, HARDCORE_LOCI } from "@/genetics/hardcore";
import { validateTraits, TRAIT_KEYS } from "@/genetics/traits";
import { canonicalJSON } from "@/game/save";
import { checkKinship } from "@/game/lineage";
import { TIME_MODES, type Gecko, type LegacyV4Game, type LegacyHardcoreGame, type Rules } from "./model";
import { dateNumber, daysBetween, addDays } from "./time";
import { freeSlots } from "./survival";

function fail(): never { throw new Error("저장 데이터의 구조 또는 값이 손상되었습니다."); }
function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
}
function keys(value: unknown, expected: string): void {
  object(value); const fields = expected.split(" ");
  if (Object.keys(value).length !== fields.length || fields.some(k => !Object.hasOwn(value, k))) fail();
}
function text(value: unknown, max = 128): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > max) fail();
}
function id(value: unknown): asserts value is string {
  text(value); if (!/^[a-zA-Z0-9_-]+$/.test(value) || ["constructor", "__proto__", "prototype"].includes(value)) fail();
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) fail();
}
function probability(value: unknown): void { if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) fail(); }
function date(value: unknown): asserts value is string { text(value, 10); dateNumber(value); }
function nullableDate(value: unknown): void { if (value !== null) date(value); }
function strings(value: unknown, max = 100): asserts value is string[] {
  if (!Array.isArray(value) || value.length > max) fail(); value.forEach(v => text(v));
}
function dictionary(value: unknown, max = 30000): asserts value is Record<string, unknown> {
  object(value); if (Object.keys(value).length > max) fail(); Object.keys(value).forEach(id);
}
export function validateRules(r: Rules): void {
  keys(r, "fertilizationChance hatchChance ovulationCycleDays ovulationWindowDays recoveryDays juvenileAfter adultAfter traitVariation initialMoney initialCapacity foodUnitPrice expansionSlots expansionBasePrice maxCapacity");
  probability(r.fertilizationChance); probability(r.hatchChance); validateTraits(r.traitVariation);
  integer(r.ovulationCycleDays, 1, 365); integer(r.ovulationWindowDays, 1, r.ovulationCycleDays);
  integer(r.recoveryDays, 1, 365); integer(r.juvenileAfter, 1, 200); integer(r.adultAfter, r.juvenileAfter, 200);
  integer(r.initialMoney, 0, 1e12); integer(r.maxCapacity, 4, 3000); integer(r.initialCapacity, 2, r.maxCapacity);
  integer(r.foodUnitPrice, 1, 1e9); integer(r.expansionSlots, 1, 100); integer(r.expansionBasePrice, 1, 1e9);
}
function gecko(g: Gecko): void {
  keys(g, "id name sex birthTurn stage parents generation genotype potential visualSeed nextBreedTurn birthDate status hearts lastFedDate diedDate cycleAnchor recoverUntil lineageIds provenance");
  id(g.id); text(g.name, 24); text(g.visualSeed); integer(g.birthTurn, -100000, 10000000); integer(g.nextBreedTurn);
  if (!["male", "female"].includes(g.sex) || !["hatchling", "juvenile", "adult"].includes(g.stage) ||
    !["owned", "sold", "dead"].includes(g.status) || !["known", "unverified"].includes(g.provenance)) fail();
  integer(g.hearts, 0, 5); integer(g.generation, 1, 30000); validateTraits(g.potential);
  object(g.genotype); object(g.genotype.loci);
  if (Object.keys(g.genotype.loci).some(k => !HARDCORE_LOCI.some(l => l.id === k))) fail();
  const genes = expandedGenotype(g.genotype);
  if (HARDCORE_LOCI.some(l => !isViablePair(genes.loci[l.id], l))) fail();
  if (g.parents !== null) { keys(g.parents, "fatherId motherId"); id(g.parents.fatherId); id(g.parents.motherId); }
  date(g.birthDate); date(g.cycleAnchor); date(g.recoverUntil); nullableDate(g.lastFedDate); nullableDate(g.diedDate);
  strings(g.lineageIds); if (new Set(g.lineageIds).size !== g.lineageIds.length) fail();
  if (g.status === "dead" ? g.hearts !== 0 || g.diedDate === null : g.hearts === 0 || g.diedDate !== null) fail();
}
function validateRecord(value: unknown, version: 3 | 4, advancedIds=new Set<string>()): void {
  keys(value, "saveVersion rulesVersion gameId seed revision turn nextClutch startedDate lastDate rules money food capacity expansions individuals matings eggs sales lineages nextLineage shop marketVersion notices migration" + (version === 4 ? " time" : ""));
  const g = value as LegacyV4Game;
  if ((g.saveVersion as number) !== version || g.rulesVersion !== 2) throw new Error("지원하지 않는 저장 또는 규칙 버전입니다.");
  if (version === 4) {
    keys(g.time, "mode realtimeAnchorDate");
    if (!TIME_MODES.includes(g.time.mode)) fail();
    date(g.time.realtimeAnchorDate);
  }
  id(g.gameId); text(g.seed); integer(g.revision); integer(g.turn, 0, 10000000); integer(g.nextClutch, 1);
  date(g.startedDate); date(g.lastDate); if (g.startedDate > g.lastDate) fail();
  validateRules(g.rules); integer(g.money, 0, 1e12); integer(g.food, 0, 1000000);
  integer(g.capacity, 2, g.rules.maxCapacity); integer(g.expansions, 0, 3000); integer(g.nextLineage, 1);
  if (typeof g.marketVersion !== "string" || g.marketVersion.length > 128) fail(); strings(g.notices, 100);
  if (g.migration !== null) { keys(g.migration, "from date"); if (g.migration.from !== 2) fail(); date(g.migration.date); }
  dictionary(g.individuals); dictionary(g.eggs, 60000); dictionary(g.matings); dictionary(g.lineages);
  for (const [key, line] of Object.entries(g.lineages)) {
    keys(line, "id name createdDate"); if (key !== line.id) fail(); text(line.name, 40); date(line.createdDate);
  }
  const seeds = new Map<string, string>();
  const genesEqual = (a: Gecko["genotype"], b: Gecko["genotype"]) => canonicalJSON(expandedGenotype(a)) === canonicalJSON(expandedGenotype(b));
  const checkIndividual = (i: Gecko, future = false) => {
    gecko(i);
    if (!future && (i.birthDate > g.lastDate || i.birthTurn > g.turn)) fail();
    if (!future && i.status === "owned") {
      const age = daysBetween(i.birthDate, g.lastDate);
      const expectedStage = age >= g.rules.adultAfter ? "adult" : age >= g.rules.juvenileAfter ? "juvenile" : "hatchling";
      if (i.stage !== expectedStage) fail();
    }
    if ((i.lastFedDate && i.lastFedDate > g.lastDate) || (i.diedDate && i.diedDate > g.lastDate)) fail();
    if (i.lineageIds.some(l => !g.lineages[l])) fail();
    if (i.parents) {
      const father = g.individuals[i.parents.fatherId], mother = g.individuals[i.parents.motherId];
      if (!father || !mother || father.sex !== "male" || mother.sex !== "female" ||
        i.generation !== Math.max(father.generation, mother.generation) + 1) fail();
      const child = expandedGenotype(i.genotype), paternal = expandedGenotype(father.genotype), maternal = expandedGenotype(mother.genotype);
      for (const l of HARDCORE_LOCI) {
        const [a,b] = child.loci[l.id];
        if (!(paternal.loci[l.id].includes(a) && maternal.loci[l.id].includes(b)) &&
          !(paternal.loci[l.id].includes(b) && maternal.loci[l.id].includes(a))) fail();
      }
      for (const k of advancedIds.has(i.id)?[]:TRAIT_KEYS) {
        const average = (father.potential[k] + mother.potential[k]) / 2;
        if (Math.abs(i.potential[k] - average) > g.rules.traitVariation[k] + 1e-9) fail();
      }
      if (checkKinship(father, mother, g.individuals)) fail();
    } else if (i.generation !== 1) fail();
    if (seeds.has(i.visualSeed) && seeds.get(i.visualSeed) !== i.id) fail(); seeds.set(i.visualSeed, i.id);
  };
  for (const [key, i] of Object.entries(g.individuals)) { if (i.id !== key) fail(); checkIndividual(i); }
  const ordinals = new Set<number>();
  for (const [key, m] of Object.entries(g.matings)) {
    keys(m, "id ordinal date parents fatherGenotype motherGenotype fatherTraits motherTraits generation lineageIds seed fertilizationChance hatchChance status resolvedDate");
    if (m.id !== key || !["pending", "fertilized", "failed", "laid", "cancelled"].includes(m.status)) fail();
    integer(m.ordinal, 1, g.nextClutch - 1); date(m.date); nullableDate(m.resolvedDate); text(m.seed, 512);
    if (ordinals.has(m.ordinal)) fail(); ordinals.add(m.ordinal);
    probability(m.fertilizationChance); probability(m.hatchChance); integer(m.generation, 2);
    keys(m.parents, "fatherId motherId");
    if (!g.individuals[m.parents.fatherId] || !g.individuals[m.parents.motherId]) fail();
    const father = g.individuals[m.parents.fatherId], mother = g.individuals[m.parents.motherId];
    if (father.sex !== "male" || mother.sex !== "female" || !genesEqual(father.genotype,m.fatherGenotype) || !genesEqual(mother.genotype,m.motherGenotype) ||
      canonicalJSON(father.potential) !== canonicalJSON(m.fatherTraits) || canonicalJSON(mother.potential) !== canonicalJSON(m.motherTraits) ||
      m.generation !== Math.max(father.generation,mother.generation)+1 || checkKinship(father,mother,g.individuals)) fail();
    if (forecastCross(expandedGenotype(m.fatherGenotype),expandedGenotype(m.motherGenotype),HARDCORE_LOCI).nonViableProbability > 0) fail();
    expandedGenotype(m.fatherGenotype); expandedGenotype(m.motherGenotype); validateTraits(m.fatherTraits); validateTraits(m.motherTraits);
    strings(m.lineageIds); if (m.lineageIds.some(l => !g.lineages[l]) || m.date > g.lastDate) fail();
    const age = daysBetween(m.date,g.lastDate);
    if (m.status === "pending" ? age !== 0 || m.resolvedDate !== null :
      m.resolvedDate === null || m.resolvedDate <= m.date || m.resolvedDate > g.lastDate) fail();
    if (m.status === "fertilized" && (age !== 1 || m.resolvedDate !== addDays(m.date,1))) fail();
    if (m.status === "laid" && (age < 2 || m.resolvedDate !== addDays(m.date,2))) fail();
  }
  const eggCounts = new Map<string,number>();
  for (const [key,e] of Object.entries(g.eggs)) {
    keys(e, "id matingId laidDate dueDate embryo hatchChance seed status resolvedDate");
    if (e.id !== key || !["incubating", "hatched", "failed"].includes(e.status)) fail();
    date(e.laidDate); date(e.dueDate); nullableDate(e.resolvedDate); probability(e.hatchChance); text(e.seed, 512);
    if (e.dueDate < e.laidDate || e.laidDate > g.lastDate || (e.matingId !== null && !g.matings[e.matingId])) fail();
    if (e.matingId) {
      eggCounts.set(e.matingId,(eggCounts.get(e.matingId) ?? 0)+1);
      const m = g.matings[e.matingId];
      if (m.status !== "laid" || e.laidDate !== addDays(m.date,2) || e.dueDate !== addDays(m.date,3) ||
        canonicalJSON(e.embryo.parents) !== canonicalJSON(m.parents)) fail();
    }
    checkIndividual(e.embryo, true);
    if (e.embryo.birthDate !== e.dueDate || (e.status === "incubating" ? e.resolvedDate !== null || e.dueDate <= g.lastDate : e.resolvedDate !== e.dueDate)) fail();
    const child = g.individuals[e.embryo.id];
    if (e.status === "hatched" ? !child : !!child) fail();
    if (child && (child.visualSeed !== e.embryo.visualSeed || !genesEqual(child.genotype,e.embryo.genotype) ||
      canonicalJSON(child.potential) !== canonicalJSON(e.embryo.potential) || canonicalJSON(child.parents) !== canonicalJSON(e.embryo.parents) ||
      child.birthDate !== e.embryo.birthDate || child.birthTurn !== e.embryo.birthTurn || child.sex !== e.embryo.sex || child.generation !== e.embryo.generation)) fail();
  }
  for (const m of Object.values(g.matings)) {
    const count = eggCounts.get(m.id) ?? 0;
    if (m.status === "laid" ? count !== 2 : count !== 0) fail();
  }
  if (!Array.isArray(g.sales) || g.sales.length > 30000) fail();
  const sold = new Set<string>();
  for (const s of g.sales) {
    keys(s, "id individualId date price marketVersion marketBase valuation"); id(s.id); id(s.individualId); date(s.date);
    integer(s.price); integer(s.marketBase); integer(s.valuation); text(s.marketVersion);
    if (s.date > g.lastDate || sold.has(s.individualId) || g.individuals[s.individualId]?.status !== "sold") fail(); sold.add(s.individualId);
  }
  if (Object.values(g.individuals).some(i => i.status === "sold" && !sold.has(i.id))) fail();
  keys(g.shop, "date offers"); date(g.shop.date); if (g.shop.date !== g.lastDate) fail(); dictionary(g.shop.offers, 20);
  for (const [key,o] of Object.entries(g.shop.offers)) {
    keys(o, "id individual askPrice marketBase marketVersion"); if (key !== o.id || o.id !== o.individual.id || g.individuals[key]) fail();
    gecko(o.individual); if (o.individual.parents || o.individual.lineageIds.length || o.individual.status !== "owned") fail();
    integer(o.askPrice, 1); integer(o.marketBase, 1); text(o.marketVersion);
  }
  if (freeSlots(g) < 0) throw new Error("사육장 공간 예약이 손상되었습니다.");
}
export function validateV4(value: unknown, advancedIds?:Set<string>): asserts value is LegacyV4Game { validateRecord(value, 4, advancedIds); }
export function validateV3(value: unknown): asserts value is LegacyHardcoreGame { validateRecord(value, 3); }
