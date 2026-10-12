# Builder work orders

Each work order (WO) is one PR. Read `docs/PRD.md` first; this folder only adds what to build next and how it is accepted.

| WO | Title | Depends on | Target |
| --- | --- | --- | --- |
| [WO-001](WO-001-monorepo-scaffold.md) | Monorepo and directory scaffolding | PR #1 merged (bundle) | Oct 16 |
| [WO-002](WO-002-scenes-and-tokens.md) | Shared SVG scene components reading tokens | WO-001 | Oct 20 |
| [WO-003](WO-003-enclose-prototype.md) | Enclose prototype: 30 s Short + Perspective Picker. **Start with the [motion preview](WO-003-motion.md).** | WO-002 | Preview first, then Oct 21 demo |
| [WO-004](WO-004-slide-scenes.md) | Slide lens (等積変形): parallel-band figure and its scenes | WO-003 step 2 | Oct 27 |
| [WO-005](WO-005-mirror-scenes.md) | Mirror lens (折り返す): shortest-path figure and its scenes | WO-004 | Oct 30 |
| [WO-006](WO-006-word-problem-scenes.md) | Area (面積図) and Constant (差一定): word-problem diagrams | WO-004 | Nov 2 |

## Rules for every WO

1. **One PR per WO**, branch `builder/wo-00N-short-name`, title starting `WO-00N:`. Small follow-up PRs are fine; never mix two WOs in one PR.
2. **Architect-owned paths:** `cards/`, `labels/`, `schema/`, `tools/`, `tokens/`. Do not edit them. If you need a field, a token or a bundle change, open an issue labelled `architect` and keep going with a clearly marked stub.
3. **The bundle is the only data source.** Apps import `build/bundle.json` (contract: `docs/PRD.md` §5). Never read YAML in the apps, never hard-code a card's numbers or Japanese text, never re-compute an answer.
4. **Tokens are the only style source.** No hex colours, font names or stroke widths in components; read them from `tokens/tokens.json`.
5. **Merge rule:** the founder approves, the Builder merges. Merge a PR only when all three hold:
   - every check is green (**validate** and **apps**);
   - for app work, the Architect has posted a **visual check** on the PR (the Architect runs the build headless and sends the founder screenshots; AI sessions can't upload video, so no screen recording is required);
   - the founder has approved it. The founder approves verbally to the Architect or Coordinator, who records it as a PR comment starting **"✅ Approved by Brian"**. That comment is the approval; no GitHub review button is needed. PRs touching `cards/`, `schema/`, `tools/` or `tokens/` also need the Architect's sign-off.

   Use **Squash and merge**. Leave the merged branch in place: AI sessions can't delete branches, and leftover branches are harmless. If the PR shows a conflict, update the branch from `main`, wait for the checks to go green again, then merge.
6. **Keep it small.** No state libraries, no UI kits, no backend. React state, plain SVG, Vite, Remotion. Ask before adding any dependency not named in a WO. Approved so far: Vitest 4 (dev-only test runner, Node 20 compatible).

## Glossary

- **Card**: one problem (`cards/**/*.yaml`), shipped inside the bundle.
- **Variant**: a generated sibling of a card with new numbers and its own `lens_route.steps`.
- **Keyframe**: a named animation stage in `card.animation.keyframes` (for example `draw_box`).
- **Lens route / trap route**: the insight solution and the brute-force attempt, as ordered steps.
