import type { Individual, Parents } from "@/game/model";
import type { Genotype } from "@/genetics/mendel";
import type { PotentialTraits, TraitVariation } from "@/genetics/traits";
import type { GameDate } from "./time";
import type { GeneticsRecord, Knowledge } from "@/genetics/advanced/model";
import type { HealthGenome } from '@/genetics/health';
import type {RushState,RushTap} from '@/game/rush';

export type Ownership = "owned" | "sold" | "dead" | "pedigree";
export const TIME_MODES = ["turn", "realtime"] as const;
export type TimeMode = typeof TIME_MODES[number];
export interface GameTime {
  mode: TimeMode;
  /** KST wall-clock anchor; logical dates can be ahead after manual turns. */
  realtimeAnchorDate: GameDate;
}
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
  genetics?: GeneticsRecord;
  deathCause?: "starvation" | "natural" | null;
  lastProcessedTurn?: number;
  /** Hidden, fictional recessive health loci; independent of F and appearance. */
  healthGenome?: HealthGenome;
}
/** A pre-hatch candidate, never a live collection individual until viability is checked. */
export type Embryo = Gecko & { development?: { version:1; viable:boolean; causes:string[] } };
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
  /** v1.2 immutable fertilization results; null for completed legacy records. */
  lifecycle?: {
    startTurn: number; nextLayTurn: number; clutchesLaid: number; maxClutches: number;
    offspring: { embryo: Embryo; fertilized: boolean }[];
  } | null;
  /** Null preserves completed/pending historical conception outcomes. */
  riskModel?: {version:1; father:HealthGenome; mother:HealthGenome} | null;
  genetics?: {
    father: GeneticsRecord; mother: GeneticsRecord;
    observedIds: string[];
    updates: { id: string; before: Knowledge; after: Knowledge }[];
    /** Material mapping fixed at conception; absence preserves old embryos. */
    paletteVersion?: 2;
  } | null;
}
export interface TimedEgg {
  id: string;
  matingId: string | null;
  laidDate: GameDate;
  dueDate: GameDate;
  embryo: Embryo;
  hatchChance: number;
  seed: string;
  status: "incubating" | "hatched" | "failed";
  resolvedDate: GameDate | null;
  /** v10 manual care. Null collection waits on the mother; null settlement holds the slot. */
  care?: { version: 1; collectedTurn: number | null; settledTurn: number | null };
  lifecycle?: { laidTurn: number; dueTurn: number; fertilized: boolean; failure: "infertile" | "hatch" | "genetic" | "health" | null } | null;
}
export interface Sale {
  id: string; individualId: string; date: GameDate; price: number;
  marketVersion: string; marketBase: number; valuation: number;
}
/** External parents are immutable pedigree records, never player livestock. */
export interface ShopFamily { version: 1; seed: string; matingTurn: number; father: Gecko; mother: Gecko }
export interface ShopOffer { id: string; individual: Gecko; askPrice: number; marketBase: number; marketVersion: string;
  family?: ShopFamily | null; purchased?: boolean;
}
/** v8 adds album metadata to the existing lineage, never a second pedigree. */
export interface NamedLineage {
  id: string; name: string; createdDate: GameDate;
  /** Null only when an old save cannot identify a unique actual founder. */
  founderId?: string | null;
  favorite?: boolean;
}
export interface HardcoreGame {
  /** Versioned engine migration, independent of turn, economy and lifecycle rules. */
  forge?: import('./forge-model').ForgeSystem;
  /** Optional v10 extension. Missing in old saves means no selected challenge/rewards. */
  breedingChallenges?: import("./challenges").BreedingChallenges;
  saveVersion: 5 | 6 | 7 | 8 | 9 | 10;
  rulesVersion: 2 | 3 | 4;
  gameId: string;
  seed: string;
  revision: number;
  turn: number;
  nextClutch: number;
  startedDate: GameDate;
  lastDate: GameDate;
  time: GameTime;
  rules: Rules;
  money: number;
  food: number;
  capacity: number;
  expansions: number;
  individuals: Record<string, Gecko>;
  matings: Record<string, Mating>;
  eggs: Record<string, TimedEgg>;
  sales: Sale[];
  lineages: Record<string, NamedLineage>;
  nextLineage: number;
  shop: { date: GameDate; offers: Record<string, ShopOffer>; batch?: number };
  marketVersion: string;
  notices: string[];
  migration: { from: 2; date: GameDate } | null;
  /** Optional, versioned cafe shift extension; absent v9 saves mean never played. */
  cafeRush?:RushState;
}
export type LegacyHardcoreGame = Omit<HardcoreGame, "saveVersion" | "time"> & { saveVersion: 3 };
export type LegacyV4Game = Omit<HardcoreGame, "saveVersion"> & { saveVersion: 4 };
export type GameplayAction =
  | { type: "selectChallenge"; challengeId: import("./challenge-rules").ChallengeId }
  | { type: "acknowledgeChallenge"; challengeId: import("./challenge-rules").ChallengeId }
  | { type: "equipChallengeTitle"; challengeId: import("./challenge-rules").ChallengeId | null }
  | { type: "collectEggs"; matingId: string }
  | { type: "receiveHatchling"; eggId: string }
  | { type: "removeFailedEgg"; eggId: string }
  | { type: "feed"; id: string }
  | { type: "feedAll" }
  | { type: "breed"; fatherId: string; motherId: string; riskAcknowledgement?:string }
  | { type: "buyFood"; amount: number }
  | { type: "buyGecko"; offerId: string }
  | { type: "refreshShop" }
  | { type: "sell"; id: string }
  | { type: "expand" }
  | { type: "rename"; id: string; name: string }
  | { type: "lineage"; id: string; name: string }
  | { type: "renameLineage"; lineageId: string; name: string }
  | { type: "unfavoriteLineage"; lineageId: string }
  | { type: "startRush" }
  | { type: "stepRush"; elapsedMs:number; taps?:RushTap[] }
  | { type: "claimRush" };
export type Action = GameplayAction
  | { type: "endTurn"; autoBuyFood?: boolean; expectedTurn?: number }
  | { type: "setTimeMode"; mode: TimeMode };
