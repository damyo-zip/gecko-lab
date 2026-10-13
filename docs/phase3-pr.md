# Phase 3: Breeding economy with manual turns and optional real time

Players can now finish a turn to advance exactly one game day and immediately follow the breeding loop. The default is manual turns; settings can switch an existing game or a new game to the retained Asia/Seoul midnight mode. Both sources feed the same survival, fertilization, laying, hatching, growth, ovulation and shop reducer.

The game also includes seeded specimen purchases, manual food inventory/care, permanent death at zero hearts, offspring sales, capacity expansion/reservations and permanent named pedigrees. Sold/dead records remain available across generations.

## Time and save behavior

- `time-source.ts` chooses logical dates separately from `calendar.ts` daily rules. Manual turns ignore wall-clock elapsed days; the end-turn button commits one day before updating the UI.
- Switching modes preserves the current game date, hearts, specimens, embryos, lineage and history. A separate KST anchor lets a manually advanced calendar resume on the next real midnight without jumping forward/backward.
- Save v4 persists mode/anchor and imports validated/checksummed v2/v3 saves into manual mode while preserving their existing progress. Original active-slot records are archived atomically.
- Real-time mode still catches up missed dates. A date change arriving during an IndexedDB save is drained after commit, so the signal is not lost and the user action is not replayed. This fixes the four real-time E2E date-update failures seen in the earlier CI run.
- Stale tabs, invalid saves, egg rerolls, dangerous/close-kin matings and overcapacity purchases remain blocked. Automatic feeding is not implemented.

## Architecture and limits

The existing Phase 1 renderer/reference images and Phase 2 simulator/tests remain. `/lab/breeding` uses an isolated `phase2-lab` slot. No new high-quality art is claimed.

Lilly White retains the breeder-observed lethal-homozygote working model. Axanthic uses a same-compatible-line recessive working model with locus independence; actual line compatibility, molecular assays and complex morph interactions are unverified. Continuous appearance, condition, sex ratio and compressed schedules are game assumptions.

Market values remain explicitly provisional game prices. Initial public research had zero verified samples due to the earlier environment network restriction; internet access is now available, but this time-control change does not revise unverified prices. Versioned data and `docs/market-update.md` retain the manual, human-reviewed research/PR workflow. Existing sale amounts and market versions remain immutable.

## Validation

- TypeScript, 81 unit tests and the optimized Next.js build passed locally.
- 48 mobile/desktop E2E cases passed: all previous 40 cases plus eight cases for manual gameplay, mode switching, v3 migration and a real IndexedDB save/date race.
- 360×800 touch play advances from mating to adulthood with end-turn clicks; changing wall time and refreshing does not advance manual games. Real-time offline catch-up, lethal/kinship rejection, backups, corruption recovery and CAS checks are retained.
- Existing Gen 11 pedigree and 10,000-cross simulations remain passing.
- `docs/turn-mode-mobile.png` is an unedited capture from the mobile browser test.

Latest GitHub CI is verified separately after pushing. Main still lacks the earlier phases, so this integration PR includes the existing Phase 1 and Phase 2 work as well as Phase 3. No merge is performed automatically.
