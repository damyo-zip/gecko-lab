import { newGame } from "../../src/game/hardcore/play";
import { legacyRecord } from "../../src/game/hardcore/genetics";
import { normalGenotype, lillyGenotype } from "../../src/genetics/mendel";
import { expandedGenotype } from "../../src/genetics/hardcore";
import { validateGame } from "../../src/game/hardcore/validation";
import type { PotentialTraits } from "../../src/genetics/traits";

export const REFERENCE_DATE = "2026-10-14";
/** A validated review fixture, never installed in a player's new/active game. */
export function referenceHomeGame() {
  const game = newGame("home-reference-review", REFERENCE_DATE, { initialMoney: 12450, initialCapacity: 20 });
  const originals = Object.values(game.shop.offers).map(o => o.individual);
  const names = ["모카", "치즈", "그레이", "도트", "할리", "트리"];
  const traits: PotentialTraits[] = [
    { bodyTone: .65, redIntensity: .2, creamCoverage: .86, dorsalIntensity: .85, flankIntensity: .75, spotDensity: 0 },
    { bodyTone: .65, redIntensity: .6, creamCoverage: .12, dorsalIntensity: .35, flankIntensity: .4, spotDensity: 0 },
    { bodyTone: .5, redIntensity: .15, creamCoverage: .3, dorsalIntensity: .5, flankIntensity: .4, spotDensity: 0 },
    { bodyTone: .8, redIntensity: .2, creamCoverage: .82, dorsalIntensity: .12, flankIntensity: .08, spotDensity: .65 },
    { bodyTone: .3, redIntensity: .3, creamCoverage: .5, dorsalIntensity: .7, flankIntensity: .8, spotDensity: 0 },
    { bodyTone: .7, redIntensity: .85, creamCoverage: .6, dorsalIntensity: .8, flankIntensity: .6, spotDensity: 0 },
  ];
  originals.forEach((source, index) => {
    const genotype = expandedGenotype(index === 0 ? lillyGenotype() : normalGenotype());
    if (index === 2) genotype.loci.axanthic = ["ax", "ax"];
    const g = { ...source, name: names[index], genotype, potential: traits[index],
      genetics: legacyRecord({ genotype }), sex: index === 1 || index === 2 || index === 4 ? "male" as const : "female" as const,
      birthTurn: -game.rules.adultAfter, birthDate: "2026-10-13", stage: "adult" as const,
      nextBreedTurn: index === 4 ? 1 : 0, cycleAnchor: REFERENCE_DATE, recoverUntil: REFERENCE_DATE,
      hearts: index === 0 ? 3 : 5, visualSeed: "home-reference-" + index };
    game.individuals[g.id] = g;
  });
  game.shop.offers = {};
  game.food = 38;
  validateGame(game);
  return game;
}
