# Builder work orders

Each work order (WO) is one PR. Read `docs/PRD.md` first; this folder only adds what to build next and how it is accepted.

| WO | Title | Depends on | Target |
| --- | --- | --- | --- |
| [WO-001](WO-001-monorepo-scaffold.md) | Monorepo and directory scaffolding | PR #1 merged (bundle) | Oct 16 |
| [WO-002](WO-002-scenes-and-tokens.md) | Shared SVG scene components reading tokens | WO-001 | Oct 20 |
| [WO-003](WO-003-enclose-prototype.md) | Enclose prototype: 30 s Short + Perspective Picker. **Start with the [motion preview](WO-003-motion.md).** | WO-002 | Preview first, then Oct 21 demo |

## Rules for every WO

1. **One PR per WO**, branch `builder/wo-00N-short-name`, title starting `WO-00N:`. Small follow-up PRs are fine; never mix two WOs in one PR.
2. **Architect-owned paths:** `cards/`, `schema/`, `tools/`, `tokens/`. Do not edit them. If you need a field, a token or a bundle change, open an issue labelled `architect` and keep going with a clearly marked stub.
3. **The bundle is the only data source.** Apps import `build/bundle.json` (contract: `docs/PRD.md` §5). Never read YAML in the apps, never hard-code a card's numbers or Japanese text, never re-compute an answer.
4. **Tokens are the only style source.** No hex colours, font names or stroke widths in components; read them from `tokens/tokens.json`.
5. **Merge rule:** the founder approves, the Builder merges. Merge a PR only when all three hold:
   - the **Validate Lens Cards** check is green;
   - a screen recording (or rendered MP4) is attached, for app work;
   - the founder has approved it. The founder approves verbally to the Architect or Coordinator, who records it as a PR comment starting **"✅ Approved by Brian"**. That comment is the approval; no GitHub review button is needed. PRs touching `cards/`, `schema/`, `tools/` or `tokens/` also need the Architect's sign-off.

   Use **Squash and merge**, then delete the branch. If the PR shows a conflict, update the branch from `main`, wait for the check to go green again, then merge.
6. **Keep it small.** No state libraries, no UI kits, no backend. React state, plain SVG, Vite, Remotion. Ask before adding any dependency not named in a WO.

## Glossary

- **Card**: one problem (`cards/**/*.yaml`), shipped inside the bundle.
- **Variant**: a generated sibling of a card with new numbers and its own `lens_route.steps`.
- **Keyframe**: a named animation stage in `card.animation.keyframes` (for example `draw_box`).
- **Lens route / trap route**: the insight solution and the brute-force attempt, as ordered steps.
