import prices from "../../../market/prices.json" with { type: "json" };
import type { Gecko, HardcoreGame } from "./model";
import { axanthicState } from "@/genetics/hardcore";
import { dateNumber } from "./time";

export interface PriceTable {
  schemaVersion: number; version: string; effectiveDate: string; currency: string; status: string;
  buyMultiplier: number; sellMultiplier: number; bases: Record<string, number>; carrierMultiplier: number; note: string;
}
export const MARKET: PriceTable = prices;
export function validatePriceTable(p: PriceTable): void {
  dateNumber(p.effectiveDate);
  if (p.schemaVersion !== 1 || p.currency !== "KRW" || !p.version || p.version.length > 128 ||
    !["provisional-game-prices", "reviewed-market-estimates"].includes(p.status) ||
    !Number.isFinite(p.buyMultiplier) || !Number.isFinite(p.sellMultiplier) ||
    p.buyMultiplier < 1 || p.sellMultiplier <= 0 || p.sellMultiplier >= 1 || p.sellMultiplier >= p.buyMultiplier ||
    !Number.isFinite(p.carrierMultiplier) || p.carrierMultiplier < 1 || p.carrierMultiplier > 10 ||
    ["normal", "harlequin", "dalmatian", "tricolor", "lilly", "axanthic", "axanthic-lilly"].some(k => !Number.isSafeInteger(p.bases[k]) || p.bases[k] < 1000 || p.bases[k] > 1e9))
    throw new Error("가격표가 손상되었습니다.");
}
const round = (value: number) => Math.max(1000, Math.round(value / 1000) * 1000);
export function valueGecko(g: Gecko, table: PriceTable = MARKET) {
  validatePriceTable(table);
  const ax = axanthicState(g.genotype), lilly = g.genotype.loci["lilly-white"].includes("Lw"), t = g.potential;
  const bucket = ax === "visual" ? lilly ? "axanthic-lilly" : "axanthic" : lilly ? "lilly" :
    t.spotDensity >= .5 ? "dalmatian" : t.flankIntensity > .62 && t.creamCoverage > .35 ? "harlequin" :
    t.redIntensity > .7 && t.creamCoverage > .45 ? "tricolor" : "normal";
  const marketBase = table.bases[bucket];
  const appearance = .8 + .2 * t.redIntensity + .15 * t.creamCoverage + .15 * (t.dorsalIntensity + t.flankIntensity) / 2;
  // Genotype, game appearance, disclosed sex, age and documented pedigree; never lineage NAME.
  const carrier = ax === "carrier" ? table.carrierMultiplier : 1;
  const sex = g.stage === "adult" && g.sex === "female" ? 1.08 : 1;
  const age = g.stage === "adult" ? 1 : g.stage === "juvenile" ? .8 : .65;
  const pedigree = g.provenance === "known" && g.parents ? 1.05 : 1;
  const valuation = round(marketBase * appearance * carrier * sex * age * pedigree);
  return { bucket, marketBase, valuation, ask: round(valuation * table.buyMultiplier),
    sell: round(valuation * table.sellMultiplier), marketVersion: table.version,
    provisional: table.status === "provisional-game-prices" };
}
export function updateMarket(game: HardcoreGame, table: PriceTable = MARKET): void {
  validatePriceTable(table); game.marketVersion = table.version;
  for (const offer of Object.values(game.shop.offers)) {
    const quote = valueGecko(offer.individual, table);
    offer.askPrice = quote.ask; offer.marketBase = quote.marketBase; offer.marketVersion = table.version;
  }
}
