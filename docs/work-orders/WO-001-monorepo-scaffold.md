# WO-001 · Monorepo and directory scaffolding

**Owner:** Builder · **Reviewer:** Product Architect · **Target:** Oct 16, 2026 · **Depends on:** PR #1 merged

## Goal

A fresh clone installs and builds both apps with three commands, and the trainer can list the cards in `build/bundle.json`.

## Scope

Create this layout as a pnpm workspace. Content folders already exist; do not move them.

```
package.json            root scripts (below), "private": true, "packageManager": "pnpm@9"
pnpm-workspace.yaml     apps/*, packages/*
tsconfig.base.json      strict, ES2022, moduleResolution "bundler", resolveJsonModule
.nvmrc                  20
apps/trainer/           Vite + React + TypeScript
apps/shorts/            Remotion + React + TypeScript
packages/scenes/        shared SVG scene components (filled in WO-002)
  src/index.ts          exports (empty placeholders are fine here)
  src/types.ts          TypeScript types for the bundle (below)
cards/ schema/ tokens/ tools/ docs/   unchanged
```

**Root scripts**

| Script | Does |
| --- | --- |
| `pnpm bundle` | `python3 tools/validate.py cards/**/*.yaml --bundle` (run through bash with globstar) |
| `pnpm dev:trainer` | Vite dev server for `apps/trainer` |
| `pnpm dev:shorts` | Remotion Studio for `apps/shorts` |
| `pnpm typecheck` | `tsc --noEmit` across the workspace |
| `pnpm build` | builds `apps/trainer` to `apps/trainer/dist` |

**Bundle types** in `packages/scenes/src/types.ts`, matching `docs/PRD.md` §5 and `schema/lens-card.schema.json`: `Bundle`, `LensCard`, `Variant`, `Route`, `Step` (`op: 'start' | 'add' | 'sub' | 'result' | 'note'`), `Picker`, `Tokens`. Exact numbers stay `string`.

**Bundle loading:** both apps import `../../build/bundle.json` through a single module, `packages/scenes/src/bundle.ts`, which exports `loadBundle(): Bundle`, `getCard(id)`, `getVariants(id)`. If the file is missing at build time, fail with the message "Run `pnpm bundle` first".

**Trainer placeholder page:** `/` lists every card id, lens and `display_ja` answer from the bundle. No styling work yet.

**CI:** add a second job `apps` to `.github/workflows/validate-cards.yml` that needs the validate job, sets up Python and Node 20, runs `pnpm install --frozen-lockfile`, `pnpm bundle`, `pnpm typecheck`, `pnpm build`. Ask the Architect to review this one workflow change.

## Acceptance

- [ ] On a fresh clone: `pnpm install && pnpm bundle && pnpm build` succeeds.
- [ ] `pnpm dev:trainer` shows all 5 Enclose card ids with answers 19.5, 29, 14, 26, 17.5 cm².
- [ ] `pnpm dev:shorts` opens Remotion Studio with one empty 1080×1920, 30 fps composition named `EncloseShort`.
- [ ] `pnpm typecheck` passes with `strict: true`.
- [ ] `build/` and `node_modules/` stay git-ignored; `pnpm-lock.yaml` is committed.
- [ ] No files under `cards/`, `schema/`, `tokens/`, `tools/` changed.

## Out of scope

Styling, scenes, the picker, deployment. Cloudflare Pages is connected by the founder after this merges (build command `pnpm bundle && pnpm build`, output `apps/trainer/dist`).
