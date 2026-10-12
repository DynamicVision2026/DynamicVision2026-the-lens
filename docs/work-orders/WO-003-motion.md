# WO-003 · Motion direction for the Short (founder brief, Oct 12)

**Applies to:** WO-003 Part A (the Short). Read with [WO-003](WO-003-enclose-prototype.md). Where they differ, this file wins for the Short.

**What the founder asked for:** cinematic pacing and kinetic motion, not static slides. A dark background, chalky grey trap lines, and a brilliant lens accent that wipes on like a laser, glows, then collapses the corners until only the 19.5 cm² core remains.

## Order of work: preview cut first

1. **Step 1 · Motion preview (≈10 s).** Build only the collapse sequence for `enclose-001`, beats below. Push it to your WO-003 branch and comment on the PR with the commit to render. The Architect renders the MP4 and sends it to Brian, because AI sessions can't upload video to GitHub.
2. **Brian approves the look** (recorded on the PR as "✅ Approved by Brian — motion").
3. **Step 2 · Full 30 s Short + Perspective Picker,** as in WO-003, reusing the approved motion.

Do not build the full Short before step 2. Changing motion after the 30 s timeline exists costs twice.

## Theme

- The Short uses `tokens.themes.short_dark`: deep navy background (not black), chalk-grey trap, brilliant cyan Enclose accent, glow settings.
- The trainer and book stay on the base (light) theme. `LensScene` gets a `theme` prop (`"base"` default, `"short_dark"`); the token adapter merges the theme over the base. No colour values in code; `check-no-literals` still applies.
- Founder note on tone: an earlier Math Japan render was rejected for a dark, frightening feel. Dark here must read as **premium and playful**: navy not black, no harsh flashes, friendly easing, nothing sharp or sudden.

## Beat sheet · motion preview (30 fps)

| Time | Beat | Motion | Data |
| --- | --- | --- | --- |
| 0.0–1.5 s | Trap state | Grid fades in; figure drawn in chalk grey (`trap.ink`), slightly rough via a dashed stroke; trap scratch lines fade in at 40% | `problem.figure`, `trap_route.steps` (first two) |
| 1.5–2.2 s | Lens activates | Scratch lines dim to 15%; Enclose icon pops in (spring); figure stroke shifts chalk → `ink` | `lens`, `LensIcon` |
| 2.2–2.9 s | Laser wipe | Bounding box drawn by `stroke-dashoffset` over `laser_wipe` ms, with a bright leading head (a small dot at the drawing tip). Glow switches on as the box closes | `draw_box` |
| 2.9–4.4 s | Corners light up | The 4 corner triangles fill in lens tint **one by one in step order** (AB, BC, CD, DA), `corner_fill` each, `corner_stagger` apart; each value label pops in with `spring` | `shade_corners`, `label_corners`, `sub` steps |
| 4.4–6.6 s | Collapse | Each corner, in the same order, slides **outward** from the core by ~24 px and fades over `corner_remove`, while the equation builds term by term: `36` → `36 − 5` → `36 − 5 − 4` → … | `subtract`, `start` + `sub` step values |
| 6.6–7.4 s | Core isolated | Quadrilateral fills with the lens colour at `lens_tint_opacity`; outline glows; glow pulses between `pulse_min_opacity` and `opacity` over `pulse_period_ms` | `show_answer` |
| 7.4–10.0 s | Answer | The result line, then `display_ja` (19.5cm²) springs in large; hold `hold_answer` ms; `trigger.ja` fades in underneath | `result` step, `answer.display_ja`, `trigger.ja` |

## Rules that still hold

- **No computing:** the equation shows the step values themselves (`36 − 5 − 4 − 6 − 1.5`); do not show running totals like 31, 27. The final number comes from the `result` step and `display_ja`.
- **Corner order = step order.** The validator guarantees this now (`step_order` check).
- **Deterministic:** springs and glow pulses come from `useCurrentFrame()` (`spring()` from Remotion, `interpolate` with the token easing). No timers, no randomness.
- **Same scene:** keep the drawing in `LensScene` / primitives. Remotion only maps frames to `(keyframe, t)` and passes `theme="short_dark"` plus a `motion` prop for extras: laser head, outward slide, glow pulse. Those extras must also work in `/dev/scenes`, driven by the `t` slider.
- **Safe zones:** keep everything inside `layout.short.safe_top_px` / `safe_bottom_px`.

## Acceptance (step 1)

- [ ] Composition `EncloseMotionPreview`, 1080×1920, 30 fps, 300 frames, prop `cardId` (default `enclose-001`).
- [ ] Every beat above, in order, with the stated token timings.
- [ ] Corner labels match their corners (5 · 4 · 6 · 1.5 for enclose-001).
- [ ] `cardId=enclose-002` and `enclose-003` also render correctly with no code change.
- [ ] Tests still pass, including purity. Add one test that `theme="short_dark"` changes only colours, not geometry.
- [ ] PR comment names the commit for the Architect to render.
