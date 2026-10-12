# WO-005 · Mirror lens (折り返す) scenes: the shortest-path figure

**Owner:** Builder · **Reviewer:** Product Architect · **Target:** Oct 30 · **Depends on:** WO-004 merged

## Goal

`mirror-001` plays in the trainer and renders as a study-pace Short, with the same `LensScene`, themes, step palette and beat engine as Enclose and Slide.

## The card in one picture

A straight river (line ℓ, horizontal). P and Q sit on the same side. A and B are the feet of the perpendiculars from P and Q: PA = 4 m, QB = 8 m, AB = 12 m (`figure.pa`, `qb`, `ab`). Walk from P to Q, touching the river once at X. Where is X for the shortest walk? **AX = 4 m.**

- **Trap:** go halfway (AX = 6). That's only right when PA = QB, and the validator guarantees it never is.
- **Lens:** reflect Q across the river to Q′. The straight line P→Q′ crosses the river at X. Triangles PAX and Q′BX are the same shape, so AX : XB = 4 : 8 = 1 : 2, and AX = 12 × 1/3 = 4.

## Getting the card

`mirror-001` is `status: draft` until this WO merges, the same as `slide-001` was. Build a local bundle with:

    bash -O globstar -c 'python3 tools/validate.py cards/**/*.yaml --bundle --include-drafts'

## Scope

**New figure renderer** `mirror_path` in `packages/scenes`:
- The river as a wide band or line at the bottom third, with points P, Q, A, B and (later) X and Q′ labelled from `figure.point_labels`.
- Perpendicular drops PA and QB as dashed construction lines, with their lengths printed from `figure.pa` / `figure.qb`; AB from `figure.ab`.
- Drawing positions may be derived from these numbers (that's geometry for drawing). **Printed numbers come only from the figure fields and the step values.** The touch point X is drawn at the `answer` value along AB; it is never computed in code.

**Keyframes:**

| Keyframe | End state at `t = 1` |
| --- | --- |
| `show_river` | river, P, Q, A, B, the drops and the three given lengths |
| `try_midpoint` | the trap: a chalk-grey path P→midpoint→Q with a "?" badge; it fades to 30% at the end |
| `reflect_point` | Q′ appears below the river, mirrored from Q, with a dashed fold line and equal-length marks on QB and Q′B |
| `draw_straight` | the straight segment P→Q′ draws on in the lens colour; X lights up where it crosses the river; the real path P→X→Q glows |
| `mark_similar` | triangles PAX and Q′BX fill in two step colours, with the ratio note (from the step's `ja`) beside them |
| `show_answer` | the `result` step line, then `display_ja` (4m) |

**Study pace:** trap beat (the midpoint guess) → lens activates (折り返す label from `bundle.labels`) → `reflect_point` → `draw_straight` → `mark_similar` (hold long enough to read the ratio) → result and answer. Same `motion.study` timings.

**Variants:** variants carry their own `text_ja` (show it, never the card's sentence; the numbers differ). mirror variants carry `figure: {ab, pa, qb}`. Merge it over the card's figure.

## Acceptance

- [ ] `/dev/scenes` shows `mirror-001` and its 3 variants at every keyframe, `t = 0` and `t = 1`, in both themes, with no console errors.
- [ ] X sits at the answer's position on AB for the card and every variant (4, 12, 3 and 6 m).
- [ ] The midpoint guess is visibly a different point from X.
- [ ] The beat engine renders a study-pace `mirror-001` Short with no lens-specific branching outside the figure renderer and its keyframes.
- [ ] Tests: purity, "theme changes colours only" and every-keyframe render include `mirror-001`.
- [ ] Nothing under `cards/`, `labels/`, `schema/`, `tokens/`, `tools/` changed.
