# WO-014: Masterclass (Step 1): a 6-minute acquisition loop, one player for all 8 lenses

**Owner:** Builder · **Review:** Architect visual check · **Target:** Oct 21 (core-player freeze Oct 23)
**Decision:** Brian, Oct 13 19:33. This replaces the 2-minute version approved at 19:27: a 5-minute core masterclass, a 1-minute practice onboarding, then the 5-problem practice round.

## The standard (locked in tokens 1.8, `motion.masterclass`)

| # | beat | sec | card | what the child does |
|---|---|---|---|---|
| 1 | わなとレンズ (principle & mechanism) | 60 | `example1` | watches the usual way stall (trap lines), then sees the lens idea on the same figure |
| 2 | 例題1 (worked example 1) | 105 | `example1` | **does** the anchor problem in its drag scene, step by step, with the ghost finger and lens-step captions |
| 3 | 例題2 (worked example 2) | 90 | `example2` | does a transformed or harder problem with the same lens (drag scene; walkthrough if the card has none) |
| 4 | 使えないとき (failure boundary) | 45 | `boundary` | sees one case where this lens is the wrong tool, and why |
| 5 | 練習のしかた (practice onboarding) | 60 | `try` | dry run of the practice routine: find the clue → pick the lens **with no hints** (no solving) |
| → | Step 3: practice round | — | variants | 5 independent problems (`practice_round: 5`) |

- **Totals:** core 300 s, total 360 s. **Never hard-code timings;** read them from tokens.
- **Pacing:**
  - beats advance **on tap**;
  - a 5-segment bar fills at target pace, with a clock reading 「m:ss / 6:00」, where segment 5 is styled as "練習の準備";
  - nothing force-advances, and drag beats never time out.
- **Every beat has a child action.** Six minutes is long for a 10–11-year-old; a beat that is only watching loses them.

## Data: no per-lens code
- Content: `catalog/chugaku_juken/masterclass.yaml` (Architect). All 8 lenses are authored and checked by the validator.
- The bundle carries it as `passes[].lessons[].masterclass`:

```ts
{ example1: string; example2: string; boundary: string; try: string;   // card ids
  example2_mode: 'scene' | 'walkthrough';
  boundary_line: string;            // the "not here" sentence, chosen by the validator
  clues: string[];                  // tag ids from example1's trigger
  title: { principle, example1, example2, boundary, onboarding: string };
  say:   { principle, principle_turn, principle_lens, example1, example1_done,
           example2, example2_done, boundary, onboarding, onboarding_done: string } }
```

## The five beats (generic over every lens)
1. **わなとレンズ (60 s)**
   - Show `example1`'s text and static figure (`LensScene` keyframe 0).
   - The `trap_route` lines appear one at a time (every `trap_line_stagger_ms`) under 「くせでやると…」, with a thin "time running out" strip. Mascot: `say.principle`, then `say.principle_turn`.
   - Button 「レンズで見ると？」. On tap, `grounding.principle_ja` appears as a one-line idea card, and `LensScene` plays the lens keyframes once, quickly (the "breakthrough" preview, not yet solved). Mascot: `say.principle_lens`.
   - The child taps the 「やってみる →」 button.
2. **例題1 (105 s)**
   - `example1` in its **course drag scene** with the coach (ghost finger on first use, 5 s idle halo). No pick step.
   - Each `lens_route` step caption appears as the scene reaches it.
   - On solve: aha, `say.example1_done`, and the full step list. Button 「例題2 →」.
3. **例題2 (90 s)**
   - `example2`: the drag scene when `example2_mode === 'scene'`, otherwise the WO-016 walkthrough (tap-to-reveal steps).
   - Mascot opens with `say.example2` (what changed) and closes with `say.example2_done` (why the same lens still works).
4. **使えないとき (45 s)**
   - The `boundary` card's text and static figure (or text only).
   - Heading: 「レンズが使えないとき」 for a failure / no-lens card of this lens; 「ここは別のレンズ」 plus that lens's chip for a card from another lens.
   - Under it, `boundary_line`. Mascot: `say.boundary`. The child taps 「わかった」.
5. **練習のしかた (60 s)**
   - Three numbered steps on one card: ① 手がかりの言葉をさがす ② 道具をえらぶ（ヒントなし）③ ドラッグして答え.
   - **Dry run on `try`:**
     - the child taps the clue chips (`clues` of example1 are shown as the "words to look for");
     - then picks the lens in the normal `PickCard` with **no ghost finger and no hint**;
     - a right pick gives `say.onboarding_done`; a wrong pick shows that option's `feedback_ja` and lets them pick again.
   - No solving. Button 「練習スタート（5問）→」 goes to Step 3.

## Step 3 change: the 5-problem round
- Step 3 opens as a **round of 5**: 「1 / 5」 progress, then a short round result.
- Problems are variants of this lesson's cards, never the masterclass's `example1`, `example2` or `try` themselves.
- Mastery (3 clean in a row) and the ★ work as now. After the round: 「もう1ラウンド」 or 「時間をはかって確認へ」.

## Flow, progress, logging
- **Route:** `/lesson/:passId/:lens/master`. The step bar's 「1 さわって学ぶ」 is live.
- **Case page:** a lens opens Step 1 the first time (until `masterclassSeen`), then Step 2. Step 1 stays replayable.
- **Logging:** the onboarding dry-run pick is logged (WO-019) with `ctx: 'lesson'`, as a normal first pick. The other beats log nothing.
- **Copy:** `launch/copy.ts`, 「さわって学ぶ（約2分）」 → **「さわって学ぶ（約6分）」**. WO-010 is updated to match.

## Tests
For each of the 8 lessons:
- all 5 beats render on iPad and phone with no warnings;
- example 1 snaps at its answer;
- example 2 reaches its result in its mode;
- the boundary shows `boundary_line`;
- the dry run accepts only `picker.correct` and shows the feedback for wrong picks.

Also:
- timings come from tokens;
- the Step 3 round has 5 problems and none is a masterclass card;
- the first visit opens Step 1.

## Done when
- All 8 masterclasses play end to end (about 6 minutes), handing off to a 5-problem round, on iPad 1180×820 and phone 390×844, with no console errors.
- CI is green and the Architect visual check passes.
- Then Brian runs one on his iPad.
