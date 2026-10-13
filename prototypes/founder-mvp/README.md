# Founder MVP prototype (Oct 13)

The interaction reference for the course player. Brian's directive (Oct 13): convince the founder first, with tactile "aha" across all 8 lenses, 5 problems per lens, Builder energy on touch, 3D and feedback.

- `template.html`: one self-contained page (vanilla JS + SVG, Three.js r128 lazy-loaded for 展開). `/*DATA*/` is replaced by `data.json`.
- `data.json`: extracted from `build/bundle.json` (verified cards + variants), so every number on screen is validated.
- Published for the founder as a private artifact; open it on an iPad.

**What the Builder ports into `apps/trainer` (WO-012):** per-lens drag interactions and snap targets, spring and overshoot feel, wrong-pick "try-on" feedback, clue step, aha burst + chime + staged steps, レンズケース home. The prototype is a reference for feel, not code to copy: the app keeps React, tokens and bundle types.
