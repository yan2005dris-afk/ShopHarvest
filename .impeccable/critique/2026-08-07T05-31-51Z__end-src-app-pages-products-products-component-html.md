---
target: product detail overlay (products.component.html)
total_score: 19
max_score: 36
na_heuristics: 10
p0_count: 2
p1_count: 1
timestamp: 2026-08-07T05-31-51Z
slug: end-src-app-pages-products-products-component-html
---
Method: dual-agent (A: general-purpose design-review sub-agent · B: general-purpose detector/evidence sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Price-history spinner exists; no top-level "opening" transition, but acceptable since data is already in memory |
| 2 | Match System / Real World | 1 | "Source" column shows a raw UUID (`offer.sourceId`), not a domain/site name — operator can't tell MercadoLibre from AliExpress |
| 3 | User Control and Freedom | 2 | Close works (backdrop/button), but no Escape-key handler, unlike `ConfirmModalComponent` |
| 4 | Consistency and Standards | 1 | Headline price bypasses `CurrencyPipe` used two rows below and in the card — "USD 19.9" vs "$19.90" in the same panel |
| 5 | Error Prevention | 3 | No destructive actions live in this surface, so little to prevent |
| 6 | Recognition Rather Than Recall | 2 | No visual link between an offers-table row and its per-offer history block below |
| 7 | Flexibility and Efficiency | 2 | No prev/next between products while the overlay is open; scored (not waived) since power users triaging many scraped products would benefit |
| 8 | Aesthetic and Minimalist Design | 2 | Offers table + chart + N unconditionally-expanded per-offer history tables compete in one panel |
| 9 | Error Recovery | 3 | Price-history fetch failure is swallowed to `console.error`; UI falls through to the same "No price history available yet." shown for a genuinely empty state — no distinguishable failure signal |
| 10 | Help and Documentation | n/a | Internal ops tool for a small technical team; no help affordance exists anywhere in this app — out of scope for this component |
| **Total** | | **19/36** | **Acceptable (53%)** |

## Design Specificity Verdict

**LLM assessment**: Structurally generic — this could be the detail modal for any catalog app. The one field that would make it unmistakably *this* product (a multi-domain scraper reconciling offers across sites) is the offer source, and it renders as a raw UUID because `OfferResponseDto` never exposes a resolved domain/site name. `domainRuleId` and `description` exist on the DTOs but are never surfaced. For a tool whose entire value is "we scrape heterogeneous sites and reconcile offers," the UI can't currently answer *which site, extracted by which rule, how fresh* without a DB lookup.

**Deterministic scan**: `detect.mjs --json` on the target returned **exit 0, `[]` — zero findings**, reproduced twice (including `--no-config` to rule out suppression). This is not evidence the overlay is clean: Angular attaches `products.component.css` via component metadata rather than a `<link>` tag, so the detector's HTML-mode scan saw *no* linked stylesheet — every contrast/color-dependent rule in its catalogue (`low-contrast`, `gray-on-color`, `ai-color-palette`, etc.) had no data to evaluate. The rules that *could* run on raw markup (heading order, nested-cards, bounce-easing, all-caps-body) came back as genuine true negatives, not false positives. Net: the empty result is a coverage gap, not a clean bill of health — treat contrast and token-pairing as unverified rather than passing.

**Visual overlays**: Not available — no browser automation tool is exposed in this session, so live injection/overlay evidence was skipped rather than fabricated (Assessment B confirmed this explicitly).

## Overall Impression

The overlay is competently built — token-consistent, animated on entry, structurally sound Angular — but it's answering the wrong question well. It reads as "here is a product's data," when this product's actual job is "here is a product, reconciled across N sources, extracted by a rule, with a price history per source." The two P0s (unreadable source UUID, dead product-title route) mean the overlay currently can't do its core job for an operator who hasn't memorized UUIDs, and the missing a11y wiring means the "same modal pattern as ConfirmModalComponent" comment in the code is aspirational, not actual — a good instinct was declared but not implemented.

## What's Working

1. **Skeleton-to-content continuity**: the loading skeleton grid deliberately mirrors the real card layout so nothing shifts when data lands — genuinely well-considered for a list-heavy operate surface.
2. **Offer-level price-history grouping**: grouping observations by `offer.id` instead of flattening across sources is the structurally correct IA call for a multi-source product model, even though the current presentation is too heavy.
3. **Click-target discipline inside the card**: `stopPropagation()` on the nested title link shows real awareness that nested interactive targets need isolation — the instinct is right even though the route it guards is currently dead (see P0).

## Priority Issues

**[P0] Offer "Source" shows a raw UUID instead of a site name**
- **Why it matters**: this is the one field an operator needs to distinguish which scraped site an offer came from. Right now it's unusable without a manual database lookup — undermines the product's core value proposition (heuristic 2, and the design-specificity verdict above).
- **Fix**: add a resolved `sourceName`/domain field to `OfferResponseDto` on the backend and render that instead of the raw FK, both in the overlay's offers table and in `product-card.component.ts`.
- **Suggested command**: `/impeccable harden`

**[P0] Product-title link routes to a path that doesn't exist**
- **Why it matters**: `product-card.component.ts` links to `/products/:id`, but `app.routes.ts` never registers that child route — a dead link sitting right next to the card's own click-to-open handler, on a `stopPropagation`-guarded target that clearly intended to go somewhere.
- **Fix**: either register `/products/:id` or remove the dead `routerLink` so the card's click handler is the only entry point.
- **Suggested command**: `/impeccable harden`

**[P1] Overlay lacks the a11y wiring the code comment claims it inherits**
- **Why it matters**: the template comment says "same modal pattern as ConfirmModalComponent," but the overlay has no `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, or Escape handler — all present in `ConfirmModalComponent`. Screen-reader users get no dialog semantics; keyboard users can tab straight through to the obscured page and can't Escape to close.
- **Fix**: add `role="dialog"`, `aria-modal="true"`, `[attr.aria-labelledby]` on the h2, an Escape-key host listener, and initial-focus/focus-return, matching `ConfirmModalComponent`'s existing pattern.
- **Suggested command**: `/impeccable harden`

**[P2] Headline price bypasses the `CurrencyPipe` used everywhere else**
- **Why it matters**: the same product can show "USD 19.9" as the headline price and "$19.90" three rows below in the same panel — visible formatting inconsistency, and unlocalized for non-USD currencies (no symbol, no grouping separators).
- **Fix**: apply the same `currency` pipe expression used two rows below to the headline price.
- **Suggested command**: `/impeccable clarify`

**[P3] No progressive disclosure for multi-offer products**
- **Why it matters**: a product tracked across 5+ sources renders 5 unconditionally-expanded per-offer history tables stacked in the sidebar — violates chunking and progressive-disclosure, and is exactly the "many dynamic offers" case this product needs to handle gracefully.
- **Fix**: collapse per-offer history behind an accordion, default-collapsed beyond the first 1-2 offers.
- **Suggested command**: `/impeccable optimize` (or `/impeccable distill`)

## Persona Red Flags

**Sam (Accessibility-Dependent)**: No `role="dialog"`/`aria-modal` — a screen reader announces this as undifferentiated page content, not a modal. The product image has `alt=""` (empty) in the overlay specifically, while the same image correctly uses `[alt]="title()"` in the card. The price-history `<canvas>` chart has zero `aria-label`/`role="img"`/fallback text. No focus trap, no Escape handler — keyboard-only users can tab out into the obscured page behind the "modal."

**Casey (Mobile)**: Zero responsive breakpoint classes anywhere in this template (`sm:`/`md:`/`lg:`/`xl:` — none found). The two-column layout (flex-1 content + a `w-75 min-w-[300px]` sidebar) inside `p-8` backdrop padding has no stacking fallback for a ~375px viewport; it will overflow or crush both columns.

**Alex (Power User)**: No keyboard shortcut or arrow-key navigation between products while the overlay is open — must close and re-click a different card each time, with the overlay state fully resetting on each open. Raw UUID source labels (P0 above) hit this persona hardest, since they're the ones cross-referencing sources most often.

## Minor Observations

- Offers-table column header reads "URL" but the cell content is "Visit Link ↗", not a URL — label/content mismatch.
- Clicking the same product card twice toggles the overlay closed, with no visual "active" affordance beyond a border/ring on the card — undocumented behavior.
- If a selected product's `offers` array is empty, the primary-offer/price block silently disappears with no "no offer data" message, and the offers table renders header-only with zero body rows — reads as a bug, not an empty state.

## Questions to Consider

- Given `sourceId` has no resolvable display name anywhere in the current contracts, was source-name resolution ever wired up, or has this overlay been effectively unusable in production for anyone without the source UUIDs memorized?
- `rawData` is referenced in a DTO comment as having "moved to OfferResponseDto" during a refactor, but isn't actually exposed there — was surfacing raw scraped fields to the operator deliberately descoped, or dropped by accident?
- The entrance has a deliberately crafted slide-up + fade; the exit is instant. Was an exit animation cut for time, or does the `@if`-based unmount need an Angular animations trigger to fix properly?
