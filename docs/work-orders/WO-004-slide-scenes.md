# WO-004 · Slide lens (等積変形) scenes: the parallel-band figure

**Owner:** Builder · **Reviewer:** Product Architect · **Target:** Oct 27 · **Depends on:** WO-003 step 2 merged (study-pace engine in place)

## Goal

`slide-001` plays in the trainer and renders as a study-pace Short, using the same `LensScene`, themes, step palette and beat engine as Enclose.

## The card in one picture

Two horizontal parallel lines, ℓ on top and m below, `band_height` apart. On m sit points A, B, C, D (`bottom_x`); on ℓ sit P, Q, R (`apex_x`). The shaded triangles are ABP, BCQ, CDR. The problem gives **only** AD = 10 cm and the gap 6 cm. The individual bases are deliberately not given (`shown.each_base: false`), so the scene must **not** print AB, BC or CD.

Lens idea: slide P, Q and R along ℓ to one point. Each triangle keeps its base and its height, so the total area is unchanged. The three triangles become one triangle with base AD.

## Getting the card

`slide-001` is `status: draft` so that `main` stays green until band scenes exist: the validator checks it fully, but the normal bundle leaves it out. While you build, generate a local bundle that includes it:

    bash -O globstar -c 'python3 tools/validate.py cards/**/*.yaml --bundle --include-drafts'

The Architect flips it to `verified` in a one-line PR right after this WO merges.

## Scope

**New figure renderer** `parallel_band` in `packages/scenes` (beside `grid_polygon`):
- Lines ℓ and m drawn full width, with a small "∥" mark (tokens: `stroke.figure`, `color.ink`). Point labels from `figure.point_labels`.
- Triangles in their `color.step.palette` colours (one colour per triangle), so each piece is followable.
- Length marks only where `shown` is true: the AD bracket below m, labelled with `figure.total_base` (added to the bundle by the validator), and the gap bracket labelled with `figure.band_height`. Never subtract coordinates to get a length; no individual base marks.

**Keyframes** (`card.animation.keyframes`):

| Keyframe | End state at `t = 1` |
| --- | --- |
| `show_band` | lines, points, three coloured triangles, the AD and gap brackets |
| `mark_parallel` | ∥ marks pulse; the gap bracket highlights in the lens colour: "the height is the same everywhere" |
| `slide_apexes` | P, Q, R glide along ℓ to one point, one after another in order, each triangle reshaping as its apex moves; its base stays put. Default meeting point: `apex_x[0]` |
| `merge_triangle` | the three coloured triangles now share one apex and read as one triangle; its outline glows in the lens colour |
| `show_answer` | the `result` step line, then `display_ja` |

**Study pace:** reuse the WO-003 v2 beat engine. Trap beat (the trap steps, readable) → lens activates (等積変形 label from `bundle.labels`) → `mark_parallel` → `slide_apexes` (about 1.5 s per apex, at `motion.study` pacing) → `merge_triangle` → result and answer. Driven by the number of apexes, never hard-coded to 3.

**Variants:** slide variants carry `figure: {bottom_x, apex_x, band_height}` instead of `points` (see `build/bundle.json`). Merge it over the card's figure the same way you merge `points` today.

## Acceptance

- [ ] `/dev/scenes` shows `slide-001` and its 3 variants at every keyframe, `t = 0` and `t = 1`, in both themes, with no console errors.
- [ ] No AB / BC / CD length appears anywhere; only AD and the gap.
- [ ] During `slide_apexes` each triangle's base stays fixed and only its apex moves along ℓ.
- [ ] `EncloseMotionPreview`'s beat engine renders a study-pace `slide-001` Short with no Enclose-specific code paths.
- [ ] Tests: purity, "theme changes colours only" and an every-keyframe render test include `slide-001`.
- [ ] Nothing under `cards/`, `labels/`, `schema/`, `tokens/`, `tools/` changed.
