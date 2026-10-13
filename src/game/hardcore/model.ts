import type { Individual, Parents } from "@/game/model";
import type { Genotype } from "@/genetics/mendel";
import type { PotentialTraits, TraitVariation } from "@/genetics/traits";
import type { GameDate } from "./time";

export type Ownership = "owned" | "sold" | "dead";
export interface Gecko extends Individual {
  birthDate: GameDate;
  status: Ownership;
  hearts: number;
  lastFedDate: GameDate | null;
  diedDate: GameDate | null;
  cycleAnchor: GameDate;
  recoverUntil: GameDate;
  lineageIds: string[];
  provenance: "known" | "unverified";
}
export interface Rules {
  fertilizationChance: number;
  hatchChance: number;
  ovulationCycleDays: number;
  ovulationWindowDays: number;
  recoveryDays: number;
  juvenileAfter: number;
  adultAfter: number;
  traitVariation: TraitVariation;
  initialMoney: number;
  initialCapacity: number;
  foodUnitPrice: number;
  expansionSlots: number;
  expansionBasePrice: number;
  maxCapacity: number;
}
export interface Mating {
  id: string;
  ordinal: number;
  date: GameDate;
  parents: Parents;
  fatherGenotype: Genotype;
  motherGenotype: Genotype;
  fatherTraits: PotentialTraits;
  motherTraits: PotentialTraits;
  generation: number;
  lineageIds: string[];
  seed: string;
  fertilizationChance: number;
  hatchChance: number;
  status: "pending" | "fertilized" | "failed" | "laid" | "cancelled";
  resolvedDate: GameDate | null;
}
export interface TimedEgg {
  id: string;
  matingId: string | null;
  laidDate: GameDate;
  dueDate: GameDate;
  embryo: Gecko;
  hatchChance: number;
  seed: string;
  status: "incubating" | "hatched" | "failed";
  resolvedDate: GameDate | null;
}
export interface Sale {
  id: string; individualId: string; date: GameDate; price: number;
  marketVersion: string; marketBase: number; valuation: number;
}
export interface ShopOffer { id: string; individual: Gecko; askPrice: number; marketBase: number; marketVersion: string }
export interface HardcoreGame {
  saveVersion: 3;
  rulesVersion: 2;
  gameId: string;
  seed: string;
  revision: number;
  turn: number;
  nextClutch: number;
  startedDate: GameDate;
  lastDate: GameDate;
  rules: Rules;
  money: number;
  food: number;
  capacity: number;
  expansions: number;
  individuals: Record<string, Gecko>;
  matings: Record<string, Mating>;
  eggs: Record<string, TimedEgg>;
  sales: Sale[];
  lineages: Record<string, { id: string; name: string; createdDate: GameDate }>;
  nextLineage: number;
  shop: { date: GameDate; offers: Record<string, ShopOffer> };
  marketVersion: string;
  notices: string[];
  migration: { from: 2; date: GameDate } | null;
}
export type Action =
  | { type: "feed"; id: string }
  | { type: "feedAll" }
  | { type: "breed"; fatherId: string; motherId: string }
  | { type: "buyFood"; amount: number }
  | { type: "buyGecko"; offerId: string }
  | { type: "sell"; id: string }
  | { type: "expand" }
  | { type: "rename"; id: string; name: string }
  | { type: "lineage"; id: string; name: string };
