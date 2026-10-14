import { expect, test } from "vitest";
import { newGame, act, synchronize } from "./helpers/legacy-hardcore";
import { exportBackup, parseBackup } from "./helpers/legacy-hardcore";
import { MARKET, valueGecko } from "@/game/hardcore/market";
import { descendants } from "@/game/hardcore/lineage";
import { freeSlots } from "@/game/hardcore/survival";
import { addDays } from "@/game/hardcore/time";
import { breedingCheck } from "@/game/hardcore/breeding";

const date = "2026-10-13";
function pair() {
  let game = newGame("economy", date, { fertilizationChance: 1, hatchChance: 1 });
  const [male,female] = Object.keys(game.shop.offers);
  game = act(game, { type: "buyGecko", offerId: male }, date);
  game = act(game, { type: "buyGecko", offerId: female }, date);
  return { game, male, female };
}
test("initial capital buys a normal pair, food and space; each purchase is an actual specimen", () => {
  let { game } = pair(); expect(Object.keys(game.individuals)).toHaveLength(2);
  game = act(game, { type: "buyFood", amount: 20 }, date); game = act(game, { type: "expand" }, date);
  expect(game.money).toBeGreaterThan(0); expect(game.capacity).toBe(8); expect(game.food).toBe(20);
  expect(() => act(game, {type:"buyFood", amount:1000},date)).toThrow("자금");
});
test("same-day buy and resale loses money and retains immutable sale quote/pedigree", () => {
  let game = newGame("trade",date); const offer = Object.values(game.shop.offers)[0];
  const bought = act(game,{type:"buyGecko",offerId:offer.id},date);
  game = act(bought,{type:"sell",id:offer.id},date);
  expect(game.money).toBeLessThan(MARKET.bases.normal + bought.money); expect(game.money).toBeLessThan(500000);
  expect(game.individuals[offer.id].status).toBe("sold"); expect(game.sales[0].price).toBeGreaterThan(0);
  expect(() => act(game,{type:"sell",id:offer.id},date)).toThrow();
  expect(() => act(game,{type:"feed",id:offer.id},date)).toThrow();
  const history = structuredClone(game.sales);
  const updated = { ...MARKET, version:"next-reviewed-table", bases: { ...MARKET.bases, normal: 500000 } };
  game = synchronize(game,date,updated); expect(game.sales).toEqual(history);
  expect(game.marketVersion).toBe(updated.version);
});
test("reservation prevents overcapacity purchase and remains through laying until hatch", () => {
  let {game,male,female} = pair(); game = act(game,{type:"breed",fatherId:male,motherId:female},date);
  expect(freeSlots(game)).toBe(0);
  expect(() => act(game,{type:"buyGecko",offerId:Object.keys(game.shop.offers)[0]},date)).toThrow("공간");
  game = synchronize(game,addDays(date,2)); expect(freeSlots(game)).toBe(0);
  game = synchronize(game,addDays(date,3)); expect(freeSlots(game)).toBe(0);
  expect(Object.keys(game.individuals)).toHaveLength(4);
});
test("manual feeding, sold/dead lineage, names and economy survive backup", () => {
  let {game,male,female} = pair(); game = act(game,{type:"lineage",id:male,name:"Moonlight Line"},date);
  const before = valueGecko(game.individuals[male]);
  game = act(game,{type:"lineage",id:male,name:"Expensive sounding name"},date);
  expect(valueGecko(game.individuals[male])).toEqual(before);
  game = act(game,{type:"breed",fatherId:male,motherId:female},date);
  game = synchronize(game,addDays(date,3)); const child = Object.values(game.individuals).find(g=>g.parents)!;
  expect(child.lineageIds).toHaveLength(2); expect(descendants(game,male).has(child.id)).toBe(true);
  game = act(game,{type:"sell",id:male},game.lastDate);
  game = synchronize(game,addDays(date,5)); expect(game.individuals[female].status).toBe("dead");
  expect(game.individuals[child.id].parents).toEqual({fatherId:male,motherId:female});
  expect(parseBackup(exportBackup(game),game.lastDate)).toEqual(game);
});
test("deterministic entire loop and 10+ generations preserve ancestry across sale and death", () => {
  let {game,male,female} = pair();
  game.rules.initialMoney = 100000000; game.money = 100000000; game.capacity = 100; game.food = 10000;
  game = act(game,{type:"lineage",id:male,name:"Ten generations"},date);
  const founder = male;
  for (let generation=1; generation<=10; generation++) {
    // Fresh unrelated adult partner (no arbitrary ancestor trait reappearance).
    if (generation > 1) {
      const descendant = game.individuals[male];
      const offer = Object.values(game.shop.offers).find(o => o.individual.sex !== descendant.sex && o.individual.stage === "adult" &&
        !o.individual.genotype.loci["lilly-white"].includes("Lw"))!;
      game = act(game,{type:"buyGecko",offerId:offer.id},game.lastDate);
      female = descendant.sex === "female" ? descendant.id : offer.id;
      male = descendant.sex === "male" ? descendant.id : offer.id;
      // Wait for the compressed female cycle, feeding by hand every date.
      for(let attempts=0; breedingCheck(game,male,female).reasons.length && attempts<7; attempts++) {
        game = synchronize(game,addDays(game.lastDate,1)); game = act(game,{type:"feedAll"},game.lastDate);
      }
    }
    const action = {type:"breed" as const,fatherId:male,motherId:female};
    const backup = parseBackup(exportBackup(game),game.lastDate);
    expect(act(backup,action,game.lastDate)).toEqual(act(game,action,game.lastDate));
    game = act(game,action,game.lastDate);
    const mating = Object.values(game.matings).at(-1)!;
    for(let days=0; days<4; days++) { game = synchronize(game,addDays(game.lastDate,1)); game = act(game,{type:"feedAll"},game.lastDate); }
    const children = Object.values(game.eggs).filter(e=>e.matingId===mating.id).map(e=>game.individuals[e.embryo.id]);
    expect(children.every(g=>g.generation===generation+1)).toBe(true);
    male = children[0].id;
    game = parseBackup(exportBackup(game),game.lastDate);
  }
  expect(Math.max(...Object.values(game.individuals).map(g=>g.generation))).toBe(11);
  expect(descendants(game,founder).size).toBeGreaterThanOrEqual(20);
}, 30_000);
