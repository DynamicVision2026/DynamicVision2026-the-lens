# Builder work orders

Each work order (WO) is one PR. Read `docs/PRD.md` first; this folder only adds what to build next and how it is accepted.

**Product plan (Brian, Oct 13):** three Passes on one engine, Stage 1 中学受験 first; see [ADR-001](../architecture/ADR-001-multi-pass.md). Next WO: [WO-010](WO-010-lessons-and-catalog.md).

**Production schedule (Brian, Oct 13: full production, compressed):**

| Date | Delivery |
| --- | --- |
| Oct 14 | Enclose interactive Masterclass prototype (Architect) for pacing review |
| **Oct 23** | **WO-012:** course player with all 8 guided-discovery interactions (2D + 3D Unfold), ナゼホリ guide, countable grid |
| **Oct 27–28** | **WO-013** 「どのレンズ？」 free 8-question check + landing/preorder live (WO-009/010 copy), capturing the 30 founder families |
| Nov 4 | Masterclass template for all 8 lenses; drill + timer check (Steps 3–4) |
| Mid-Nov | Founder early access: full 4-week sprint playable; problems toward ~80 (Architect, in parallel) |
| Late Nov | Parent dashboard, 4-week guide and parent manual; Round 1 outside review |

Earlier build order (now done): WO-003 step 2 → WO-009 → WO-004 … WO-008.

| WO | Title | Depends on | Target |
| --- | --- | --- | --- |
| [WO-001](WO-001-monorepo-scaffold.md) | Monorepo and directory scaffolding | PR #1 merged (bundle) | Oct 16 |
| [WO-002](WO-002-scenes-and-tokens.md) | Shared SVG scene components reading tokens | WO-001 | Oct 20 |
| [WO-003](WO-003-enclose-prototype.md) | Enclose prototype: 30 s Short + Perspective Picker. **Start with the [motion preview](WO-003-motion.md).** | WO-002 | Preview first, then Oct 21 demo |
| [WO-009](WO-009-launch-site.md) | **Launch site:** landing page → Free Lens → email signup → ¥6,800 preorder. **Next after WO-003 step 2** | WO-003 step 2 | Oct 27 |
| [WO-010](WO-010-lessons-and-catalog.md) | Lessons and catalog: bundle 1.3 `passes`, `/pass/:passId`, `/lesson/:passId/:lens`, Masterclass copy | WO-009 | Oct 20 |
| [WO-011](WO-011-lesson-video.md) | Lesson video template (3–5 min per lens) | WO-010 | Oct 27 |
| [WO-012](WO-012-tactile-and-3d.md) | Tactile drag + lazy 3D viewport (Unfold first), native-shell readiness | WO-010 | Spike Nov 10 |
| [WO-013](WO-013-which-lens-check.md) | 「どのレンズ？」 free 8-question check + week-4 mixed drill | WO-012 core | Oct 27 |
| [WO-014](WO-014-micro-masterclass.md) | Masterclass (Step 1): 5-min core + 1-min practice onboarding (360 s, tokens 1.8), one data-driven player for 8 lenses; Step 3 as a 5-problem round | WO-016, catalog masterclass.yaml | Oct 21 |
| [WO-015](WO-015-word-diagram-families.md) | Word-problem diagram families (面積図 · 差一定 new kinds playable) | bundle 1.3 `figure.diagram` | Oct 16 |
| [WO-016](WO-016-boundary-cards-walkthrough.md) | Failure + no-lens cards in lessons; walkthrough mode for cards without a drag scene | WO-012 core | Oct 18 |
| [WO-017](WO-017-balance-freeze-extensions.md) | てんびん water/salt lever + 止める chase mode; balance/freeze lessons playable | WO-015, WO-016 | Oct 19 |
| [WO-018](WO-018-geometry-boundary-figures.md) | Geometry boundary + L4 figure extensions (等積変形 · 折り返す · 展開) | WO-016 | Oct 20 |
| [WO-019](WO-019-decision-speed-log.md) | Decision-speed log (all modes) + Day-1 vs Week-4 parent report | WO-013, WO-016 | Oct 21 |
| [WO-020](WO-020-stage2-coordinate-and-chain.md) | Stage 2/3 figures (coordinate plane, cevians) + chained-lens runner (ADR-003/004) | WO-014 | Oct 25 |
| [WO-021](WO-021-paperback-books.md) | **Builder B:** paperback workbooks per SKU (KDP, B5, B&W) built from `passes[].book`; Amazon link in the trainer | none (parallel to Builder A) | no date: max velocity |
| [WO-022](WO-022-onboarding-and-voice.md) | Guaranteed ghost finger (≤ 3 s) + 5 s idle pulse in every masterclass beat; mascot voice playback + mute | WO-014 | max velocity |
| [WO-023](WO-023-stage3-figures.md) | High School figures (放物線の面積, 等積変形, 対称点, 定点, 円すい, さいころの表, 和一定) + the new Middle School modes; variant `display_ja` | WO-020 | max velocity |
| [WO-024](WO-024-lens-landing-access-deploy.md) | 視点レンズ landing page (ナゼホリ standard), per-Pass access links, own Cloud Run service at lens.domo-ai.com; strict isolation from ナゼホリ | WO-023 | **Fri Oct 16** |
| [WO-025](WO-025-lens-analytics.md) | GA4 operations data (off until `ga4Id` is set), order number on `/open`, 外部送信 page | WO-024 | done |
| [WO-026](WO-026-kdp-books-all-skus.md) | KDP books for all 3 SKUs, upload-ready: Stage 2/3 print figures, per-book spine, listing sheets, trainer Amazon link | WO-021 | Oct 16 |
| [WO-027](WO-027-book-reader-access.md) | Book QR (`?src=book`) opens that lens's masterclass free; book visits measured | WO-024, WO-025 | before books go on sale |
| [WO-028](WO-028-youtube-shorts.md) | 「どのレンズ？」 YouTube Shorts: any-card template, 3 for review, then 24 + trailer + book-QR demo | WO-003 | review set Oct 20 |
| [WO-004](WO-004-slide-scenes.md) | Slide lens (等積変形): parallel-band figure and its scenes | WO-003 step 2 | Oct 27 |
| [WO-005](WO-005-mirror-scenes.md) | Mirror lens (折り返す): shortest-path figure and its scenes | WO-004 | Oct 30 |
| [WO-006](WO-006-word-problem-scenes.md) | Area (面積図) and Constant (差一定): word-problem diagrams | WO-004 | Nov 2 |
| [WO-007](WO-007-balance-freeze-scenes.md) | Balance (てんびん) and Freeze (止める): lever and road diagrams | WO-006 | Nov 4 |
| [WO-008](WO-008-unfold-scenes.md) | Unfold (展開): cuboid and net figure | WO-005 | Nov 6 |

## Rules for every WO

1. **One PR per WO**, branch `builder/wo-00N-short-name`, title starting `WO-00N:`. Small follow-up PRs are fine; never mix two WOs in one PR.
2. **Architect-owned paths:** `cards/`, `catalog/`, `labels/`, `schema/`, `tools/`, `tokens/`. Do not edit them. If you need a field, a token or a bundle change, open an issue labelled `architect` and keep going with a clearly marked stub.
3. **The bundle is the only data source.** Apps import `build/bundle.json` (contract: `docs/PRD.md` §5). Never read YAML in the apps, never hard-code a card's numbers or Japanese text, never re-compute an answer.
4. **Tokens are the only style source.** No hex colours, font names or stroke widths in components; read them from `tokens/tokens.json`.
5. **Merge rule:** the founder approves, the **Architect merges** (Brian, Oct 12; before that the Builder merged). Merge a PR only when all three hold:
   - every check is green (**validate** and **apps**);
   - for app work, the Architect has posted a **visual check** on the PR (the Architect runs the build headless and sends the founder screenshots; AI sessions can't upload video, so no screen recording is required);
   - the founder has approved it.

   The founder approves verbally to the Architect or Coordinator, who records it as a PR comment starting **"✅ Approved by Brian"**. That comment is the approval; no GitHub review button is needed. PRs touching `cards/`, `schema/`, `tools/` or `tokens/` also need the Architect's sign-off.

   **Standing approval (Brian, Oct 12):** for WO-003 step 2 through WO-009, the founder has approved in advance. The Architect merges as soon as both checks are green and the visual check says **Pass**; no per-PR approval comment is needed. The Builder does not wait for the merge: start the next WO from the PR branch or `main`, whichever is current. A visual check that requests changes blocks the merge. Brian reviews milestone drops and can stop any PR by saying so. Then start the next WO straight away.

   Use **Squash and merge**, except for a stack of PRs built on each other: merge those with **Create a merge commit**, bottom first, so the ones above don't conflict. Leave the merged branch in place: AI sessions can't delete branches, and leftover branches are harmless. If the PR shows a conflict, update the branch from `main`, wait for the checks to go green again, then merge.
6. **Keep it small.** No state libraries, no UI kits, no backend. React state, plain SVG, Vite, Remotion. Ask before adding any dependency not named in a WO. Approved so far: Vitest 4 (dev-only test runner, Node 20 compatible).

## Glossary

- **Card**: one problem (`cards/**/*.yaml`), shipped inside the bundle.
- **Variant**: a generated sibling of a card with new numbers and its own `lens_route.steps`.
- **Keyframe**: a named animation stage in `card.animation.keyframes` (for example `draw_box`).
- **Lens route / trap route**: the insight solution and the brute-force attempt, as ordered steps.
