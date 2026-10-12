# WO-006 · Area (面積図) and Constant (差一定) scenes: word problems

**Owner:** Builder · **Reviewer:** Product Architect · **Target:** Nov 2 · **Depends on:** WO-004 merged (WO-005 can run in parallel)

## Goal

`area-001` and `constant-001` play in the trainer and render as study-pace Shorts. These are word problems: the figure is a **diagram the lens draws**, not a shape given in the problem.

## Getting the cards

Both are `status: draft` until this WO merges. Build a local bundle with:

    bash -O globstar -c 'python3 tools/validate.py cards/**/*.yaml --bundle --include-drafts'

`figure.type` is `word_problem`. `figure.kind` is `two_kinds_total` (Area) or `age_ratio` (Constant); `figure.params` holds the numbers and `figure.names` the nouns. **Variants carry their own `text_ja`**: always show the variant's sentence, never the card's, because the numbers differ.

## Rule reminder

Every printed number comes from `figure.params` or a step's `ja`/`value`. Diagram sizes may be scaled from `params` for drawing, but no new number is ever computed and printed.

## Area: `area-001` (50円玉と10円玉, 20枚, 640円 → 11枚)

**Diagram:** the area diagram (面積図). Two rectangles side by side on one baseline. Width = count, height = value per item. The left rectangle is the unknown count of the larger coin (taller); the right one is the rest (shorter).

| Keyframe | End state at `t = 1` |
| --- | --- |
| `show_story` | the sentence (`text_ja`, or the variant's `text_ja`) in large type, the key numbers highlighted |
| `draw_rectangles` | the two rectangles with "?" widths, total width labelled 20枚, heights 50円 and 10円 |
| `assume_all_b` | a dashed line at height 10 across the full width: "全部10円玉なら" (step 2's `ja`) |
| `show_gap_strip` | the strip above the dashed line over the left rectangle fills in the lens colour, labelled with step 3's difference (440) |
| `divide_strip` | the strip's height (40) marked; the strip's width resolves to the answer (11) |
| `show_answer` | the `result` step, then `display_ja` |

## Constant: `constant-001` (38才と8才, 3倍 → 7年後)

**Diagram:** two horizontal age bars (線分図), parent above and child below, left-aligned.

| Keyframe | End state at `t = 1` |
| --- | --- |
| `show_story` | the sentence, key numbers highlighted |
| `draw_age_bars` | bars of length p and c, labelled 38才 and 8才 |
| `mark_difference` | the part of the parent's bar beyond the child's lights up in the lens colour, labelled 30 (step 1) with 「ずっと同じ」 |
| `grow_bars` | both bars grow by the same amount together; the difference segment keeps exactly its length (this is the lens) |
| `split_difference` | at the moment the parent is r × the child, the child's bar is shown as 1 part and the parent's as r parts. The difference = r − 1 parts (step 2); one part = 15 (step 3) |
| `show_answer` | the `result` step (15 − 8 = 7), then `display_ja` |

## Study pace

The same beat engine: trap beat (the "make a table" trap, readable) → lens activates (面積図 or 差一定 label from `bundle.labels`) → one keyframe per beat at `motion.study` timings → answer. Use the step palette to colour the two rectangles (Area) and the two bars (Constant).

## Acceptance

- [ ] `/dev/scenes` shows both cards and their 6 variants at every keyframe, `t = 0` and `t = 1`, in both themes, with no console errors.
- [ ] Variants show their own sentence and numbers (for example `area-001-v1`: 100円玉と50円玉, 19枚, 1700円 → 15枚).
- [ ] During `grow_bars` the difference segment keeps exactly its length.
- [ ] No number appears that isn't in `params` or a step.
- [ ] Study-pace Shorts render for both cards with no card-specific code outside the two diagram renderers.
- [ ] Tests: purity, "theme changes colours only" and every-keyframe render include both cards.
- [ ] Nothing under `cards/`, `labels/`, `schema/`, `tokens/`, `tools/` changed.
