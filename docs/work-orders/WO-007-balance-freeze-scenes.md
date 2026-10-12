# WO-007 · Balance (てんびん) and Freeze (止める) scenes

**Owner:** Builder · **Reviewer:** Product Architect · **Target:** Nov 4 · **Depends on:** WO-006 merged (it builds the word-problem plumbing these reuse)

## Goal

`balance-001` and `freeze-001` play in the trainer and render as study-pace Shorts. Both are `word_problem` cards (`kind: mixture` / `kind: meeting`), so they reuse WO-006's story beat, sentence handling (variants carry their own `text_ja`) and beat engine. Only the two diagrams are new.

## Getting the cards

Both are `status: draft` until this WO merges:

    bash -O globstar -c 'python3 tools/validate.py cards/**/*.yaml --bundle --include-drafts'

Same rule as before: every printed number comes from `figure.params` or a step. Positions may be scaled for drawing.

## Balance: `balance-001` (5% 200g + 10% ?g → 8% → 300g)

**Diagram:** a lever (てんびん). A horizontal beam on a number line of strengths: `p1` at the left end, `p2` at the right end, the pivot at `pt`.

| Keyframe | End state at `t = 1` |
| --- | --- |
| `show_story` | the sentence, key numbers highlighted |
| `draw_lever` | beam and pivot triangle |
| `place_strengths` | 5% at the left end with a weight labelled 200g, 10% at the right end with a weight labelled □g, the pivot at 8% (step 1) |
| `mark_arms` | the two arms coloured in two step colours and labelled 3 and 2 (step 2) |
| `invert_ratio` | arrows swap the arm lengths onto the weights: 200g : □g = 2 : 3 (step 3). The beam settles level |
| `show_answer` | the `result` step, then `display_ja` |

## Freeze: `freeze-001` (1800m, 分速80m and 分速70m → 12分後)

**Diagram:** a road (線分図) with 兄 at the left end and 弟 at the right end (`figure.names`).

| Keyframe | End state at `t = 1` |
| --- | --- |
| `show_story` | the sentence, key numbers highlighted |
| `draw_road` | the road labelled 1800m, both walkers at the ends with speed tags 80 and 70 |
| `both_walk` | the trap: both move a little; a chalk "?" at the halfway point (they do **not** meet there) |
| `freeze_one` | 弟 freezes, with a lens-colour outline and a ❄ icon (`LensIcon` freeze); 兄's speed tag changes to 80+70 = 150 (step 1) |
| `combine_speeds` | 兄 alone covers the whole road at 150 per minute; a minute counter ticks in 150m blocks along the road (block count from the `result` value) |
| `show_answer` | the `result` step, then `display_ja` |

## Acceptance

- [ ] `/dev/scenes` shows both cards and their 6 variants at every keyframe, `t = 0` and `t = 1`, in both themes, with no console errors.
- [ ] Variants show their own sentences and numbers (for example `freeze-001-v1`: 2800m, 分速100m and 40m → 20分後).
- [ ] The lever reads correctly: the heavier side sits nearer the pivot.
- [ ] The halfway "?" in `both_walk` is visibly not where they meet.
- [ ] Study-pace Shorts render for both cards with no card-specific code outside the two diagram renderers.
- [ ] Tests include both cards (purity, theme, every keyframe).
- [ ] Nothing under `cards/`, `labels/`, `schema/`, `tokens/`, `tools/` changed.
