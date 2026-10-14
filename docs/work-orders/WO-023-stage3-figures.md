# WO-023: High School (Stage 3) figures + the new Middle School modes

**Owner:** Builder · **Review:** Architect visual check · **Target:** max velocity (Brian, Oct 14: finish all 3 products, then the Shopify legal and landing page). Spec sources: ADR-004 (Stage 2/3 status), `tools/stage3.py` (each type's fields, text, steps and checks).

Both Passes are complete in content. `koukou_juken` 8 lessons and `daigaku_juken` 8 lessons, all validator-verified, with a masterclass per lesson. The cards below currently play as **walkthroughs without a figure** (`isPlayable` is false for their types), so everything works but nothing is drawn. This WO draws them. Reach everything with `?preview=1`.

## 0. Variant answers (one line, do first)
Stage 3 answers can be `8*sqrt(2)`, `15*pi` or `(2, -1)`. The bundle now gives every Stage 3 variant a `display_ja` (「8√2cm」, 「15πcm²」, 「(2, −1)」). In `withVariant` (packages/scenes/src/variant.ts), keep it: `answer: { value: variant.answer, expr, ...(variant.display_ja ? { display_ja: variant.display_ja } : {}) }`, and add `display_ja?: string` to `Variant`.

## 1. Middle School modes (static figures, walkthrough keyframes)
| figure | draw |
|---|---|
| `coord_polygon` with `shape: axis_diagonal` | the existing coordinate polygon, plus the diagonal on the y-axis drawn bold (keyframe `show_answer` shades the two triangles in two tints) |
| `coord_y_split` | axes; A, B and line AB (or O and A with `origin: true`); P on the y-axis at the answer; Q = AB ∩ y-axis; △ABP split by the y-axis |
| `coord_quad_tri` | axes; quadrilateral ABCD; diagonal DB; the parallel through C to the x-axis at E; △AED shaded. Keyframes `draw_parallel`, `slide_vertex` as in the Slide scene. **Drag scene:** C slides along the parallel and snaps at the x-axis (same gesture as `coord_equal_area`) |
| `box_unfold` with `ask: length` | the existing two-face net; the straight A–G is the answer; label its length from the last step instead of marking BP. Then flip `kj-unfold-005` to `status: verified` in the same PR (Architect-owned card, one-line change allowed) |

## 2. High School types (`tools/stage3.py`)
Each type: a static figure for walkthroughs and the book, every keyframe listed on its cards, both themes. **No-math rule unchanged:** positions may be computed from the figure fields; every printed number comes from the text, the figure fields or the lens steps.

| type | fields | draw | drag scene (standard cards) |
|---|---|---|---|
| `parabola_area` (囲む) | `f`, `g` = [a, b, c] for y = ax² + bx + c (`g` omitted = x-axis); `bounds` [p, q] on failure / no-lens | axes, both graphs, crossings α, β marked on the x-axis, the region shaded (`show_graph` → `mark_crossings` → `shade_region` → `show_answer`) | drag a vertical "fence" pair onto the two crossings; they snap at α and β, then the region fills |
| `parabola_tri` (等積変形) | `a` (number or "1/2"), `alpha`, `beta`, `ask` (px, max_area, equal_o, range_max, oab), `range` | y = ax², A, B, chord AB; P; for `equal_o` also O and the parallel through O | drag a line kept parallel to AB; it snaps where it touches the parabola (x = (α+β)/2), or for `equal_o` through O |
| `line_mirror` (折り返す) | `line` [m, k] for y = mx + k, `A`, `B`, `ask` (p_x, min_len, max_diff), `side` | ℓ, A, B; then B′, A–B′, P | drag B across ℓ; it snaps at B′ (reflection), then tap to draw A–B′ (as the coordinate Mirror scene, mirror line slanted) |
| `param_family` (止める) | `family` line/parabola, `c` (coefficients linear in a: [[p, q], …]), `ask` (point, a_for_point, slope_at) | three or four members of the family for a = −2…2, the fixed point marked | a slider for a that the child **taps to freeze**: the graph stops, the two brackets light up, the fixed point appears (same tap-to-freeze idea as 止める in Stage 1) |
| `cone_unfold` (展開) | `r`, `l`, `ask` (loop, to_point, side_area), `d`, `expect: through_apex` | the cone (2D sketch is fine), then the opened sector with its angle 360r/l, A and A′ (or B′ at OB′ = d), the chord | drag the cone's side open into the sector, then draw the straight line. For `through_apex` the chord is drawn outside the sector (dashed) and the path through O is shown |
| `dice_grid` (面積図) | `dice` (2, or 3 on the failure card), `cond` {op, k} (sum_le, sum_eq, diff_ge, prod_le, prod_mult, both_even, both_le, both_ge, even_le) | a 6×6 table, big die across, small die down; matching cells shaded; the count from the steps | drag across the table to paint the region; it snaps when the painted cells equal the condition |
| `const_sum` (差一定) | `p`, `q`, `s`, `ask` (max_product, min_squares, given_diff), `shift` [u, v], `x_min`, `d` | a bar of fixed length s split at x (or px and qy); the rectangle x × y (area = product) or two squares (sum of squares) | drag the split point; the area readout grows towards the centre and snaps there (or at `x_min` on the failure card, drawn as a wall) |

Also: the word-problem kind `avg_speed` (dj-balance-f01) is `steps_only`: no figure needed.

When a type is drawn, add it to `SCENE_FIGURE_TYPES` and to the playable set, and drop the scoping in the tests (`word.test.ts`, `course.test.ts` WO-020 block, `unfold.test.tsx` length filter).

## 3. Tests
- Every Stage 2/3 card and variant renders every keyframe at t = 0, 0.5, 1 in both themes, with no warnings.
- Snap tests: each drag scene snaps at the answer and nowhere else (as the Stage 1 snap tests).
- Book: `daigaku_juken` draws every figure (no 「図（準備中）」), the no-math check passes.

## Done when
- `/lesson/koukou_juken/{enclose,slide,unfold}?preview=1` and every `/lesson/daigaku_juken/<lens>?preview=1` play every card with a figure on iPad 1180×820 and phone 390×844, with no console errors.
- Each `daigaku_juken` masterclass plays its example 1 as a drag scene.
