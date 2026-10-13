import { describe, expect, it } from "vitest";
import { renderSprite } from "../src/engine/render";
import { toSpecimen, phenotypeOf } from "../src/game/adapter";
import { checkKinship } from "../src/game/lineage";
import { applyAction, checkBreeding, createNewGame } from "../src/game/play";
import { exportBackup, makeSave, parseBackup, readSave, MAX_BACKUP_BYTES } from "../src/game/save";
import { validateGameState } from "../src/game/validation";
import type { GameState, Individual } from "../src/game/model";
import { lillyGenotype } from "../src/genetics/mendel";

const founders = (game: GameState) => Object.values(game.individuals).filter(v => !v.parents);
function starterCross(game: GameState) {
  const [father,mother] = founders(game);
  return applyAction(game,{type:"breed",fatherId:father.id,motherId:mother.id});
}
const advance = (game: GameState, turns: number) => applyAction(game,{type:"advance",turns});

describe("persistent breeding loop", () => {
  it("starts with six unrelated adult founders with explicit genotypes", () => {
    const game = createNewGame();
    expect(Object.keys(game.individuals)).toHaveLength(6);
    expect(createNewGame()).toEqual(game);
    for (const individual of founders(game)) {
      expect(individual.stage).toBe("adult");
      expect(individual.genotype.loci["lilly-white"]).toHaveLength(2);
      expect(individual.generation).toBe(1);
      expect(individual.parents).toBeNull();
      expect(renderSprite(toSpecimen(individual)).pixels.some(v => v > 0)).toBe(true);
    }
    expect(phenotypeOf(founders(game)[3])).toMatchObject({geneticMorph:"Normal",visualClass:"dalmatian"});
  });
  it("blocks wrong sex, missing parents, risky crosses, and cooldowns without mutations", () => {
    const game = createNewGame(), start = exportBackup(game), [father,mother,male, ,lillyMale] = founders(game);
    for (const [f,m] of [[mother,father],[father,male],[lillyMale,mother],[father,{id:"missing"} as Individual]])
      expect(() => applyAction(game,{type:"breed",fatherId:f.id,motherId:m.id})).toThrow();
    expect(exportBackup(game)).toBe(start);
    const next = starterCross(game);
    expect(() => starterCross(next)).toThrow(/TURN/);
    expect(checkBreeding(game,lillyMale.id,mother.id).forecast?.nonViableProbability).toBe(.25);
    expect(Object.keys(game.eggs)).toHaveLength(0);
  });
  it("fixes two independent viable embryos when eggs are laid and never rerolls at hatch", () => {
    const initial = createNewGame(), laid = starterCross(initial);
    expect(starterCross(initial)).toEqual(laid);
    const eggs = Object.values(laid.eggs);
    expect(eggs).toHaveLength(2);
    expect(eggs[0].embryo.id).not.toBe(eggs[1].embryo.id);
    expect(eggs[0].embryo.visualSeed).not.toBe(eggs[1].embryo.visualSeed);
    expect(eggs[0].embryo.potential).not.toEqual(eggs[1].embryo.potential);
    for (const egg of eggs) {
      expect(egg.embryo.visualSeed).not.toBe(initial.individuals[egg.parents.fatherId].visualSeed);
      expect(egg.embryo.visualSeed).not.toBe(initial.individuals[egg.parents.motherId].visualSeed);
      expect(egg.embryo.genotype.loci["lilly-white"]).not.toEqual(["Lw","Lw"]);
    }
    const intermediate = advance(laid,1);
    expect(Object.keys(intermediate.individuals)).toHaveLength(6);
    const hatched = advance(parseBackup(exportBackup(intermediate)),1);
    expect(Object.keys(hatched.individuals)).toHaveLength(8);
    for (const egg of eggs) {
      expect(hatched.individuals[egg.embryo.id]).toEqual(egg.embryo);
      expect(hatched.eggs[egg.id].status).toBe("hatched");
      expect(hatched.individuals[egg.embryo.id].parents).toEqual(egg.parents);
    }
    expect(advance(hatched,1).eggs).toEqual(hatched.eggs);
  });
  it("grows hatchlings through juvenile to adult and allows outcrossing into the next generation", () => {
    let game = advance(starterCross(createNewGame()),2);
    const childId = Object.values(game.eggs)[0].embryo.id;
    let child = game.individuals[childId];
    const unrelated = founders(game).find(v => v.sex !== child.sex && v.genotype.loci["lilly-white"].every(a => a === "n") &&
      v.id !== child.parents!.fatherId && v.id !== child.parents!.motherId)!;
    const breedAction = () => ({type:"breed" as const,fatherId:child.sex === "male" ? child.id : unrelated.id,
      motherId:child.sex === "female" ? child.id : unrelated.id});
    expect(() => applyAction(game,breedAction())).toThrow(/성체/);
    game = advance(game,3); expect(game.individuals[childId].stage).toBe("juvenile");
    game = advance(game,3); child = game.individuals[childId];
    expect(child.stage).toBe("adult");
    game = applyAction(game,breedAction());
    expect(Object.values(game.eggs).filter(v => v.clutch === 2).map(v => v.embryo.generation)).toEqual([3,3]);
    const grown = advance(game,15);
    for (const egg of Object.values(grown.eggs)) expect(grown.individuals[egg.embryo.id].stage).toBe("adult");
  });
  it("blocks lineal relatives and siblings independently of sex and morphology", () => {
    const game = advance(starterCross(createNewGame()),8), children = Object.values(game.individuals).filter(v => v.parents);
    const parent = game.individuals[children[0].parents!.fatherId];
    expect(checkKinship(parent,children[0],game.individuals)?.code).toBe("lineal");
    expect(checkKinship(children[0],children[1],game.individuals)?.code).toBe("siblings");
    expect(checkKinship(founders(game)[0],founders(game)[3],game.individuals)).toBeNull();
  });
  it("renames without changing IDs, parentage, genes, seeds or stored embryos", () => {
    const game = advance(starterCross(createNewGame()),2), child = Object.values(game.individuals).find(v => v.parents)!;
    const renamed = applyAction(game,{type:"rename",id:child.id,name:" 작은 모카 "});
    expect(renamed.individuals[child.id]).toEqual({...child,name:"작은 모카"});
    expect(renamed.eggs).toEqual(game.eggs);
    expect(() => applyAction(game,{type:"rename",id:child.id,name:" "})).toThrow();
    expect(parseBackup(exportBackup(renamed))).toEqual(renamed);
  });
  it("rejects invalid growth, variation and time advancement settings", () => {
    expect(() => createNewGame("bad",{adultAfter:2,juvenileAfter:3})).toThrow();
    expect(() => createNewGame("bad",{incubationTurns:0})).toThrow();
    for (const turns of [0,-1,1.5,31,NaN]) expect(() => advance(createNewGame(),turns)).toThrow();
  });

  it("creates, stores and restores at least five descendant generations using actual eligible crosses", () => {
    let game = createNewGame("five-generation-pedigree",{cooldownTurns:0});
    for (let round = 0; round < 8 && Math.max(...Object.values(game.individuals).map(v => v.generation)) < 6; round++) {
      const population = Object.values(game.individuals);
      const pairs = population.filter(v => v.sex === "male").flatMap(father => population.filter(v => v.sex === "female")
        .filter(mother => checkBreeding(game,father.id,mother.id).allowed).map(mother => ({father,mother})))
        .sort((a,b) => Math.max(b.father.generation,b.mother.generation)-Math.max(a.father.generation,a.mother.generation));
      // Breadth matters: preserve multiple outcrossed families, not one line paired with its relatives.
      for (const {father,mother} of pairs.slice(0,80)) game = applyAction(game,{type:"breed",fatherId:father.id,motherId:mother.id});
      game = advance(game,game.rules.incubationTurns+game.rules.adultAfter);
      game = parseBackup(exportBackup(game));
    }
    const highest = Math.max(...Object.values(game.individuals).map(v => v.generation));
    expect(highest).toBeGreaterThanOrEqual(6); // five descendant generations beyond the founders
    const restored = parseBackup(exportBackup(game));
    expect(restored).toEqual(game);
    for (const child of Object.values(restored.individuals).filter(v => v.parents)) {
      const father = restored.individuals[child.parents!.fatherId], mother = restored.individuals[child.parents!.motherId];
      expect(father).toBeDefined(); expect(mother).toBeDefined();
      expect(child.generation).toBe(Math.max(father.generation,mother.generation)+1);
      expect(checkKinship(father,mother,restored.individuals)).toBeNull();
      expect(toSpecimen(child).seed).toBe(child.visualSeed);
    }
  }, 60_000);
});

describe("versioned backup integrity", () => {
  it("round trips and reproduces the next clutch after restore", () => {
    const game = advance(starterCross(createNewGame()),8), restored = parseBackup(exportBackup(game));
    expect(restored).toEqual(game);
    expect(starterCross(restored)).toEqual(starterCross(game));
    const reordered = JSON.parse(exportBackup(game));
    const first = Object.values(reordered.game.individuals)[0] as Record<string,unknown>;
    const pairs = Object.entries(first).reverse(); Object.keys(first).forEach(key => delete first[key]);
    Object.assign(first,Object.fromEntries(pairs));
    expect(readSave(reordered)).toEqual(game);
  });
  it.each([
    ["unsupported version", (save: ReturnType<typeof makeSave>) => { save.version = 99 as never; }],
    ["checksum", (save: ReturnType<typeof makeSave>) => { save.checksum = "deadbeef"; }],
    ["missing parent", (save: ReturnType<typeof makeSave>) => {
      const child = Object.values(save.game.individuals).find(v => v.parents)!;
      child.parents!.fatherId = "missing-parent";
    }],
    ["cycle", (save: ReturnType<typeof makeSave>) => {
      const child = Object.values(save.game.individuals).find(v => v.parents)!;
      child.parents!.fatherId = child.id;
    }],
    ["nonviable individual", (save: ReturnType<typeof makeSave>) => {
      const individual = Object.values(save.game.individuals)[0];
      individual.genotype = lillyGenotype(); individual.genotype.loci["lilly-white"] = ["Lw","Lw"];
    }],
    ["growth mismatch", (save: ReturnType<typeof makeSave>) => {
      Object.values(save.game.individuals)[0].stage = "hatchling";
    }],
    ["missing counter", (save: ReturnType<typeof makeSave>) => { save.game.nextClutch = 1; }],
    ["missing embryo", (save: ReturnType<typeof makeSave>) => { delete save.game.eggs[Object.keys(save.game.eggs)[0]]; }],
  ])("rejects corrupted data: %s", (_, mutate) => {
    const save = makeSave(advance(starterCross(createNewGame()),2));
    mutate(save);
    expect(() => readSave(save)).toThrow();
  });
  it("rejects malformed/oversized JSON and unknown rules", () => {
    expect(() => parseBackup("{")).toThrow(/JSON/);
    expect(() => parseBackup(" ".repeat(MAX_BACKUP_BYTES+1))).toThrow(/16MB/);
    expect(() => validateGameState({...createNewGame(),rulesVersion:9})).toThrow();
  });
});
