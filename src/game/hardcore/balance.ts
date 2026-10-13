import { DEFAULT_VARIATION } from "@/genetics/traits";
import type { Rules } from "./model";

/** Compressed GAME days/condition/economy, not animal husbandry advice. */
export const BALANCE: Rules = {
  fertilizationChance: .9, hatchChance: .9,
  ovulationCycleDays: 6, ovulationWindowDays: 2, recoveryDays: 4,
  juvenileAfter: 1, adultAfter: 1,
  traitVariation: { ...DEFAULT_VARIATION },
  initialMoney: 500_000, initialCapacity: 4,
  foodUnitPrice: 1_000, expansionSlots: 4, expansionBasePrice: 100_000, maxCapacity: 3000,
};
