# WO-015 — Word-problem diagram families (面積図 · 差一定 first)

**Owner:** Builder · **Architect:** reviews with a visual check · **Target:** Oct 16 (before course-player freeze Oct 23)

## Why
Word problems now come in more story types than renderers. From bundle 1.3 on, every `word_problem` figure carries
`figure.diagram`. It holds a **family**, plus the numbers that family draws. Each variant's `figure` carries its own `diagram` too.
Render by family, not by `kind`, so new story types are data-only from now on.

Sizes may come from `diagram`. Printed numbers still come only from the lens steps (`afterEquals` etc.), as today.

| family | kinds today | fields | picture |
|---|---|---|---|
| `area_two_rect` | `two_kinds_total` (coins; `names.template: count` for wheels) | n, a, b, t, x | existing AreaDiagram / Area scene |
| `area_average` | `average_groups` | w1, h1, h2, level, w2 | two rectangles (width = people, height = average); dashed line at `level`; the part of rect 1 above the line and the dent of rect 2 below it have equal area |
| `area_shortfall` | `shortfall` | a, b, s, d, n | two rectangles on the same width n (heights a and b); the strip between them = surplus `s` + shortfall `d` |
| `diff_bars` | `age_ratio`, `age_ratio_past`, `same_spend` | big, small, r, dir (+1 forward, −1 back/spend), shift | existing age bars; with `dir: −1` the bars **shrink** by `shift`, and the difference segment stays the same length |
| `lever` | `mixture` | w1, p1, p2, pt, w2 | existing |
| `road` | `meeting` | d, u, v, t | existing |

## Tasks
1. `packages/scenes`:
   - add `diagram` to `WordProblemFigure` (a discriminated union by `family`);
   - make `DIAGRAMS` keyed by family;
   - make `WORD_CAPTIONS` keyed by family. The new keyframes, with the lens step each one captions:
     - `area_average`: `draw_rectangles`→0, `draw_average_line`→1, `show_excess`→1, `fill_dent`→2, `divide_dent`→3;
     - `area_shortfall`: `draw_plan_a`→0, `draw_plan_b`→0, `show_gap`→1, `divide_gap`→2;
     - `diff_bars`: `shrink_bars`→0, `draw_money_bars`→0 (in addition to the existing age keys).
2. Units: use `names.unit` when present (wheels: 本) and `yen` for 金額/`same_spend`. The tick labels 4 and 2 on area-002 should read 4本 and 2本.
3. `apps/trainer/src/course/lessons.ts`:
   - `PLAYABLE.area` = family starts with `area_`;
   - `PLAYABLE.constant` = family `diff_bars`.

   Tactile interactions:
   - **area_average:** drag the dashed level line; it snaps at `level` when the two shaded areas match (count cells, as with Enclose).
   - **area_shortfall:** drag plan B's top edge up from plan A; the gap strip fills cell by cell.
   - **diff_bars dir −1:** drag both bars down together; the difference bracket stays locked.
4. Tests: render every keyframe of every word card and variant, both themes (the existing data-driven test now picks up the new kinds automatically once the kind filter becomes "any word_problem").

## Cards now in the bundle (all `verified`, 4 variants each)
- area-002 (wheels, L1);
- area-003 (two-class average, L3);
- area-004 (過不足, L2);
- constant-002 (何年前, L2);
- constant-003 (siblings spending the same, L3).

Until this WO merges, `isPlayable` keeps the new kinds out of lessons and the check. Nothing breaks.

## Done when
- `/lesson/chugaku_juken/area?preview=1` and `/lesson/chugaku_juken/constant?preview=1` play every card.
- Headless iPad and phone runs show no console errors.
- The Architect visual check passes.
