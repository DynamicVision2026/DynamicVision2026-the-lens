# WO-008 · Unfold lens (展開) scenes: the box-net figure

**Owner:** Builder · **Reviewer:** Product Architect · **Target:** Nov 6 · **Depends on:** WO-005 merged (it reuses the Mirror "straight line + similar triangles" beats)

## Goal

`unfold-001` plays in the trainer and renders as a study-pace Short, with the same `LensScene`, themes, step palette and beat engine as the other lenses. This is the 8th and last lens of 中学受験 stage 1.

## The card in one picture

A cuboid ABCD-EFGH (E above A, F above B, G above C): AB = 6 cm, BC = 4 cm, AE = 5 cm (`figure.a`, `b`, `h`). A taut string runs on the surface from A to G and crosses edge BF at P. Where is P for the shortest string? **BP = 3 cm.**

- **Trap:** cross BF at its midpoint. That only works when AB = BC, and the validator guarantees it never is.
- **Lens:** open faces ABFE and BCGF flat along BF into one rectangle (width 6 + 4 = 10, height 5). On the net, the straight line A→G crosses BF at P. Triangles ABP and ACG are the same shape, so BP : CG = 6 : 10 = 3 : 5, and BP = 5 × 3/5 = 3.

## Getting the card

`unfold-001` is `status: draft` until this WO merges:

    bash -O globstar -c 'python3 tools/validate.py cards/**/*.yaml --bundle --include-drafts'

## Scope

**New figure renderer** `box_unfold` in `packages/scenes`:
- The cuboid in a simple oblique (cabinet) projection, vertices labelled from `figure.point_labels`, hidden edges dashed. Given lengths printed from `figure.a`, `b`, `h`.
- The net: rectangle ABFE and rectangle BCGF side by side, sharing BF. Its total width label comes from `figure.net_width` (the validator supplies it; never add a + b in code).
- On the net, A = (0, 0), B = (a, 0), C = (a + b, 0), G = (a + b, h), and P sits on BF at height `answer`. These are drawing positions only. **Printed numbers come only from figure fields and step values.**

**Keyframes:**

| Keyframe | End state at `t = 1` |
| --- | --- |
| `show_box` | the cuboid, its labels and the three given lengths |
| `try_midpoint` | the trap: a chalk-grey string A→midpoint of BF→G on the box, with a "?" badge; it fades to 30% at the end |
| `unfold_faces` | face BCGF swings open around BF until it lies flat beside ABFE (a 2D hinge: scale its width from 0 to full or a skew; no 3D engine). End state: the flat net with the `net_width` label (step 1) |
| `draw_straight` | the straight A→G line draws on in the lens colour; P lights up where it crosses BF (step 2) |
| `mark_similar` | triangles ABP and ACG fill in two step colours (striped current piece, as in Enclose), with the ratio note from step 3's `ja` |
| `show_answer` | the `result` step, then `display_ja` (3cm). Optional: fold the net back to the box with the string on it |

**Study pace:** trap beat → lens activates (展開 label from `bundle.labels`, `cube-unfolded` icon) → one keyframe per beat at `motion.study` timings → result and answer.

**Variants:** unfold variants carry `text_ja` and `figure: {a, b, h, net_width, …}`. Show the variant's sentence and merge its figure over the card's.

## Acceptance

- [ ] `/dev/scenes` shows `unfold-001` and its 3 variants at every keyframe, `t = 0` and `t = 1`, in both themes, with no console errors.
- [ ] P sits at the answer's height on BF for the card and every variant (3, 4, 8 and 6 cm).
- [ ] The midpoint "?" in `try_midpoint` is visibly not where the straight line crosses BF.
- [ ] A study-pace Short renders for `unfold-001` with no card-specific code outside the `box_unfold` renderer.
- [ ] Tests include the card (purity, theme, every keyframe).
- [ ] Nothing under `cards/`, `labels/`, `schema/`, `tokens/`, `tools/` changed.
