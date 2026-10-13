# WO-016: Boundary cards in lessons (failure + no-lens) and the walkthrough mode

**Owner:** Builder · **Review:** Architect visual check · **Target:** Oct 18 · Can run in parallel with WO-015, or follow it in the same PR if that is faster.

## Problem
`lessonProblems()` filters on `isPlayable()`, and `isPlayable()` needs `best_move === lens`. That drops every `failure` and `no_lens` card, including enclose-f01 and enclose-no-lens, which are already in the catalog. These cards teach the child **when not to use the lens**. They are part of the product promise (「このレンズが使えない問題」と「レンズを使わない方が速い問題」つき).

Then `.slice(0, lesson_target)` cuts the catalog list. Area and constant now have 7 anchor cards each, and Enclose has 10.

## Changes
1. **`lessonProblems(pass, lesson)`:**
   - Return **every anchor card in catalog order**. If there are fewer than `lesson_target`, top up with variants. Variants otherwise belong to the Step 3 drill.
   - Each problem gets `mode`:
     - `'scene'` when `isPlayable(card, lens)` (today's drag interactions);
     - `'walkthrough'` otherwise (failure, no-lens, and `figure.diagram.family === 'steps_only'`).
2. **Walkthrough mode** (one component, used by every lens):
   - **Pick:** the existing `PickCard`. It already uses `picker.correct`, which is `direct` or `freeze` on these cards, not the lesson's lens.
   - **Clue:** the existing `ClueCard` (`trigger.tags`, decoys from `clue_distractors`).
   - **Trap beat (failure / no_lens only):**
     - show `trap_route.steps` as a short greyed list with the label 「くせでやると…」;
     - the last trap line gets a ✕ and the mascot line 「ここで止まる」;
     - for no_lens, the label is 「レンズを使うと遠回り」.
   - **Reveal:** `lens_route.steps` appear one tap at a time ("次へ" or a tap anywhere on the card). Each tap plays the `motion.tactile` settle and `sfx` tick. The result step plays the aha (halo + stagger + confetti on the answer `display_ja`).
   - **Figure:**
     - if the card's family has a scene, show it static at its last keyframe (grid polygon for enclose-f01 / no-lens, `area_two_rect` for area cards);
     - `steps_only` shows text only, in the same card frame.
   - **Header chip:** `kind === 'failure'` → 「レンズが使えない問題」, `kind === 'no_lens'` → 「レンズを使わない方が速い問題」. Keys go in `ja.ts`.
3. **`checkProblems()` (free 「どのレンズ？」):** keep `kind === 'standard'` only. The free check asks which lens, and boundary cards are for the paid lessons.
4. **Progress / dashboard:** a walkthrough counts as solved when the reveal reaches the result step. The first pick is logged as usual.

## Tests
- `lessonProblems` returns every anchor in catalog order for area (7), constant (7) and enclose (10). Modes are correct (area-f01, area-no-lens, constant-f01, constant-no-lens, constant-005 → walkthrough).
- The walkthrough renders every step for every non-scene card, with no console errors.
- `checkProblems` never returns a failure or no_lens card.

## Done when
`/lesson/chugaku_juken/{enclose,area,constant}?preview=1` plays every anchor card end to end on iPad 1180×820 and phone 390×844, the Architect visual check passes, and CI is green.
