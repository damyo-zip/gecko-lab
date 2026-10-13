import { expect, test } from "vitest";
import { createNewGame } from "@/game/play";
import { makeSave } from "@/game/save";
import { migrateV2 } from "@/game/hardcore/create";
import { catchUp } from "@/game/hardcore/calendar";
import { breedingCheck, startMating } from "@/game/hardcore/breeding";
import { freeSlots, reserved } from "@/game/hardcore/survival";
import { validateGame } from "@/game/hardcore/validation";
import { inheritGenotype, forecastCross } from "@/genetics/mendel";
import { axanthicState, expandedGenotype, HARDCORE_LOCI } from "@/genetics/hardcore";

function start(fertilizationChance = 1, hatchChance = 1) {
  const game = migrateV2(makeSave(createNewGame("real-breeding")), "2026-10-13");
  game.rules = { ...game.rules, fertilizationChance, hatchChance, adultAfter: 1, juvenileAfter: 1 };
  game.capacity = 12;
  const [father,mother] = Object.values(game.individuals);
  startMating(game, father.id, mother.id); return game;
}
test("day 0 snapshot, day 1 fertilization, day 2 two fixed eggs, day 3 hatch, day 4 adulthood", () => {
  const initial = start(), mating = Object.values(initial.matings)[0];
  expect(mating.status).toBe("pending"); expect(reserved(initial)).toBe(2);
  let game = catchUp(initial, "2026-10-14"); expect(game.matings[mating.id].status).toBe("fertilized");
  game = catchUp(game, "2026-10-15"); const eggs = Object.values(game.eggs);
  expect(eggs).toHaveLength(2); expect(reserved(game)).toBe(2); expect(freeSlots(game)).toBe(4);
  expect(eggs[0].embryo.visualSeed).not.toBe(eggs[1].embryo.visualSeed);
  game = catchUp(game, "2026-10-16");
  for (const egg of eggs) expect(game.individuals[egg.embryo.id]).toEqual(egg.embryo);
  expect(reserved(game)).toBe(0);
  game = catchUp(game, "2026-10-17");
  for (const egg of eggs) expect(game.individuals[egg.embryo.id]).toMatchObject({ stage: "adult", hearts: 4 });
  validateGame(game);
  expect(catchUp(initial, "2026-10-17").individuals).toEqual(game.individuals);
});
test("failed fertilization and failed hatch release capacity independently", () => {
  const failed = catchUp(start(0, 1), "2026-10-17");
  expect(Object.values(failed.matings)[0].status).toBe("failed"); expect(Object.keys(failed.eggs)).toHaveLength(0);
  const unhatched = catchUp(start(1, 0), "2026-10-16");
  expect(Object.values(unhatched.eggs).every(e => e.status === "failed")).toBe(true);
  expect(Object.keys(unhatched.individuals)).toHaveLength(6); expect(reserved(unhatched)).toBe(0); validateGame(unhatched);
});
test("mother death precedes fertilization/laying, laid eggs survive loss of parents", () => {
  let game = start(), m = Object.values(game.matings)[0]; game.individuals[m.parents.motherId].hearts = 1;
  game = catchUp(game, "2026-10-14"); expect(game.matings[m.id].status).toBe("cancelled");
  expect(Object.keys(game.eggs)).toHaveLength(0);
  game = catchUp(start(), "2026-10-15"); m = Object.values(game.matings)[0]; game.individuals[m.parents.motherId].hearts = 1;
  game = catchUp(game, "2026-10-16"); expect(game.individuals[m.parents.motherId].status).toBe("dead");
  expect(Object.values(game.eggs).every(e => e.status === "hatched")).toBe(true);
  validateGame(game);
});
test("fertility window, recovery, capacity, risk and kinship block repeat matings", () => {
  const game = start(), m = Object.values(game.matings)[0];
  expect(breedingCheck(game, m.parents.fatherId, m.parents.motherId).reasons.join()).toContain("회복");
  const [father,mother,,,lillyMale] = Object.values(game.individuals);
  expect(breedingCheck(game, lillyMale.id, mother.id).reasons.join()).toContain("비생존");
  game.individuals[mother.id].recoverUntil = game.lastDate; game.individuals[mother.id].nextBreedTurn = 0; game.matings = {};
  game.capacity = 6; expect(breedingCheck(game, father.id, mother.id).reasons.join()).toContain("공간");
});
test("recessive alleles genuinely travel across generations before expression", () => {
  const normal = expandedGenotype(createNewGame().individuals[Object.keys(createNewGame().individuals)[0]].genotype);
  const visual = structuredClone(normal); visual.loci.axanthic = ["ax", "ax"];
  const f1 = inheritGenotype(normal, visual, "recessive-f1", HARDCORE_LOCI).genotype;
  expect(axanthicState(f1)).toBe("carrier");
  const probabilities = forecastCross(f1, f1, HARDCORE_LOCI).loci[1].outcomes;
  expect(probabilities.find(v => v.alleles.join() === "ax,ax")?.probability).toBe(.25);
  const offspring = Array.from({length: 100}, (_, i) => inheritGenotype(f1, f1, "f2-" + i, HARDCORE_LOCI).genotype);
  expect(offspring.some(g => axanthicState(g) === "visual")).toBe(true);
  expect(inheritGenotype(f1, f1, "fixed", HARDCORE_LOCI)).toEqual(inheritGenotype(f1, f1, "fixed", HARDCORE_LOCI));
});
