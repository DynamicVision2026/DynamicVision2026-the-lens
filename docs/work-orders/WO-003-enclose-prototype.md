# WO-003 · Enclose prototype: 30-second Short + Perspective Picker

**Owner:** Builder · **Reviewer:** Product Architect · **Target:** demo at the Oct 21 handshake · **Depends on:** WO-002

## Goal

`enclose-001` renders to a 30-second vertical MP4 and plays as an interactive Perspective Picker on a tablet, both driven by the same `LensScene`.

## Part A · Short (`apps/shorts`)

Composition `EncloseShort`, 1080×1920, 30 fps, 900 frames, input prop `cardId` (default `enclose-001`). Respect `tokens.layout.short.safe_top_px` and `safe_bottom_px`.

| Time | Beat | Content source |
| --- | --- | --- |
| 0–3 s | Hook: figure appears, question text | `problem.text_ja`, `show_shape` |
| 3–11 s | Trap route: scratch lines appear one by one; time strip grows to the trap time | `trap_route.steps`, `trap_route.time_cost_sec`, `TrapScratch`, `TimeStrip` |
| 11–15 s | Freeze: four lens buttons, the question 「どのレンズ？」 | `picker.options` + `LensIcon` |
| 15–25 s | Lens reveal: keyframes in order, evenly timed; correct button highlighted | `animation.keyframes`, `lens_route.steps` |
| 25–30 s | Trigger card + end frame | `trigger.ja`, series end card |

- Captions are burned in; all card text comes from the bundle. The only fixed copy is the series end card: 「視点レンズ ― 無料で1レンズ試せます」 with a placeholder URL `lens.beyondculture.ai` (final domain from the founder).
- Lens button labels: 囲む / 等積変形 / 折り返す / そのまま計算 for `enclose`, `slide`, `mirror`, `direct`. Put this map in `packages/scenes/src/labels.ts` and flag it in the PR; the Architect will move it into the schema.
- No voice-over or music in this WO (audio is a later decision).
- Script `pnpm render:short enclose-001` writes `out/enclose-001.mp4` (git-ignored).

## Part B · Perspective Picker (`apps/trainer`)

Route `/play/enclose-001`. One screen, iPad landscape first (1180×820), also works at 390×844. Tap targets ≥ 48 px, no typing. Follow the wireframe and steps in `docs/PRD.md` §4.

**State machine** (plain `useReducer`, no library):

```
problem ──pick wrong──▶ feedback ──▶ problem   (option greyed; after 2 misses show trigger.ja as a hint)
problem ──pick right──▶ clue
clue ──tap tags──▶ reveal     (LensScene plays all keyframes, then lens_route.steps appear one by one)
reveal ──next──▶ variant      (enclose-001-v1, timed, same picker, no hints)
variant ──done──▶ report      (Time-Saved report)
```

- **Clue step:** show the card's `trigger.tags` as chips plus 2 distractor chips from a fixed list in `labels.ts` (`parallel_lines`, `3d_solid`). Correct = the child taps at least one real tag and no distractor. A right lens with a wrong clue shows the hint and does not count as a clean solve. Chip labels need Japanese text; add them to `labels.ts` and flag in the PR (Architect follow-up).
- **Timing:** record seconds from first render to correct pick, for the card and for the variant.
- **Storage:** a `safeStorage` wrapper (`get`, `set`, both in try/catch) stores `{cardId, attempts, misses, seconds, clueCorrect}` under one key `lens.v1`. The page must work in a private window with storage disabled.
- **Report:** first-attempt time vs variant time, the 目安/実測 badge from `time_source`, the wording 「同じ型の問題」, and one button 「先行予約（¥6,800）」 linking to a placeholder URL. No exam-score claims.

## Acceptance

- [ ] `pnpm render:short enclose-001` produces a 30.0 s, 1080×1920 MP4; every number and Japanese line in it matches the bundle.
- [ ] Swapping `cardId` to `enclose-002` or `enclose-003` renders a correct Short with no code change.
- [ ] `/play/enclose-001` runs the full loop on iPad Safari (or its simulator) and a phone viewport.
- [ ] Two wrong picks show the trigger hint; a wrong clue does not count as a clean solve.
- [ ] Works in a private window; progress survives a reload in a normal window.
- [ ] `prefers-reduced-motion` shows end states with 200 ms fades.
- [ ] PR includes the MP4 and a screen recording of one full picker run.

## Out of scope

Email capture, Shopify links beyond a placeholder, other lenses, mixed sets, the access engine, deployment.
