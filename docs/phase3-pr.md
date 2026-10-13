# Phase 3: Daily survival, breeding economy and permanent pedigree

The home page now runs a KST calendar game instead of advancing turns on demand. Players buy actual seeded geckos, manually feed them each day, breed during the female's fertile window, follow fertilization/laying/hatching/growth across four dates, sell offspring and expand capacity. Unattended geckos lose one heart each midnight and permanently die at zero; sold and dead animals retain their complete pedigree.

## Implementation

- Pure daily reducer processes missed dates once, with heart loss/death before breeding, hatching, growth and shop refresh. No automatic feeding, offline protection, live fast-forward, server clock or anti-cheat.
- Versioned rules, captured parent genes and success rates, deterministic independent fertilization/hatch decisions, fixed embryos at laying, hidden hatchling sex until adulthood, risky/close-kin mating rejection and two offspring slots reserved before mating.
- Specimen shop, food inventory, immediate sale quotes/history and capacity expansion. Market base, individual valuation and sale price stay separate; buy/sell spread prevents immediate arbitrage.
- Iterative permanent ancestry/descendant traversal and non-genetic lineage names, including sold/dead records and future offspring.
- Transactional v2→v3 migration, monotonic storage CAS, validated/checksummed backups, raw prior-slot archives on confirmed replacement and production offline shell cache. Offline caching never cares for animals.
- Phase 1 renderer/reference assets/tests are unchanged. Phase 2 simulation remains at `/lab/breeding` with an isolated `phase2-lab` slot; its test assertions are retained.

## Scientific and market limits

Lilly White retains the breeder-observed single-locus lethal-homozygote working model. Axanthic adds a same-compatible-line recessive working model and assumes independence from Lilly. Actual line compatibility, molecular assays, complex morph interactions and Cappuccino are not verified. Continuous appearance traits, condition, sex ratio and compressed schedules are game assumptions. No new high-quality art is claimed.

All initial market amounts are explicitly **provisional game prices**. Public research attempts were blocked by the environment network proxy (403), so verified listing/transaction samples are zero. `market/sources.json` records that limitation; `docs/market-update.md` defines weekly/manual research, asking vs completed prices, deduplication/outliers, human review/approval and PR/Vercel publication. Existing sale amounts and market versions never change on a table update.

## Review by commit

1. `9a8c4b2`: KST daily survival and v3 migration/storage foundation.
2. `949438d`: daily mating/egg schedule and recessive inheritance.
3. `c5d634e`: economy, real shop specimens, capacity reservations and permanent lineage.
4. `4b23f88`: v3 pedigree, schedules, immutable embryos and structural corruption checks.
5. `a45110a`: maximum-length game seed support.
6. `2281ae3`: mobile integration, isolated legacy simulation, offline shell, market workflow and retained browser coverage.
7. Final documentation/captures report all validation results.

These pure-module commits can be reviewed separately. Base `main` still lacks Phase 1 and Phase 2 at preparation time, so this integration comparison also includes them. Phase 1 reference PR: #1; Phase 2 branch: `feat/genetics-breeding`.

## Validation

- TypeScript and optimized Next.js production build passed.
- 73 unit tests passed, including every original Phase 1/2 test, 10,000-carrier-cross simulation and 10 descendant generations (Gen 11) with care, legal outcrosses and per-generation backup restoration.
- All 40 mobile/desktop E2E cases passed on the final production build: 20 mobile and 20 desktop, including all 24 retained cases. Workers are bounded and unit/browser checks run sequentially to avoid environment resource contention; no existing checks were removed or skipped.
- Actual 360×800 touch flow reaches Gen 3, hides newborn sex, names/sells offspring, expands space, preserves named pedigree and survives refresh. Additional cases cover offline death/idempotence, v2 migration, backups, corrupt records, stale tabs, fatal odds and kinship rejection.
- Production offline reload tested with no network; stored date/economy/heart losses remain consistent.
- Actual browser screenshots are committed under `docs/phase3-*.png`. Safari/iOS hardware and independently verified domestic market data remain unverified.

GitHub CI results must be checked separately from these local results. If GitHub API access is blocked, all changes and this description remain ready for the Codex platform to open a PR with base `main`, head `feat/hardcore-economy`.
