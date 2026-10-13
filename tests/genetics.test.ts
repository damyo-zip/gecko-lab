import { describe, expect, it } from "vitest";
import { crossLocus, forecastCross, inheritGenotype, LILLY_LOCUS, lillyGenotype, normalGenotype, type Genotype, type LocusDefinition } from "../src/genetics/mendel";
import { DEFAULT_VARIATION, inheritTraits, TRAIT_KEYS } from "../src/genetics/traits";

const normal = normalGenotype(), lilly = lillyGenotype();
describe("Lilly White Mendelian model", () => {
  it("predicts 50% normal and 50% heterozygous Lilly White without nonviable offspring", () => {
    const forecast = forecastCross(normal, lilly);
    expect(forecast.nonViableProbability).toBe(0);
    expect(forecast.loci[0].outcomes.map((v) => [v.alleles.join("/"), v.probability, v.viableProbability]))
      .toEqual([["n/n", .5, .5], ["n/Lw", .5, .5]]);
  });
  it("separates fertilization probabilities from conditional survival probabilities", () => {
    const forecast = forecastCross(lilly, lilly), outcomes = forecast.loci[0].outcomes;
    expect(outcomes.map((v) => v.probability)).toEqual([.25, .5, .25]);
    expect(forecast.nonViableProbability).toBe(.25);
    expect(outcomes[0].viableProbability).toBeCloseTo(1/3, 12);
    expect(outcomes[1].viableProbability).toBeCloseTo(2/3, 12);
    expect(outcomes[2]).toMatchObject({ alleles: ["Lw","Lw"], viable: false, viableProbability: 0 });
  });
  it("sums probabilities correctly for every registered parental pair", () => {
    const pairs = [["n","n"],["n","Lw"],["Lw","Lw"]] as const;
    for (const father of pairs) for (const mother of pairs) {
      const outcomes = crossLocus(father, mother, LILLY_LOCUS);
      expect(outcomes.reduce((sum, v) => sum + v.probability, 0)).toBe(1);
      const surviving = outcomes.filter(v => v.viable);
      expect(surviving.reduce((sum, v) => sum + v.viableProbability, 0)).toBe(surviving.length ? 1 : 0);
    }
  });
  it("is reproducible and independent of adding an independently inherited locus", () => {
    const second: LocusDefinition = { id: "test-only", name: "test locus", alleles: ["a","b"], nonViablePairs: [], evidence: "synthetic test fixture only" };
    const a: Genotype = { modelVersion: 1, loci: { ...normal.loci, "test-only": ["a","b"] } };
    const b: Genotype = { modelVersion: 1, loci: { ...lilly.loci, "test-only": ["a","b"] } };
    for (let i = 0; i < 100; i++) {
      const seed = "seed-" + i, result = inheritGenotype(normal, lilly, seed);
      expect(inheritGenotype(normal, lilly, seed)).toEqual(result);
      const extended = inheritGenotype(a, b, seed, [LILLY_LOCUS, second]);
      expect(extended.genotype.loci["lilly-white"]).toEqual(result.genotype.loci["lilly-white"]);
      for (const locus of forecastCross(a,b,[LILLY_LOCUS,second]).loci)
        expect(locus.outcomes.reduce((sum,v) => sum + v.probability,0)).toBe(1);
    }
  });
  it("matches expected frequencies over 10,000 independent seeded crosses", () => {
    const counts = { "n/n": 0, "n/Lw": 0, "Lw/Lw": 0 };
    for (let i = 0; i < 10_000; i++) {
      const result = inheritGenotype(lilly, lilly, "simulation-" + i);
      const key = result.genotype.loci["lilly-white"].join("/") as keyof typeof counts;
      counts[key]++;
      expect(result.viable).toBe(key !== "Lw/Lw");
    }
    expect(counts["n/n"]/10_000).toBeCloseTo(.25, 1);
    expect(counts["n/Lw"]/10_000).toBeCloseTo(.5, 1);
    expect(counts["Lw/Lw"]/10_000).toBeCloseTo(.25, 1);
    for (const [key, expected] of [["n/n", .25], ["n/Lw", .5], ["Lw/Lw", .25]] as const)
      expect(Math.abs(counts[key]/10_000 - expected)).toBeLessThan(.02);
  });
  it("rejects unknown, unreviewed or malformed loci", () => {
    expect(() => forecastCross({ ...normal, loci: { axanthic: ["a","a"] } }, lilly)).toThrow();
    expect(() => crossLocus(["n","unknown"], ["n","n"], LILLY_LOCUS)).toThrow();
    expect(() => forecastCross({ ...normal, modelVersion: 2 as never }, lilly)).toThrow();
  });
  it("normalizes unphased allele order without changing seeded outcomes", () => {
    const reversed: Genotype = {modelVersion:1,loci:{"lilly-white":["Lw","n"]}};
    for (let i = 0; i < 100; i++)
      expect(inheritGenotype(normal,reversed,"unordered-"+i)).toEqual(inheritGenotype(normal,lilly,"unordered-"+i));
  });
});

describe("game approximation for continuous visual traits", () => {
  const father = Object.fromEntries(TRAIT_KEYS.map(key => [key,.2])) as typeof DEFAULT_VARIATION;
  const mother = Object.fromEntries(TRAIT_KEYS.map(key => [key,.8])) as typeof DEFAULT_VARIATION;
  it("uses the parental mean with configurable per-trait bounds", () => {
    const zero = Object.fromEntries(TRAIT_KEYS.map(key => [key,0])) as typeof DEFAULT_VARIATION;
    expect(inheritTraits(father,mother,"seed",zero)).toEqual(Object.fromEntries(TRAIT_KEYS.map(key => [key,.5])));
    for (let i = 0; i < 100; i++) {
      const child = inheritTraits(father,mother,"seed-"+i);
      for (const key of TRAIT_KEYS) expect(Math.abs(child[key]-.5)).toBeLessThanOrEqual(DEFAULT_VARIATION[key]);
    }
  });
  it("is repeatable, clamps bounds, and keeps unchanged trait streams independent", () => {
    const output = inheritTraits(father,mother,"fixed");
    expect(inheritTraits(father,mother,"fixed")).toEqual(output);
    expect(inheritTraits(father,mother,"other")).not.toEqual(output);
    const changed = inheritTraits(father,mother,"fixed",{...DEFAULT_VARIATION,spotDensity:0});
    for (const key of TRAIT_KEYS.filter(key => key !== "spotDensity")) expect(changed[key]).toBe(output[key]);
    const high = Object.fromEntries(TRAIT_KEYS.map(key => [key,1])) as typeof DEFAULT_VARIATION;
    for (const value of Object.values(inheritTraits(high,high,"clamp"))) expect(value).toBeLessThanOrEqual(1);
    expect(() => inheritTraits(father,mother,"bad",{...DEFAULT_VARIATION,spotDensity:NaN})).toThrow();
  });
});
