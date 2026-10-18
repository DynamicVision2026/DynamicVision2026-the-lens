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
UI walkthrough + screenshots (two built servers: one open, one with a pilot code):

```bash
pnpm build
PORT=8093 WAITLIST_DIR=/tmp/wl1 node dist-server/index.js &
PORT=8094 PILOT_CODE=kumo42 WAITLIST_DIR=/tmp/wl2 node dist-server/index.js &
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/screens.py   # → docs/screens/*.png (390×844)
```

The script seeds three earlier 小5 pages into IndexedDB (sample problems, no photos) so the map shows red, green and gold tiles, then runs the real snap → confirm → save flow on fixture p01.

## Environment variables

| Var | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8080` | Listen port (Cloud Run sets it) |
| `ANTHROPIC_API_KEY` | — | When set, the Claude reader is used; when absent, the MockReader |
| `READER` | auto | Force `mock` or `claude` |
| `READER_MODEL` | `claude-sonnet-5` | Model id for the Claude reader (set a Haiku id to compare) |
| `PILOT_CODE` | — | When set, `/api/read` needs header `x-pilot-code` equal to it (constant-time compare) → else 403 `{error:"pilot_code"}`. `/api/health` reports `pilotGate: true` and the app asks for 「招待コード」. Landing + waitlist stay open. |
| `READ_PER_IP_HOUR` | `20` | `/api/read` per client per rolling hour → 429 `{error:"rate_limited"}` |
| `READ_DAILY_CAP` | `300` | `/api/read` for everyone per UTC day (resets 00:00 UTC) → 429 `{error:"daily_cap"}` |
| `WAITLIST_DIR` | — | When set, each signup is its own file `<dir>/<ISO time with : → ->-<random>.json` (folder created if missing). Safe on a Cloud Storage FUSE mount (no appends). Wins over `WAITLIST_PATH`. |
| `WAITLIST_PATH` | `./data-private/waitlist.jsonl` | JSONL file the waitlist appends to when `WAITLIST_DIR` is not set (git-ignored) |

`/api/waitlist` is limited to 10 signups per client per hour (fixed, not configurable).
Client = first address in `x-forwarded-for`, else the socket address.
**Limits are counted in memory, so run exactly one instance** (`--max-instances 1`, as `deploy.sh` does); a restart resets the counters.

Waitlist → CSV (either storage format; subfolders are walked):

```bash
node scripts/waitlist-export.mjs ./wl > waitlist.csv              # a WAITLIST_DIR copy
node scripts/waitlist-export.mjs data-private/waitlist.jsonl > waitlist.csv
# columns: email,grade,worry,variant,src,at  (sorted by at; old rows without src → direct)
```

## Deploy to Cloud Run

From the repo root in Cloud Shell: `bash apps/snap/deploy.sh <lens-project-id> [--set-key]`.
It builds `apps/snap/Dockerfile` (repo-root context, workspace lockfile) with Cloud Build, creates the pilot-code secret and the waitlist bucket, mounts the bucket at `/data` (uid 1000), and deploys with `--max-instances 1`, `PILOT_CODE` + `ANTHROPIC_API_KEY` from Secret Manager and `READER_MODEL`, `READ_PER_IP_HOUR`, `READ_DAILY_CAP`, `WAITLIST_DIR=/data/waitlist`. Without the key secret the service runs on the MockReader.

## Architecture (10 lines)

1. One package `@lens/snap`: Vite + React 19 SPA (`src/`) and a Hono Node server (`server/`), bundled by esbuild to `dist-server/`.
2. `data/units.json` → `src/curriculum.ts`: 110 units with stable ids (`5-C3`, `j2-A1`, `h-I-3`), `unitsForGrade`, `unitById`, `UNITS_BY_GRADE`.
3. Reader list for a page = the grade's units + the previous grade's (review pages mix in last year's units); anything else → `null`.
4. `Reader` interface; `ClaudeReader` (one Messages API call, sharp downscale ≤1600 px, prompt in `src/reader/prompt.ts`); `MockReader` (fixture outputs matched by photo SHA-256).
5. `toPageResult()` (zod) normalises snake/camel case, marks (×/〇…), renumbers problems by order, nulls out-of-grade units.
6. `POST /api/read` (multipart image + grade) → PageResult; nothing is stored or logged. Order: pilot code → per-IP limit → validation → daily cap (counts only calls that reach the model) → reader. `POST /api/waitlist` → per-IP limit → zod → `server/waitlist-store.ts` (one file per signup in `WAITLIST_DIR`, else JSONL append). Limits: `server/limits.ts` (pure, injectable clock).
7. Browser: photo downscaled client-side (upload ≤1600 px, thumbnail ≤900 px); pages + thumbnails saved in IndexedDB only (`src/lib/store.ts`).
8. `src/lib/review.ts`: pure functions for マップ tiles, テスト前リスト (✕ + low-confidence < 0.6, unless marked ○) and readiness %. Tile status in order: **gold** (newest page with this unit has ≥1 problem there and all of them teacher-○; null ≠ ○; 「復習した」 never makes gold) → **review** (unreviewed ✕) → **ok** → **empty**. `mapSections` = all 110 units by grade, own grade first.
9. Screens: `/` landing + waitlist (hero A/B: `?h=default|a|b|c` wins; otherwise a random variant kept sticky in localStorage; `?src=yt|x|tiktok|survey|book|other`, unknown → other, missing → direct; both saved with the signup), `/privacy`, `/app` (招待コード if gated) → grade, 撮る → 確認 → 保存 → マップ with the saved units lit (`/app/map?saved=N&lit=5-C3,…`: 1.5 s glow, scroll into view, toast, their grade section opened; no animation with reduced motion), テスト前リスト, ふりかえり (filter + delete). Snap screen shows Japanese messages for 429 / daily cap and re-asks the code on 403 (then re-sends the same photo).
10. All copy in `src/copy.ts` (`copy` = final landing copy, `app` = in-app UI); all colours in `theme/tokens.css` (the only file with hex literals).

## In the monorepo (apps/snap)

- Package `@lens/snap` in the-lens workspace; no `@lens/*` deps. Vite 8 / plugin-react 6 / esbuild 0.28.1 / vitest 4.1.11 match the trainer. Installs use the root `pnpm-lock.yaml` (no per-app lockfile).
- Hex-literal whitelist: **`theme/tokens.css`** (outside `src/`). `src/` contains no hex literals.
- Image: `apps/snap/Dockerfile`, built from the repo root (`docker build -f apps/snap/Dockerfile .`): frozen install of `@lens/snap...` → build → `pnpm deploy --prod` → runtime image. See `docs/DEPLOY.md`.

## Eval (mock reader, 18 Oct 2026)

72/72 problems found, CER 0.1%, unit 100%, mark 100%, answer 97.2% (p08 `30.58` vs truth `30,58`; h06 faint digit), h03 → RETAKE.
CER ignores `[figure]` notes (the prompt asks for them; truth text does not include them).

## Known gaps

- **Claude reader not run here** (no key in this environment): implemented and type-checked only. Verify `READER_MODEL` default `claude-sonnet-5` is a valid model id before launch, then run `pnpm eval --reader claude`.
- **Waitlist on Cloud Run**: durable only with `WAITLIST_DIR` on the bucket mount (deploy.sh does this). The `WAITLIST_PATH` default in the image (`/tmp`) is lost on restart.
- `docker build` was not run here (Docker Hub is blocked from this sandbox). The Dockerfile steps (frozen install of `@lens/snap...` → build → `pnpm deploy --prod` → run from only the runtime files) were replayed in a clean checkout and the server answered `/` and `/api/read`; Cloud Build runs the real image build on first deploy.
- "Photo crop" is the whole-page thumbnail: the reader returns no per-problem bounding boxes yet.
- HEIC photos on non-Safari browsers are uploaded as-is; the MockReader ignores format, sharp may not decode HEIC in the Claude path.
- **Per-IP limit trusts the first `x-forwarded-for` entry**, which a client can set itself (Google's front end appends the real address after it). A determined user can rotate it to dodge `READ_PER_IP_HOUR`; the global `READ_DAILY_CAP` and the pilot code still bound spend. If abuse appears, key on the last-but-one entry instead.
- Limits reset on every restart / new revision (in memory by design).
- Gold is decided from the page marks; the user can still toggle ○/✕ on the confirm screen, so "proven on a test" relies on the user keeping the teacher's marks. Pages of any type (test/drill/note) count; restricting gold to `pageType: "test"` is a one-line change if wanted.
- Landing: `{CONTACT_EMAIL}` not set, so the footer contact line is omitted; `/privacy` is built only from existing copy (no full legal policy yet).
- Anthropic SDK 0.32 triggers a harmless Node `punycode` deprecation warning; upgrading the SDK will remove it.
