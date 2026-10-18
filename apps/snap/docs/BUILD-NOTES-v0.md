# Lens Snap v0 — build notes (WO-001)

## Run locally

```bash
corepack enable            # pnpm 9.15.9 (pinned in package.json)
pnpm install
pnpm dev                   # API on :8080 (tsx watch) + Vite on :5173 (proxies /api)
# or the production build:
pnpm build && pnpm start   # one server on :8080 serving dist/ + /api/*
```

Checks: `pnpm test` (vitest), `pnpm typecheck`, `pnpm eval --reader mock` (or `--reader claude` with a key).
UI walkthrough + screenshots: start the built server on :8093, then
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/screens.py` → `docs/screens/*.png` (390×844).

## Environment variables

| Var | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8080` | Listen port (Cloud Run sets it) |
| `ANTHROPIC_API_KEY` | — | When set, the Claude reader is used; when absent, the MockReader |
| `READER` | auto | Force `mock` or `claude` |
| `READER_MODEL` | `claude-sonnet-5` | Model id for the Claude reader (set a Haiku id to compare) |
| `WAITLIST_PATH` | `./data-private/waitlist.jsonl` | JSONL file the waitlist appends to (git-ignored) |

## Deploy to Cloud Run

```bash
# one-time: store the key as a secret
printf '%s' "$ANTHROPIC_API_KEY" | gcloud secrets create anthropic-api-key --data-file=-
gcloud secrets add-iam-policy-binding anthropic-api-key \
  --member="serviceAccount:$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor

# deploy (builds the Dockerfile in this folder with Cloud Build)
gcloud run deploy lens-snap --source . --region asia-northeast1 \
  --allow-unauthenticated --memory 512Mi \
  --set-secrets ANTHROPIC_API_KEY=anthropic-api-key:latest \
  --set-env-vars READER_MODEL=claude-sonnet-5
```

Without `--set-secrets` the service runs on the MockReader (good for a demo URL).
The Dockerfile is self-contained (build context = this folder; uses `pnpm-lock.yaml` when present).

## Architecture (10 lines)

1. One package `@lens/snap`: Vite + React 19 SPA (`src/`) and a Hono Node server (`server/`), bundled by esbuild to `dist-server/`.
2. `data/units.json` → `src/curriculum.ts`: 110 units with stable ids (`5-C3`, `j2-A1`, `h-I-3`), `unitsForGrade`, `unitById`, `UNITS_BY_GRADE`.
3. Reader list for a page = the grade's units + the previous grade's (review pages mix in last year's units); anything else → `null`.
4. `Reader` interface; `ClaudeReader` (one Messages API call, sharp downscale ≤1600 px, prompt in `src/reader/prompt.ts`); `MockReader` (fixture outputs matched by photo SHA-256).
5. `toPageResult()` (zod) normalises snake/camel case, marks (×/〇…), renumbers problems by order, nulls out-of-grade units.
6. `POST /api/read` (multipart image + grade) → PageResult; nothing is stored or logged. `POST /api/waitlist` → zod-validated JSONL append.
7. Browser: photo downscaled client-side (upload ≤1600 px, thumbnail ≤900 px); pages + thumbnails saved in IndexedDB only (`src/lib/store.ts`).
8. `src/lib/review.ts`: pure functions for マップ tiles, テスト前リスト (✕ + low-confidence < 0.6, unless marked ○) and readiness %.
9. Screens: `/` landing + waitlist (hero A/B via `?h=a|b|c`, saved as `variant` in the JSONL), `/privacy`, `/app` grade onboarding, 撮る → 確認 → 保存, マップ, テスト前リスト, ふりかえり (filter + delete).
10. All copy in `src/copy.ts` (`copy` = final landing copy, `app` = in-app UI); all colours in `theme/tokens.css` (the only file with hex literals).

## Monorepo drop-in (apps/snap)

- Package name `@lens/snap`, scripts `dev/build/test/typecheck/eval`, TS ~5.9.3, vitest 4.1.11, React ^19.2.0, Node ≥20.19, pnpm 9.15.9. No pnpm-workspace.yaml; no `@lens/*` deps.
- Hex-literal whitelist: **`theme/tokens.css`** (outside `src/`). `src/` contains no hex literals.
- Delete this folder's `pnpm-lock.yaml` after the move (the Dockerfile falls back to `pnpm install`), or keep it for a standalone image build.

## Eval (mock reader, 18 Oct 2026)

72/72 problems found, CER 0.1%, unit 100%, mark 100%, answer 97.2% (p08 `30.58` vs truth `30,58`; h06 faint digit), h03 → RETAKE.
CER ignores `[figure]` notes (the prompt asks for them; truth text does not include them).

## Known gaps

- **Claude reader not run here** (no key in this environment): implemented and type-checked only. Verify `READER_MODEL` default `claude-sonnet-5` is a valid model id before launch, then run `pnpm eval --reader claude`.
- **Waitlist on Cloud Run is ephemeral** (container filesystem, per instance). Before real traffic, mount a Cloud Storage volume and point `WAITLIST_PATH` at it, or set max-instances 1 and export often.
- `docker build` was not completed here: Docker Hub is blocked from this sandbox (`node:22-slim` pull → 403). The exact Dockerfile steps (frozen install → build → `pnpm prune --prod` → run with only runtime files) were replayed in a clean directory and the server answered `/api/read`.
- "Photo crop" is the whole-page thumbnail: the reader returns no per-problem bounding boxes yet.
- HEIC photos on non-Safari browsers are uploaded as-is; the MockReader ignores format, sharp may not decode HEIC in the Claude path.
- No rate limit on `/api/read` (anyone with the URL can spend API credits). Add Cloud Run max-instances and a simple per-IP limit before publicising.
- Landing: `{CONTACT_EMAIL}` not set, so the footer contact line is omitted; `/privacy` is built only from existing copy (no full legal policy yet).
- Anthropic SDK 0.32 triggers a harmless Node `punycode` deprecation warning; upgrading the SDK will remove it.
