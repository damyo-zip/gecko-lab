import { normalGenotype, lillyGenotype } from "@/genetics/mendel";
import { expandedGenotype } from "@/genetics/hardcore";
import { seedId, seededRandom } from "@/genetics/random";
import { TRAIT_KEYS, type PotentialTraits } from "@/genetics/traits";
import type { Gecko, HardcoreGame } from "./model";
import { addDays } from "./time";
import { MARKET, valueGecko, type PriceTable } from "./market";

/** Real specimens, fixed per date/seed. First two offers are affordable unrelated adult normals. */
export function refreshShop(game: HardcoreGame, table: PriceTable = MARKET): void {
  game.shop = { date: game.lastDate, offers: {} };
  for (let n = 1; n <= 6; n++) {
    const seed = game.seed + "|shop:" + game.lastDate + "|" + n;
    const id = game.gameId + "-shop-" + game.lastDate.replaceAll("-", "") + "-" + n;
    const genotype = expandedGenotype(n === 3 ? lillyGenotype() : normalGenotype());
    if (n === 4 || n === 5) genotype.loci.axanthic = ["A", "ax"];
    if (n === 6) genotype.loci.axanthic = ["ax", "ax"];
    const potential = Object.fromEntries(TRAIT_KEYS.map(k => [k, .15 + seededRandom(seed, k)() * .5])) as PotentialTraits;
    if (n <= 2) { potential.creamCoverage = .2; potential.flankIntensity = .3; potential.spotDensity = .05; }
    const stage = n === 6 ? "hatchling" : "adult", age = stage === "adult" ? game.rules.adultAfter : 0;
    const individual: Gecko = { id, name: ["노멀 수컷", "노멀 암컷", "릴리 암컷", "Ax 보인 수컷", "Ax 보인 암컷", "Ax 해칭"][n-1],
      sex: n === 1 || n === 4 ? "male" : n === 6 ? seededRandom(seed, "sex")() < .5 ? "male" : "female" : "female",
      birthTurn: game.turn - age, stage, parents: null, generation: 1, genotype, potential,
      visualSeed: id + "-" + seedId(seed, "visual"), nextBreedTurn: game.turn + (stage === "adult" ? 0 : game.rules.adultAfter),
      birthDate: addDays(game.lastDate, -age), status: "owned", hearts: 5, lastFedDate: null, diedDate: null,
      cycleAnchor: addDays(game.lastDate, stage === "adult" ? 0 : game.rules.adultAfter),
      recoverUntil: game.lastDate, lineageIds: [], provenance: "unverified" };
    // A restored market snapshot must not re-offer a specimen already bought that day.
    if (game.individuals[id]) continue;
    const quote = valueGecko(individual, table);
    game.shop.offers[id] = { id, individual, askPrice: quote.ask, marketBase: quote.marketBase, marketVersion: table.version };
  }
  game.marketVersion = table.version;
}
