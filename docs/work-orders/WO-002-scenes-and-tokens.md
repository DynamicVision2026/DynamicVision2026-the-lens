# WO-002 · Shared SVG scene components reading tokens

**Owner:** Builder · **Reviewer:** Product Architect · **Target:** Oct 20, 2026 · **Depends on:** WO-001

## Goal

One React component draws any Enclose card at any animation moment, identically in the browser and in Remotion: `<LensScene card={card} keyframe={i} t={0..1} />`.

## The scene contract (non-negotiable)

1. **Pure function of props.** Output depends only on `card` (or a `variant` merged onto it), `keyframe` (index into `card.animation.keyframes`), `t` (progress 0–1 within that keyframe) and `mode`. No timers, no `Date`, no `Math.random`, no effects, no internal state. The trainer drives `t` with `requestAnimationFrame`; Remotion drives it from the frame number. That is why a child and a Short see the same animation.
2. **Never computes answers.** All numbers and Japanese text come from the bundle (`lens_route.steps[*].value` / `.ja`, `answer`, `display_ja`). Drawing geometry may be derived (bounding box, corner triangle outlines from `points`), but every label's value is read from a step.
3. **Tokens only.** Colours, stroke widths, dashes, fonts, durations come from `tokens/tokens.json`. Add a CI script `scripts/check-no-literals.mjs` that fails on hex colours (`#[0-9a-f]{3,8}`) inside `packages/scenes/src` and `apps/*/src`.
4. **Unknown keyframe:** draw the end state of the last known keyframe before it, `console.warn` once, never throw.
5. **Reduced motion:** a `reducedMotion` prop snaps `t` to 1 (the trainer passes `prefers-reduced-motion`).

## Scope

**Token adapter** `packages/scenes/src/tokens.ts`: imports `tokens.json`; exports typed constants and `cssVars(tokens): Record<string, string>` (for example `--lens-enclose`, `--stroke-lens`). `mode: 'screen'` uses `value`; `mode: 'print'` is a stub for Phase 2.

**Fonts:** Noto Sans JP, Inter and Klee One via `@fontsource/*` packages, loaded the same way in both apps (Remotion: `@remotion/fonts` or `loadFont` before render).

**Primitives** (in `packages/scenes/src/primitives/`), each a pure SVG component:

| Primitive | Draws | Token group |
| --- | --- | --- |
| `GridLayer` | grid lines for `figure.grid`, major every `stroke.grid_major.every` | `color.grid`, `stroke.grid*` |
| `FigurePolygon` | the problem figure with vertex labels A, B, C… in point order | `color.ink`, `stroke.figure` |
| `TrapScratch` | trap-route steps as handwriting lines, dashed strokes | `color.trap.*`, `stroke.trap`, `type.family_hand` |
| `ConstructionLine` | enclosing box / cut line, draw-on with `t` | `color.lens.<lens>`, `stroke.lens_construction` |
| `RegionShade` | a filled region (corner triangle, piece) fading with `t` | `color.lens.<lens>` at `lens_tint_opacity` |
| `StepLabel` | one step's `ja` text and value, count-up with `t` | `type.scale.step` |
| `TimeStrip` | trap vs lens time bars + 目安 / 実測 badge | `time_cost` |
| `LensIcon` | the lens icon named in `color.lens.<lens>.icon` (simple SVG, 24×24) | `color.lens.*` |

**Keyframes** used by the 5 Enclose cards (`packages/scenes/src/keyframes/`):

| Keyframe | Shows (end state at `t = 1`) |
| --- | --- |
| `show_shape` | grid + figure + vertex labels |
| `draw_box` | enclosing rectangle drawn on (stroke-dashoffset by `t`) |
| `shade_corners` | each corner gap shaded, one after another across `t` |
| `label_corners` | each corner's value from the matching `sub` step |
| `subtract` | the `result` step's equation |
| `show_answer` | `display_ja` large, figure tinted in the lens colour |
| `flash_irregular_gap` | (f01) the non-triangle gap pulses in the flag colour |
| `undo_box` | (f01) enclosing box fades out |
| `draw_cut_line` | (f01) vertical cut at the x of the last point in `figure.points` (the deepest notch vertex) |
| `shade_pieces` | (f01) the four pieces shaded with their step values |
| `highlight_base` | (no-lens) the base edge on a grid line, thickened |
| `drop_height` | (no-lens) a dashed height from apex to base |
| `ghost_box_struck_out` | (no-lens) a faint enclosing box with a strike, meaning "not needed" |

**Dev page:** `apps/trainer` route `/dev/scenes` shows every card (and its variants) with a keyframe selector and a `t` slider. This is the review surface; no Storybook.

## Acceptance

- [ ] `/dev/scenes` renders all 5 cards and all 15 variants at every keyframe, `t = 0` and `t = 1`, without errors.
- [ ] Changing `color.lens.enclose.value` in a local copy of `tokens.json` changes every Enclose accent with no code change.
- [ ] `scripts/check-no-literals.mjs` passes and runs in CI.
- [ ] A unit test renders `LensScene` twice with the same props and gets identical SVG markup (purity).
- [ ] Japanese text renders in Noto Sans JP; scratchwork in Klee One.
- [ ] PR includes a short screen recording of `/dev/scenes` stepping through enclose-001.

## Out of scope

The picker, the Short timeline, print mode, lenses other than Enclose.
