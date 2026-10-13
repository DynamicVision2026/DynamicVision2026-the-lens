# WO-011 · Lesson video template (3–5 min, one per lens)

**Owner:** Builder · **Reviewer:** Product Architect · **Target:** Oct 27 (Enclose), then one per lesson as its problems land · **Depends on:** WO-010

## Goal

A Remotion composition `LessonVideo` (`passId`, `lens`) that turns one lesson's data into its 3–5 minute explainer video. It is the Short's long form: same scenes, same study pace, same tokens (`short_dark` theme), **16:9 at 1920×1080** for the trainer player, plus a 9:16 cut of the same beats for YouTube if the layout allows it with no extra code.

## Beats (all text and numbers from the bundle)

| # | Beat | Source |
| --- | --- | --- |
| 1 | Title: lens icon + `labels.lenses[lens].ja` + `hint_ja` | labels |
| 2 | **The trap:** the anchor card (first `standard` card at level ≤ 2) played to the end of its trap route, with the time strip | anchor card |
| 3 | **The principle:** `grounding.principle_ja`, shown over the anchor figure's lens keyframes | anchor card |
| 4 | **Worked example 1:** the anchor card, full study-pace walkthrough | anchor card |
| 5 | **When to use it:** `trigger.ja` + the real clue chips (`trigger.tags` labels) vs the decoys, decoys struck out | anchor card |
| 6 | **Worked example 2:** the lesson's highest-level `standard` card | lesson |
| 7 | **When it fails:** the lesson's failure card, trap → stall → `best_move` | lesson |
| 8 | End: 「つぎは練習問題」 | fixed copy |

No narration in v1: on-screen Japanese text, paced to be read (`motion.study`), plus an optional music bed file the founder supplies. The duration follows the content; target 3–5 min.

## Acceptance

- [ ] `pnpm render:lesson chugaku_juken enclose` writes a 1920×1080 MP4 using only bundle data.
- [ ] Swapping `lens` to any lesson with ≥ 2 standard cards and a failure card renders with no code change. A lesson missing a beat's card skips that beat.
- [ ] The text-fit and line-breaking rules from #33 apply.
- [ ] Nothing under the Architect-owned paths changed.
