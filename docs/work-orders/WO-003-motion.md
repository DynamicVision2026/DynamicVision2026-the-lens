# WO-003 · Motion direction for the Short — v2: study pace (founder brief, Oct 12)

**Applies to:** WO-003 Part A (the Short) and the trainer's reveal. Read with [WO-003](WO-003-enclose-prototype.md). Where they differ, this file wins.

## What changed from v1, and why

Brian reviewed the 10 s preview (`2cb2f46`). The look is right, but it is **too fast for studying**. Children must be able to follow the calculation **one step at a time**, with **each step isolated in its own colour**.

v2 keeps everything from v1: dark navy theme, chalk trap, cyan laser box with glow, corners in step order, outward slide, glowing core, no running totals, pure spring. It changes the middle of the video from one quick collapse into **a guided walkthrough, one calculation step per beat**. The whole walkthrough fits in about 30 s.

## Order of work

1. **Step 1b · Study-pace preview (≈30 s).** Rework `EncloseMotionPreview` to the beat sheet below (900 frames). Comment on PR #13 with the commit to render; the Architect renders the MP4 for Brian.
2. **Brian approves** (posted as "✅ Approved by Brian — motion").
3. **Step 2 · Full Short + Perspective Picker,** reusing the approved motion. Also apply the two fixes from the step-1 review: readable trap text (≥ 70% opacity until the lens activates) and a 囲む label next to the lens icon.

## New data and tokens (already on `main` via the Architect PR)

- **Step colours:** `color.step.palette` (base theme) and `themes.short_dark.color.step.palette`, four colours. Step *n* uses `palette[n-1]` for its piece, its base/height marks, its formula and its term in the equation. Every step also shows a **numbered badge** (①②③④), so colour is never the only cue (colour-blind safe).
- **Step details in the bundle:** for standard Enclose cards and their variants, `lens_route.steps[*].detail` now gives:
  - box step: `{kind: "box", width, height}`
  - each corner step: `{kind: "corner", n, edge: "AB", corner: [x, y], base, height}`

  `corner` is the right-angle vertex on the box. `base` runs horizontally along the box edge, `height` vertically. **Draw the base/height marks and their numbers only from `detail`; never measure them in code.**
- **Study timings:** `motion.study` sets `step_focus_ms` 500, `legs_draw_ms` 900, `formula_ms` 700, `step_hold_ms` 1600, `dim_others_opacity` 0.25, `equation_term_ms` 600, `final_hold_ms` 2500.

## Beat sheet · study pace (30 fps, ≈ 30 s)

One corner step = focus 0.5 s + base/height 0.9 s + formula 0.7 s + hold 1.6 s ≈ **3.7 s**.

| Time | Beat | What the child sees | Data |
| --- | --- | --- | --- |
| 0.0–4.0 s | Trap | Figure in chalk grey; the trap lines appear one by one, **readable (≥ 70% opacity)**: why the obvious route stalls | `trap_route.steps` (notes) |
| 4.0–5.5 s | Lens activates | Trap text dims; 囲む icon + label pops in; figure turns from chalk to ink | `lens`, lens label |
| 5.5–9.2 s | **Step 0 · Box** | Laser-wipe box with glow; width and height brackets along the box edges with **6** and **6**; formula card `6 × 6 = 36` in cyan; equation starts with **36** | `start` step + `detail.width/height` |
| 9.2–24.0 s | **Steps ①–④ · Corners** (3.7 s each) | For corner *n*: (1) badge + title (`右下の三角形` from the step's `ja`); the piece fills in `palette[n-1]`, all other pieces dim to `dim_others_opacity`; (2) base and height brackets draw along the box edges with their numbers; (3) formula card `base × height ÷ 2 = value` in the step colour; (4) hold; then the piece stays tinted (low opacity) and its value term joins the equation in its colour | `sub` step *n*, its `detail` and `value` |
| 24.0–27.0 s | Subtract | The four coloured pieces slide outward and fade **in step order**, each as its term lights up in the full equation `36 − 5 − 4 − 6 − 1.5` (each term in its step colour) | step values |
| 27.0–30.0 s | Answer | Core fills with cyan and glows; the `result` step line; **19.5cm²** springs in large; `trigger.ja` underneath; hold `final_hold_ms` | `result`, `display_ja`, `trigger.ja` |

**Formula card text:** build it from `detail.base`, `detail.height` and the step `value`, as "5 × 2 ÷ 2 = 5". That is formatting bundle numbers, not computing: all three numbers come from the bundle, and the validator guarantees `base × height ÷ 2 = value`.

**Labels must stay clear:** vertex letters, bracket numbers and badges never overlap each other or a line. Brackets sit outside the box, offset by at least one bracket-tick length.

**Cards with 3 corners** (enclose-003) run 3 corner steps. The timeline is driven by the number of `sub` steps, never hard-coded to 4.

## Rules that still hold (from v1)

- Theme `short_dark` for the Short only; the trainer and book stay light. Navy, not black; friendly easing; nothing harsh.
- No running totals (no "31", "27"). The final number comes only from the `result` step and `display_ja`.
- Deterministic and pure: everything from the frame (Short) or `t` (trainer). Same `LensScene`; Remotion only maps frames to beats.
- The pure spring using `tokens.motion.spring` is approved: it keeps `/dev/scenes` and the Short identical.
- Safe zones from `layout.short`.

## Acceptance (step 1b)

- [ ] `EncloseMotionPreview` is ≈ 30 s (900 frames ± 30), 1080×1920, 30 fps, `theme="short_dark"`.
- [ ] Each calculation step is on screen alone for ≥ 3.5 s, with its piece in its own colour, its numbered badge, its base/height marks and its formula card.
- [ ] Equation terms keep their step colours; no running totals anywhere.
- [ ] enclose-001 shows box 6 × 6 = 36, then ① 5 × 2 ÷ 2 = 5, ② 2 × 4 ÷ 2 = 4, ③ 4 × 3 ÷ 2 = 6, ④ 1 × 3 ÷ 2 = 1.5, each marked on its own corner.
- [ ] enclose-002 (4 steps) and enclose-003 (3 steps) render correctly with no code change.
- [ ] The trainer's `/dev/scenes` shows the same beats from the `t` slider, in the light theme with the base step palette.
- [ ] Tests pass, including purity and "theme changes colours only".
