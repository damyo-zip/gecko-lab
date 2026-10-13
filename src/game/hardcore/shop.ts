import { normalGenotype, lillyGenotype } from "@/genetics/mendel";
import { expandedGenotype } from "@/genetics/hardcore";
import { seedId, seededRandom } from "@/genetics/random";
import type { Gecko, HardcoreGame } from "./model";
import { addDays } from "./time";
import { MARKET, valueGecko, type PriceTable } from "./market";
import { founderRecord } from "./genetics";
import { belief } from "@/genetics/advanced/inference";
import { legacyTraits } from "@/genetics/advanced/phenotype";
import { polyScores } from "@/genetics/advanced/polygenic";

/** Real specimens, fixed per date/seed. First two offers are affordable unrelated adult normals. */
export function refreshShop(game: HardcoreGame, table: PriceTable = MARKET): void {
  game.shop = { date: game.lastDate, offers: {} };
  for (let n = 1; n <= 6; n++) {
    const seed = game.seed + "|shop:" + game.lastDate + "|" + n;
    const id = game.gameId + "-shop-" + game.lastDate.replaceAll("-", "") + "-" + n;
    const genotype = expandedGenotype(n === 3 ? lillyGenotype() : normalGenotype());
    if (n === 4 || n === 5) genotype.loci.axanthic = ["A", "ax"];
    if (n === 6) genotype.loci.axanthic = ["ax", "ax"];
    // Hidden truth is fixed before purchase; public evidence never looks it up.
    if(n===1)genotype.loci.axanthic=seededRandom(seed,"hidden-carrier")()<.5?["A","ax"]:["A","A"];
    if(n===5)genotype.loci.axanthic=seededRandom(seed,"hidden-carrier")()<2/3?["A","ax"]:["A","A"];
    const genetics=founderRecord(genotype,seed,n<=2);
    if(n===1)genetics.knowledge.loci.axanthic=belief({"A/A":.5,"A/ax":.5},"seller","판매자 부모 기록: Aa × AA, 외형 Normal · 50% possible het");
    if(n===5)genetics.knowledge.loci.axanthic=belief({"A/A":1/3,"A/ax":2/3},"seller","판매자 부모 기록: Aa × Aa, 외형 Normal · 66.7% possible het");
    const potential=legacyTraits(polyScores(genetics.genome!.polygenic));
    const stage = n === 6 ? "hatchling" : "adult", age = stage === "adult" ? game.rules.adultAfter : 0;
    const individual: Gecko = { id, name: ["노멀 수컷", "노멀 암컷", "릴리 암컷", "Ax 보인 수컷", "Ax 보인 암컷", "Ax 해칭"][n-1],
      sex: n === 1 || n === 4 ? "male" : n === 6 ? seededRandom(seed, "sex")() < .5 ? "male" : "female" : "female",
      birthTurn: game.turn - age, stage, parents: null, generation: 1, genotype, potential,
      visualSeed: id + "-" + seedId(seed, "visual"), nextBreedTurn: game.turn + (stage === "adult" ? 0 : game.rules.adultAfter),
      birthDate: addDays(game.lastDate, -age), status: "owned", hearts: 5, lastFedDate: null, diedDate: null,
      cycleAnchor: addDays(game.lastDate, stage === "adult" ? 0 : game.rules.adultAfter),
      recoverUntil: game.lastDate, lineageIds: [], provenance: "unverified", genetics };
    // A restored market snapshot must not re-offer a specimen already bought that day.
    if (game.individuals[id]) continue;
    const quote = valueGecko(individual, table);
    game.shop.offers[id] = { id, individual, askPrice: quote.ask, marketBase: quote.marketBase, marketVersion: table.version };
  }
  game.marketVersion = table.version;
}
