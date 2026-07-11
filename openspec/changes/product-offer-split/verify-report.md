```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:e0e5eff20d82df403195aa20450388b164aaccf9
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 8/8
scenarios: 13/13
test_command: "pnpm --filter contracts test && pnpm --filter backend test && pnpm --filter ./frontend test"
test_exit_code: 1
test_exit_code_note: "Non-zero due to 2 known pre-existing/unrelated frontend failures (app.spec.ts — see Tests section); contracts (81/81) and backend (249/249) exit 0. Do not treat this run as fully green without reading the Tests section."
test_output_hash: sha256:42c3fef8b50d16119fc76ec80f8c389822e7c20701f7011e5f66c09b60b206ba
build_command: "pnpm --filter backend build && pnpm --filter ./frontend build"
build_exit_code: 0
build_output_hash: sha256:cef7a3a297ae198427dfb32fdd255ad904e9975610f3dac126f4bc5421a428c7
```

## Verification Report

**Change**: product-offer-split
**Version**: N/A (ADDED-only capability, no prior spec)
**Mode**: Strict TDD

Verified from-scratch on a disposable `git worktree` checked out at `origin/feat/product-offer-split-frontend` (e0e5eff), the tip of the 3-PR chain, after `git fetch origin --prune`. Nothing was assumed from the apply-progress narrative — every claim below was independently re-derived from the actual git graph, file contents, live Postgres state, and a fresh `pnpm install` + test run.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 34 |
| Tasks complete | 34 |
| Tasks incomplete | 0 |

### Chain Reachability (the specific failure mode this verify pass was launched to catch)
| Check | Result |
|-------|--------|
| PR #21 state | OPEN, base=`develop`, head=`feat/product-offer-split-schema`, mergeable=MERGEABLE |
| PR #22 state | OPEN, base=`feat/product-offer-split-schema`, head=`feat/product-offer-split-backend`, mergeable=MERGEABLE |
| PR #23 state | OPEN, base=`feat/product-offer-split-backend`, head=`feat/product-offer-split-frontend`, mergeable=MERGEABLE |
| None merged | Confirmed live via `gh pr view` — all 3 still OPEN |
| `develop` ancestor of `schema` | ✅ `git merge-base --is-ancestor` true (1 unique commit: 4955b5d) |
| `schema` ancestor of `backend` | ✅ true (1 unique commit: 5a05af8) |
| `backend` ancestor of `frontend` | ✅ true (1 unique commit: e0e5eff) |

Chain topology is structurally sound: each branch cleanly contains its parent's commits with no divergence, unlike the `fix-analytics-db-wiring` precedent (this is the pre-merge equivalent check; the retarget-gate discipline documented in tasks.md 1.13/2.11 still applies once a human starts merging).

### Build & Tests Execution (re-run independently, not copied from apply-progress)
**Build**: ✅ Passed
```text
pnpm --filter backend build   → clean (nest build)
pnpm --filter ./frontend build → clean, Application bundle generation complete
```

**Tests**: ✅ 378 passed / ❌ 2 failed / ⚠️ 2 skipped (across 3 workspaces)
```text
pnpm --filter contracts test   → 16 suites, 81/81 passed
pnpm --filter backend test     → 26 suites, 249/249 passed
pnpm --filter ./frontend test  → 9 files, 48 passed / 2 skipped / 2 failed (app.spec.ts)
```
Focused re-run: `pnpm exec jest --testPathPatterns="products|raw-captures"` → 5 suites, 50/50 passed (matches claim).
Focused re-run: `pnpm exec jest --testPathPatterns="pipeline"` → 10 suites, 73/73 passed (scope-boundary check).

The 2 frontend failures (`app.spec.ts` — `should create the app`, `should render title`) are confirmed **pre-existing and unrelated**: re-ran the identical suite on a second worktree at `origin/develop` (pre-change) and got the exact same 2 failures with the same `ThemeService`/`localStorage` `TypeError`. `git diff` between `develop` and the frontend-tip branch shows **zero changes** to `app.spec.ts`, `theme.service.ts`, or `test-setup.ts`. Apply-progress's claim of "pre-existing, unrelated" is verified true, not just asserted.

**Coverage**: Not available — no coverage tool configured in this repo's test scripts (skipped per skill instructions, not a failure).

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Canonical Product/Offer/PriceObservation Split | Product and Offer are distinct rows | `products.service.spec.ts > runs the whole ingest inside one $transaction` + live DB row check (`Product`=1, `Offer`=1, distinct tables) | ✅ COMPLIANT |
| Canonical Product/Offer/PriceObservation Split | Price observations hang off Offer | `products.service.spec.ts > creates exactly one PriceObservation per ingested item` + schema `PriceObservation.offerId` FK + live DB row | ✅ COMPLIANT |
| One Offer Per Ingested Item (No Dedup) | Two distinct items create two products | `products.service.spec.ts > creates two distinct Products+Offers when two items share the same title (url must disambiguate, no dedup)` | ✅ COMPLIANT |
| One Offer Per Ingested Item (No Dedup) | Re-ingesting same pair updates, not duplicates | `products.service.spec.ts > updates the existing Offer + Product instead of duplicating when the (source,url) pair collides` | ✅ COMPLIANT |
| Extension Ingestion Route Contract Preserved | Existing ingestion payload accepted | `products.controller.ts` — `POST /products/ingest` route unchanged, delegates to `ingestFromExtension`; `products.controller.spec.ts` route tests | ✅ COMPLIANT |
| Extension Ingestion Route Contract Preserved | Response remains consumable | `products.controller.spec.ts > findOne shapes a Prisma row with a live-Decimal offers[] into a ProductResponseDto` + live smoke test response shape | ✅ COMPLIANT |
| Dead Upsert Endpoint Removed | Upsert endpoint no longer available | `products.controller.spec.ts > does NOT expose POST /products/upsert (dead endpoint, zero callers)` + **live curl against running `scraper-backend` container → confirmed 404** | ✅ COMPLIANT |
| Price History Retrieval Across Offers | Product with a single offer | `products.controller.spec.ts > getPriceHistory maps every PriceObservation entry through plainToInstance` | ✅ COMPLIANT |
| Price History Retrieval Across Offers | Product with multiple offers (future-proofing) | `products.component.spec.ts > requests price history by productId and attributes each observation to its own Offer` + `getPriceHistory` query is `where: { offer: { productId } }` (per-offer, not merged) | ✅ COMPLIANT |
| Category/Brand Association Columns | Ingested product has no category/brand assigned | `schema.prisma` — `categoryId`/`brandId` nullable FKs; `products.service.ts` `tx.product.create`/`update` never sets either field (grep-confirmed) | ✅ COMPLIANT |
| Frontend Contracts Reflect Offer-Level Data | Product response includes a list of offers | `product-response.dto.spec.ts` + `offer-response.dto.spec.ts` (81/81 contracts suite) + `ProductResponseDto.offers: OfferResponseDto[]` | ✅ COMPLIANT |
| Non-Goals Explicit | Pipeline module is unaffected | `git diff --stat develop..frontend-tip -- backend/src/modules/pipeline/` → **empty diff**; `pnpm exec jest --testPathPatterns="pipeline"` → 73/73 | ✅ COMPLIANT |
| Non-Goals Explicit | RawCapture wiring left open | Design resolved it (wired, real FK); `raw-captures.service.spec.ts > throws NotFoundException when offer does not exist (real FK, product-offer-split)` + live migration applied (`raw_captures_offerId_fkey → Offer(id)` confirmed via `\d raw_captures`) | ✅ COMPLIANT |

**Compliance summary**: 13/13 scenarios compliant

### Correctness (Static + Runtime Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Schema split (Product/Offer/PriceObservation) | ✅ Implemented | Confirmed in `schema.prisma` (frontend-tip) and live-applied migration `20260711180000_product_offer_split` in `scraper-postgres` (`_prisma_migrations` row present, `finished_at` set) |
| `DomainRule.sourceId → Source` bridge | ✅ Implemented | `schema.prisma:28-` `DomainRule.sourceId`, backfill logic in `ingestFromExtension` (lines 106-158) |
| `RawCapture.offerId` real FK | ✅ Implemented | Migration line 114 (`ADD CONSTRAINT raw_captures_offerId_fkey ... REFERENCES "Offer"(id) ON DELETE CASCADE`); live `\d raw_captures` confirms it exists on the running DB |
| `ProductsService.ingestFromExtension` one `$transaction` | ✅ Implemented | `products.service.ts:89-277` — single `this.prisma.$transaction(async (tx) => {...})` wrapping Source→DomainRule→Product/Offer→PriceObservation→RawCapture |
| `POST /products/upsert` removed | ✅ Implemented | No route in `products.controller.ts`; live 404 via curl against running container |
| Contracts DTOs rewritten | ✅ Implemented | `offer-response.dto.ts`, `price-observation-response.dto.ts` created; `upsert-product.dto.ts`, `price-history-response.dto.ts` confirmed absent from `packages/contracts/src/products/` |
| `raw-captures.service.ts` offer-existence check | ✅ Implemented | Lines 36-41, RED test present at line 206 of `raw-captures.service.spec.ts` |
| `domains.service.ts` incidental rename | ✅ Implemented | 2-line diff, `include:{products:true}` → `include:{offers:true}`, exactly as claimed |
| Frontend Products page offer-level adaptation | ✅ Implemented | `.prd-offer-row`/`.prd-history-group`/`historyForOffer()` all present in component+template, 3 covering tests pass |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Decision 1 — `DomainRule → Source` bridge, nullable, live backfill | ✅ Yes | Matches design.md exactly; nullable FK, live per-ingest resolution, no migration-time backfill |
| Decision 2 — Wire `RawCapture` + real FK in PR1, transaction order Product→Offer→PriceObservation→rawCapture | ✅ Yes | Code order matches design's data-flow diagram exactly |
| `feature-branch-chain` topology (not stacked-to-main) | ✅ Yes | PR1→develop, PR2→PR1 branch, PR3→PR2 branch, confirmed via `gh pr view` base refs |
| Greenfield drop+recreate migration, no data-preserving transform | ✅ Yes | Migration SQL drops old `Product`/`PriceHistory`, recreates canonical shape; no data backfill logic present (correct — no seeded data) |
| Threat Matrix N/A (no routing/shell/subprocess changes) | ✅ Yes | Confirmed — no new process-integration surface in the diff |

### Scope Boundary Checks
| Check | Result |
|-------|--------|
| `backend/src/modules/pipeline/**` untouched | ✅ Empty diff vs `develop` |
| No cross-source/fuzzy dedup code added | ✅ `rg -ni "fuzzy\|levenshtein\|similarity\|auto-?classif"` across products module + schema → zero matches |
| `categoryId`/`brandId` genuinely unpopulated | ✅ `rg -n "categoryId\|brandId" products.service.ts` → zero matches (no assignment anywhere in the ingest path) |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ⚠️ Partial | No standalone "TDD Cycle Evidence" table in the Engram apply-progress artifact; RED/GREEN structure is instead embedded per-task directly in `tasks.md` (e.g., 2.1 "RED", 2.4 "GREEN"). Functionally equivalent, format deviation only. |
| All tasks have tests | ✅ Yes | Every code-change task (1.1-1.11, 2.1-2.9, 3.1-3.5) has a paired RED/GREEN task entry |
| RED confirmed (tests exist) | ✅ Yes | All claimed spec files exist: `products.service.spec.ts`, `products.controller.spec.ts`, `product-decimal.spec.ts`, `raw-captures.service.spec.ts`, `products.component.spec.ts`, 3 contracts DTO specs |
| GREEN confirmed (tests pass) | ✅ Yes | 81/81 contracts, 249/249 backend, 48/52 frontend (2 pre-existing unrelated failures, 2 skipped) — all independently re-run |
| Triangulation adequate | ✅ Yes | `products.service.spec.ts` has 18 distinct test cases covering create/reuse/backfill/dedup-disambiguation/mapping edge cases — well triangulated, not single-case |
| Safety Net for modified files | ✅ Yes | `domains.service.ts` (13/13 before/after per apply-progress, confirmed still 13/13 in the 249/249 full run), `pipeline` module (73/73, confirmed independently) |

**TDD Compliance**: 6/6 checks passed (1 partial on report format only, not substance)

### Assertion Quality
Scanned all 8 test files touched by this change (`product-decimal.spec.ts`, `products.controller.spec.ts`, `products.service.spec.ts`, `raw-captures.service.spec.ts`, `products.component.spec.ts`, 3 contracts DTO specs).

- Zero tautologies (`expect(true).toBe(true)` etc.)
- Zero bare `toBeInTheDocument()` smoke-only assertions
- Zero `forEach`/`for` loops over `querySelectorAll` or similar collection results (no ghost-loop risk)
- Mock/assertion ratios all well under the 2× warning threshold (max observed: `products.service.spec.ts` 14 mocks / 43 assertions)

**Assertion quality**: ✅ All assertions verify real behavior

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | ~370 | ~30 (contracts + backend service/controller specs) | Jest |
| Integration | 3 | 1 (`products.component.spec.ts`, HttpClientTestingModule) | Vitest + Angular TestBed |
| E2E | 0 | 0 | not installed (design.md's "Integration: Supertest" layer was not added as a separate suite; controller specs use Nest's TestingModule instead — functionally similar coverage, different label) |
| **Total** | **378** | **~34** | |

### Changed File Coverage
Coverage analysis skipped — no coverage tool detected in `package.json` test scripts for backend/frontend/contracts.

### Quality Metrics
**Linter**: Not run (no lint script targeted at just changed files was invoked in this pass; `nest build`/`ng build`/`tsc` all passed clean, which catches type errors)
**Type Checker**: ✅ No errors — `pnpm --filter backend build` and `pnpm --filter ./frontend build` both clean

### Issues Found

**CRITICAL**: None

**WARNING**:
1. PR2 (`feat/product-offer-split-backend`) is **750 insertions / 702 deletions = 1,452 changed lines**, exceeding both the 400-line reviewer budget and the tasks.md forecast's own estimate of "~400-550 lines, High risk." A large share is test-file rewrites (`products.service.spec.ts` +439/-, `products.controller.spec.ts` +243/-), but reviewer load is still meaningfully above what was forecast. Not blocking (chained-PR delivery was already the explicitly approved strategy for exactly this reason), but worth flagging for the human reviewer's expectations.
2. TDD Cycle Evidence is not presented as the standalone table the strict-TDD skill module expects; it is interleaved into `tasks.md` per-task instead. Content is equivalent and independently verified as accurate, but future apply runs should emit the standalone table for consistency with the verify skill's expected input shape.
3. No formal review artifacts (`reviews/transaction.json`, `ledger.json`, `receipt.json`) exist yet for this change — expected at this stage (no `review/start` has run), noted only so the orchestrator does not skip that gate before merge.

**SUGGESTION**:
1. Design's testing strategy called out a Supertest integration layer for `POST /products/ingest`; the actual test suite instead relies on NestJS `TestingModule`-based controller/service unit tests plus one live docker-compose smoke test. This is reasonable coverage in practice (verified: the live smoke test really was run and really does exercise the full HTTP→DB path), but a dedicated Supertest integration test would make this repeatable in CI rather than depending on a manual docker smoke test.

### Verdict
**PASS WITH WARNINGS** — 0 CRITICAL, 3 WARNING (none blocking), 1 SUGGESTION. All 34 tasks are genuinely complete and verifiable; all 8 requirements / 13 scenarios have real passing covering tests, independently re-executed from a fresh worktree, not copied from the apply report. The 3-PR chain (`develop`→schema→backend→frontend) is structurally correct and mergeable in order — confirmed via live `gh pr view` state and `git merge-base --is-ancestor` checks, not PR metadata alone. **Ready for review/merge: YES.** Nothing is currently merged; the retarget-gate discipline documented in tasks.md (1.13, 2.11) must still be followed by whoever performs the actual merges, per the `fix-analytics-db-wiring` precedent this change was explicitly designed to avoid repeating.
