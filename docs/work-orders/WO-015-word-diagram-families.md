# WO-015: Word-problem diagram families (面積図 · 差一定 new kinds playable)

**Owner:** Builder · **Review:** Architect visual check, then merge · **Target:** Oct 16 (well before the Oct 23 course-player freeze)
**Branch:** `builder/wo-015-diagram-families` · One PR.

## 0. Why
`main` has four new word-problem kinds (area-003, area-004, constant-002, constant-003 plus 4 variants each). `isPlayable` hides them today because no scene can draw them.

From bundle 1.3, every `word_problem` figure carries `figure.diagram`, and so does each variant's `figure`. `figure.diagram` says *which picture to draw* (`family`) and gives the numbers that size it. Render by **family, not by kind**. After this WO, a new story type with an existing family needs no app code.

The no-math rule is unchanged:
- `diagram` numbers may size and snap shapes.
- Every number that is *printed* comes from the card text, `params`, the lens steps (`afterEquals` / `allAfterEquals`), or a count the child sets by dragging.
- No product or sum is ever computed on screen.

## 1. The families (`figure.diagram`)

| family | kinds | fields | status |
|---|---|---|---|
| `area_two_rect` | `two_kinds_total` | unit, n, a, b, t, x | existing Area scene; **use `unit` for tick labels** (area-002: 4本 / 2本; coins: 円) |
| `area_average` | `average_groups` | w1, h1, h2, level, w2 | **new** |
| `area_shortfall` | `shortfall` | a, b, s, d, n | **new** |
| `diff_bars` | `age_ratio` (dir 1), `age_ratio_past` (dir −1), `same_spend` (dir −1) | measure (`age`/`yen`), step (1 / 100), big, small, r, dir, shift | existing Constant scene + **dir −1 mode** |
| `lever` | `mixture` | w1, p1, p2, pt, w2 | existing, no change |
| `road` | `meeting` | d, u, v, t | existing, no change |

`x`, `w2`, `n` and `shift` are the answer, as a string. Use them only for the snap target, never print them.

## 2. Code changes
1. **`packages/scenes`:**
   - `types.ts`: `WordProblemFigure.diagram` is a discriminated union on `family` (fields above). Add `average_groups | shortfall | age_ratio_past | same_spend` to `kind`.
   - `WordDiagram.tsx`: `DIAGRAMS` keyed by `diagram.family`.
   - `wordProblem.ts`: `WORD_CAPTIONS` keyed by family. Keep the existing entries and add:
     - `area_average`: `draw_rectangles`→0, `draw_average_line`→1, `show_excess`→1, `fill_dent`→2, `divide_dent`→3
     - `area_shortfall`: `draw_plan_a`→0, `draw_plan_b`→0, `show_gap`→1, `divide_gap`→2
     - `diff_bars`: add `shrink_bars`→0, `draw_money_bars`→0
   - Units: the `area_two_rect` ticks read `{a}{unit}` / `{b}{unit}`. For `diff_bars`, `measure: yen` uses 円 and `age` uses 才.
2. **`apps/trainer/src/course/lessons.ts`:**
   - `PLAYABLE.area = family ∈ {area_two_rect, area_average, area_shortfall}`
   - `PLAYABLE.constant = family === 'diff_bars'`
   - The `/check` pool picks the new level-1/2 cards up automatically (area-002, area-004, constant-002).
3. **Scenes:** route by family inside `Area.tsx` / `Constant.tsx`, or add `AreaAverage.tsx` and `AreaShortfall.tsx` to `scenes/index.ts`. Your call; keep `kit.tsx` primitives.

## 3. Tactile interactions (tokens 1.6 `motion.tactile`: snap k420/c16, settle 260/22, idle 5000 ms ghost finger, halo, aha stagger)

### A. `area_average` (area-003: 1組30人 平均74点 / 2組? 人 平均62点 / 全体70点)
- **Layout:**
  - Rect 1: width w1, height h1, lens colour.
  - Rect 2 sits to its right: height h2, start width = half of rect 1, pink.
  - Width labels: 「{w1}人」 and 「?人」.
  - The y axis shows only the band from h2−4 to h1+4, so small differences stay visible.
- **Phase 1, the line:**
  - A dashed horizontal line starts at the top of rect 1. The child drags it down.
  - It snaps at `level`, with label 「全体の平均 {level}点」 from params.
  - On snap, the part of rect 1 above the line fills with stripes, one column per person, and shows 「はみ出し {v}」. `v` = last `afterEquals(steps[1])` (= 120).
- **Phase 2, the width:**
  - A white ● sits on rect 2's right edge. Dragging it right adds one person-column at a time.
  - The dent between h2 and the line fills one column at a time, as stripes in the same rhythm as the excess.
  - Readout: 「{k}人」 (the child's count only).
  - At k = w2 the dent and the excess hold the same number of stripe columns-worth. The ● snaps, both regions halo, and the aha sequence plays.
  - The steps[3] text appears as the caption.
  - Overshooting is allowed. The dent then visibly exceeds the excess (outline turns red), with no number shown.
- **Guide copy (`ja.ts`):**
  - `guide.area.avgLine`: 「点線をつかんで、全体の平均 {level}点 まで下げよう」
  - `guide.area.avgExcess`: 「はみ出し {v}」
  - `guide.area.avgWidth`: 「右の ● を動かして、へこみをはみ出しと同じ広さにしよう」
  - `guide.area.avgRetry`: 「へこみがはみ出しより大きいよ。少しもどそう」

### B. `area_shortfall` (area-004: 4個ずつ→11個あまり / 7個ずつ→10個たりない)
- **Layout:**
  - One rectangle, width = ? people (start at 3 columns), height a (plan A).
  - Beside it, a small stack of `s` dots labelled 「あまり {s}個」.
  - A dashed outline at height b labelled 「1人{b}個ずつ」, with `d` hollow dots 「たりない {d}個」.
- **Phase 1, raise:**
  - The child drags the rectangle's top edge up from a toward b. It snaps at b.
  - The strip between a and b turns into stripes. Show the steps[1] text: 「あまり{s}個＋たりない{d}個＝{v}」, with `v` from `afterEquals(steps[1])`.
- **Phase 2, width:**
  - A ● on the right edge. Each column added shows a (b−a)-tall stripe column. Readout 「{k}人」.
  - Snap at k = n: the solid and hollow dots fly into the strip (aha), and the steps[3] caption appears.
- **Guide copy:**
  - `guide.area.sfRaise`: 「上の辺を引き上げて、1人{b}個ずつにしよう」
  - `guide.area.sfWidth`: 「● を右へ。すき間の長方形が、あまりと不足を合わせた数になる人数は？」
  - `guide.area.sfRetry`: 「すき間が大きすぎるよ。人数を少しへらそう」

### C. `diff_bars` with `dir: -1` (constant-002 何年前; constant-003 同じ金額を使う)
- Same bars as the current Constant scene, with the difference bracket 「差 {diff}（ずっと同じ）」 from steps[0].
- **Drag:** the ● moves **left**. Both bars shrink together by `k × step`, and the bracket stays locked in length.
  - Readout: 「{k}年前」 (age) or 「{k×step}円 使った」 (yen). This is the child's count × a fixed step, the same rule as the years readout today. Brian approved on-screen counts.
- **Snap:** at k × step = shift, r copies of the smaller bar overlay the bigger one exactly. Halo, aha, and the steps[3] caption.
- **Guide copy:**
  - `guide.constant.back`: 「● を左へ。2人とも同じだけ年が少なくなる」
  - `guide.constant.spend`: 「● を左へ。2人とも同じ金額を使う」
  - `guide.constant.retry` is reused (it already reads {younger}の{r}つ分…).

### Common
- **First interaction:** a ghost finger (1500 ms × 2) shows the first drag. After 5 s idle, the halo pulses on the handle.
- The mascot bubble shows the current guide line.
- Phone 390×844: the figure scales to fit, and the handles keep a ≥ 44 px hit area.

## 4. Tests
- `word.test.tsx`: change the kind filter to "any `word_problem`". The existing data-driven render test then covers every new card and variant, every keyframe, both themes.
- Trainer: `isPlayable` is true for all 7 area/constant anchors. `lessonProblems(area)` returns 5 with `lesson_target` 5.
- One test per new interaction (pure helper): the snap happens at the bundle answer and nowhere else.

## 5. Also in this PR (small)
- `launch/copy.ts`: the includes line and the delivery line from the issue #43 comment (Architect, Oct 13).
- **Do not touch `launch.config.ts`.** Founder set `siteUrl = https://domo-ai.com` in #59.

## Done when
- `/lesson/chugaku_juken/area?preview=1` and `/lesson/chugaku_juken/constant?preview=1` play every card and variant to the aha on iPad 1180×820 and phone 390×844, with no console errors.
- `pnpm bundle`, `check:literals`, `typecheck`, `build` and `test` are all green.
- The Architect visual check passes, then merge.
