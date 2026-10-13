GECKO LAB now supports a playable local breeding loop: choose adult parents, inspect offspring probabilities, lay two independently seeded eggs, advance turns, hatch and name offspring, grow them to adults, and breed the next generation. IndexedDB persists all individuals, parent IDs, fixed embryos, growth, game rules and replay counters across reloads.

The genetics engine is separate from gameplay and graphics. It calculates the specified single-locus Lilly White model, displays fertilization and viable-offspring conditional probabilities separately, and blocks nonviable-risk crosses. Continuous visual traits use an explicitly labeled game approximation. Lineal relatives and shared ancestors within two generations of both parents are blocked. Versioned backups validate structure, ancestry and checksums; atomic storage revisions prevent stale-tab overwrites.

The Korean mobile UI has collection, breeding, incubator and pedigree tabs, individual details, naming, configurable new games and confirmed JSON restore/reset. The existing renderer and its unit tests are unchanged; the original laboratory remains at `/lab`, with only the legacy E2E entry URL updated.

## Validation

- TypeScript and production build passed.
- 50 unit tests passed, including all 23 Phase 1 tests, a 10,000-cross genetic simulation and at least five descendant generations created from the six actual founders and saved/restored.
- All 24 Chromium E2E tests passed: 12 mobile (360×800 with real touch events), 12 desktop, including all 12 Phase 1 checks.
- The full requested loop was played through a second offspring generation and reloaded with equal persisted data. Backup/restore, corruption preservation/recovery and concurrent-tab conflicts were exercised in real IndexedDB.
- Actual mobile play screenshots are in `docs/phase2-*.png`; README records results and model limits.
- Development startup also rendered six founder canvases without browser errors or horizontal overflow.

## Scope and assumptions

Lilly White uses the project-specified breeder-observed dominant/nonviable-homozygote model; this is not a molecular genetic test or a prediction of actual survival rates. New external evidence was not independently verified in the restricted execution environment. Parental mean plus bounded variation, sex 50:50, unrelated founders and turn-based growth/incubation are game assumptions. Axanthic/Cappuccino, linked/complex allele interactions and precise inbreeding coefficients are excluded. See `docs/genetics-model.md`.

No new gecko art, currencies, trading, care, diseases, accounts or multiplayer are added. All growth stages temporarily use the Phase 1 sprite. Safari/real-device testing and service-worker offline reload remain outstanding. Phase 3 can replace art through `game/adapter.ts` and the existing eight-layer 96×96 graphics contract without changing genetic/pedigree IDs.

## Phase 1 dependency

This branch is based on Phase 1 PR #1. Since main still lacks that implementation, this PR currently includes the Phase 1 changes as well. The Phase 2 commit preserves the original renderer, tests and reference assets.
