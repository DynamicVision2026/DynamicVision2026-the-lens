# 視点レンズ (The Lens) — content repo

Single source of truth for The Lens. Every problem is one Lens Card (YAML). The web trainer, the Shorts renderer and the Typst book all read from here.

**Start here:** [`docs/PRD.md`](docs/PRD.md) — Phase 1 PRD & architecture spec (roles, data flow, trainer specs, card rules, sprint plan, Gate 1 checklist).

```
docs/PRD.md                    Phase 1 PRD & architecture spec
.github/workflows/             CI: validates every card on push and PR
schema/lens-card.schema.json   card schema v1.0
cards/enclose/*.yaml           Enclose (囲む) reference cards
tokens/tokens.json             visual tokens for web, video and print
tools/validate.py              schema + SymPy checks + variant generation
build/variants/*.json          generated variants (do not edit by hand)
```

## Validate

```
pip install -r requirements.txt
python3 tools/validate.py cards/enclose/*.yaml --variants
```

Exit code is non-zero if any card fails. Renderers only read cards whose status is `verified` or later, and CI runs this on every push.

## Card rules

1. `provenance.original` is always `true`. Coordinates, wording and figures are written from an archetype, never adapted from an exam, textbook or 塾 problem.
2. Every lens ships with at least one `failure` card and feeds `no_lens` cards into mixed sets (about 1 in 5).
3. `time_cost_sec` starts as `estimate` and becomes `tester_median` once real children have been timed.
4. A variant is kept only if it passes the same structural checks as its parent, so it still needs the same move.

## Status flow

`draft` → `verified` (validator passes) → `reviewed` (independent math + Japanese review) → `published`
