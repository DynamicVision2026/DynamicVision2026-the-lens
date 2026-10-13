# WO-014: Micro Masterclass (Step 1), one player for all 8 lenses

**Owner:** Builder · **Review:** Architect visual check · **Target:** Oct 20 (before the Oct 23 core-player freeze) · Pacing approved by Brian, Oct 13 19:27.

## The standard (locked)
Four beats, 120 seconds, from `tokens.motion.masterclass` (tokens 1.7). Never hard-code the timings.

| # | beat | sec | what the child does |
|---|---|---|---|
| 1 | わな | 25 | sees the demo problem and the "usual way" stall, line by line |
| 2 | レンズ | 30 | taps through the lens, one step per tap, on the same figure |
| 3 | やってみる | 35 | does it once on an easier problem, with the ghost finger |
| 4 | いつ使う？ | 30 | taps the clue words, then sees one case where this lens is the wrong tool |

- **Pacing:** beats advance **on tap**. A 4-segment bar fills each segment at its target pace, with a clock reading 「m:ss / 2:00」. It never force-advances, and the Try beat never times out.
- **Reference:** the Enclose prototype, `masterView` in `prototypes/founder-mvp/template.html`. Brian approved its feel.

## Data: no per-lens code
- Authored content: `catalog/chugaku_juken/masterclass.yaml` (Architect). The validator checks it.
- The bundle carries it as `passes[].lessons[].masterclass`:

```ts
{ demo: string; try: string; boundary: string;   // card ids
  boundary_line: string;                          // the "not here" sentence, already chosen by the validator
  clues: string[];                                // tag ids (labels in bundle.labels.tags)
  say:   { trap, trap_end, lens, lens_end, try, try_done, when, boundary: string };
  title: { trap, lens, try, when: string } }
```

## The four beats (generic over every lens)
1. **わな**
   - The demo card's `problem.text_ja` and its static figure (`LensScene` at keyframe 0; text-only if there is none).
   - The `trap_route.steps` appear one at a time, every `trap_line_stagger_ms`, in a card headed `title.trap`, with a thin orange "time running out" strip.
   - The mascot says `say.trap`, then `say.trap_end` after the last line. Button: 「どうする？ →」.
2. **レンズ**
   - The same figure. Each tap advances one `lens_route` step: show its caption, and move `LensScene` to the keyframe that captions that step (the same mapping the walkthrough and Shorts use).
   - Taps less than `lens_step_min_ms` apart are ignored. The result step plays the aha (halo, stagger, confetti).
   - Mascot: `say.lens`, then `say.lens_end`. Button: 「自分でやってみる →」.
3. **やってみる**
   - The `try` card in its **course drag scene**, with the coach: ghost finger on first use, 5 s idle halo.
   - No pick step, because the lens is already known. No timer.
   - On solve: aha, `say.try_done`. Button: 「いつ使う？ →」.
4. **いつ使う？**
   - Heading `title.when`; one chip per `clues` tag (`labels.tags[t].ja`). The child taps each (snap tick).
   - When all are lit, show the **boundary** card: its text and static figure (or text only).
   - The panel heading depends on the boundary card:
     - a failure / no-lens card of this lens: 「レンズが使えないとき」;
     - a card from another lens: 「ここは別のレンズ」, plus that lens's chip (`picker.correct`).
   - Under it, `boundary_line`. Mascot: `say.boundary`.
   - Final button: 「マスタークラス完了！ 練習へ →」 goes to Step 2 (the ladder).

## Flow and progress
- **Route:** `/lesson/:passId/:lens/master`. The step bar's "1 さわって学ぶ" becomes live.
- **Case page:** a lens tile opens Step 1 the first time (until `masterclassSeen(pass, lens)`), then Step 2. Step 1 stays replayable from the step bar.
- **Logging:** the masterclass logs no attempts (WO-019): there's no pick to time. Store only `masterclassSeen`.
- **Shared parts:** reuse `LensScene`, the course scenes, `makeCoach`-style guide, `Aha` and the step bar. Nothing lens-specific goes in the player.

## Tests
For every lesson with a masterclass (all 8):
- all 4 beats render on iPad and phone with no warnings;
- the beat-2 taps reach the result step;
- beat 3 snaps at the `try` card's answer;
- beat 4 shows every clue chip and the `boundary_line`.

Also:
- timings come from tokens: changing a token value changes the bar;
- the first visit to a lens opens Step 1, the second opens Step 2.

## Done when
- All 8 masterclasses play end to end in about 2 minutes on iPad 1180×820 and phone 390×844, with no console errors.
- CI is green.
- The Architect visual check passes.
- Then Brian runs one on his iPad.
