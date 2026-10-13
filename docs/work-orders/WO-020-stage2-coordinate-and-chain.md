# WO-020: Stage 2/3 figures + the chained-lens runner

**Owner:** Builder · **Review:** Architect visual check · **Target:** Oct 25. This comes **after** WO-014 and must not slow the Stage 1 Oct 23 freeze. Spec sources: ADR-003 §2 (runner contract) and ADR-004 (curriculum).

Both Stage 2 and 3 stay waitlist-only: `CaseView` already shows 準備中 to the public for `status: planned` Passes (Architect, #80). Everything here is reached with `?preview=1`.

## 1. Static figures (`packages/scenes`), so walkthroughs and Shorts can draw them
| figure type | draw |
|---|---|
| `coord_polygon` | coordinate grid with **x/y axes through the origin**, tick numbers every 1 (labels every 2 when cramped), lattice polygon, vertex labels with coordinates 「A(−2, 0)」 |
| `coord_equal_area` | axes; A, B, C; segment AB; △ABC shaded. Keyframes: the parallel line through C → its y-axis crossing P → △ABP shaded |
| `coord_mirror_area` | axes with the x-axis as the mirror; A, B; then B', line A–B', P; then the enclose box and corners on △ABP |
| `triangle_cevians` | △ABC (fixed nice shape), D on BC and E on CA at their ratios, AD and BE, P. Ratio labels on the sides. Keyframes: weights at B, C → weights at C, A (scaled to the same C) → weight at D → AP:PD |

**No-math rule (unchanged):** positions may be computed from the figure numbers, but every printed number comes from the text, the figure fields or the lens steps.

## 2. Drag scenes (course player)
- **`coord_polygon` → the Enclose scene on the coordinate grid.** Box snapping and corner-triangle counting work as today. Corner legs show coordinate differences. The validator already annotates the steps with `detail`, as for `grid_polygon`.
- **`coord_equal_area` → a Slide scene variant.** The child drags C's copy along the parallel line, which snaps at the y-axis to P. It is the same "slide along a parallel line" gesture as the band.
- **`coord_mirror_area` → chained** (§3).
- **`triangle_cevians`:** walkthrough for now (tap-to-reveal weights). A tactile mass-point balance comes later.

## 3. The chain runner (ADR-003 contract)
- A lesson problem with `chain` plays in `mode: 'chain'`. The picker asks for the **first** lens only (`chain[0].lens`).
- Stage k runs the scene for `chain[k].lens` on the **same figure**:
  - it captions only `lens_route.steps[chain[k].steps[0] .. chain[k].steps[1]]`, through a `stageSteps(card, k)` helper;
  - it calls `onSolved` at its snap.
- **Between stages:** a short halo on what the snap revealed (P), the `goal_ja` line in the mascot bubble, and the next stage's lens chip lighting up.
- **For `coord_mirror_area`:**
  - **Stage 1 (折り返す):** drag B across the x-axis; it snaps to B'. Then tap to draw A–B'; P appears with its coordinate from step 1.
  - **Stage 2 (囲む):** the Enclose interaction on △ABP, with the box and corners taken from the steps' `detail`.
- **Existing scenes:** move absolute `steps[i]` reads behind `stageSteps(card, null)` (the whole route). That is the only change ADR-003 asks of them.

## 4. Tests
- Every Stage 2/3 card and variant renders every keyframe in both themes.
- **Chain:** the picker accepts only `chain[0].lens`; stage 1 snaps → stage 2 unlocks → stage 2 snaps → solved. Each stage shows only its own captions.
- Stage 1 lessons are unchanged (regression).

## Done when
- `/lesson/koukou_juken/{enclose,slide,mirror}?preview=1` and `/lesson/daigaku_juken/balance?preview=1` play every card on iPad 1180×820 and phone 390×844, with no console errors.
- Without preview, `/pass/koukou_juken` and `/pass/daigaku_juken` still show 準備中.
- CI is green and the Architect visual check passes.
