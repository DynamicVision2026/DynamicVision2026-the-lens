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

The script seeds four earlier pages into IndexedDB (sample problems, no photos) so the star chart shows red, green, gold and grey stars in 小5 and a few in 小4, then runs the real snap → confirm → save flow on fixture p01, the sheet, 一覧, backup / restore, an offline reload through the service worker, both install tips and the pilot-code flow. Restart both servers after every `pnpm build` (the server keeps index.html in memory).

Icons: `node scripts/icons.mjs` (from apps/snap) regenerates `public/icon.svg` and `public/icons/*.png` from one SVG mark (sharp). The PNGs are committed.

## Environment variables

| Var | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8080` | Listen port (Cloud Run sets it) |
| `ANTHROPIC_API_KEY` | — | When set, the Claude reader is used; when absent, the MockReader |
| `READER` | auto | Force `mock` or `claude` |
| `READER_MODEL` | `claude-haiku-5-5` | Model id for the Claude reader; set `claude-sonnet-5-5` for higher accuracy |
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

## Architecture

1. One package `@lens/snap`: Vite + React 19 SPA (`src/`) and a Hono Node server (`server/`), bundled by esbuild to `dist-server/`.
2. `data/units.json` → `src/curriculum.ts`: 110 units with stable ids (`5-C3`, `j2-A1`, `h-I-3`), `unitsForGrade`, `unitById`, `UNITS_BY_GRADE`.
3. Reader list for a page = the grade's units + the previous grade's (review pages mix in last year's units); anything else → `null`.
4. `Reader` interface; `ClaudeReader` (one Messages API call, sharp downscale ≤1600 px, prompt in `src/reader/prompt.ts`); `MockReader` (fixture outputs matched by photo SHA-256).
5. `toPageResult()` (zod) normalises snake/camel case, marks (×/〇…), renumbers problems by order, nulls out-of-grade units.
6. `POST /api/read` (multipart image + grade) → PageResult; nothing is stored or logged. Order: pilot code → per-IP limit → validation → daily cap (counts only calls that reach the model) → reader. `POST /api/waitlist` → per-IP limit → zod → `server/waitlist-store.ts` (one file per signup in `WAITLIST_DIR`, else JSONL append). Limits: `server/limits.ts` (pure, injectable clock).
7. Browser: photo downscaled client-side (upload ≤1600 px, thumbnail ≤900 px); pages + thumbnails saved in IndexedDB only (`src/lib/store.ts`).
8. `src/lib/review.ts`: pure functions for マップ tiles, テスト前リスト (✕ + low-confidence < 0.6, unless marked ○) and readiness %. Tile status in order: **gold** (newest page with this unit has ≥1 problem there and all of them teacher-○; null ≠ ○; 「復習した」 never makes gold) → **review** (unreviewed ✕) → **ok** → **empty**. `mapSections` = all 110 units by grade, own grade first.
9. Screens (see also 11–13 below): `/` landing + waitlist (hero A/B: `?h=default|a|b|c` wins; otherwise a random variant kept sticky in localStorage; `?src=yt|x|tiktok|survey|book|other`, unknown → other, missing → direct; both saved with the signup), `/privacy`, `/app` (招待コード if gated) → grade, 撮る → 確認 → 保存 → マップ with the saved units lit (`/app/map?saved=N&lit=5-C3,…`: 1.5 s glow, scroll into view, toast, their grade section opened; no animation with reduced motion), テスト前リスト, ふりかえり (filter + delete). Snap screen shows Japanese messages for 429 / daily cap and re-asks the code on 403 (then re-sends the same photo).
10. All copy in `src/copy.ts` (`copy` = final landing copy, `app` = in-app UI); all colours in `theme/tokens.css` (the only file with hex literals; `public/` and `index.html` carry the manifest / theme colours).
11. **単元星図** (`src/lib/starmap.ts`, pure + tested; `src/components/StarMap.tsx`): four lanes 数と計算 / 図形 / 変化と関係 / データ, grade bands rising upward (小1 bottom, 高校 top). 小・中 lane = 領域 letter (小1–3 C 測定 → 変化と関係); 高校 = the documented `HIGH_SCHOOL_LANES` table. Roots (`rootsOf`): same lane, nearest lower grade that has that lane, up to 3, ranked by shared kanji/katakana words in topic + covers (identical topic counts most), two hand fixes in `ROOT_OVERRIDES`; no shared word → that grade's lane units (up to 3). Near vs far sky: the child's grade and the grade below are near (every star a 44 px button with its label; each lane's stack hangs from the top of its band, first unit lowest); every other band is far: one compact 46 px row, each lane's stars side by side, no labels, the whole band one button that opens it (one opened band at a time, 「たたむ」 closes it; a lit unit or a root picked in the sheet opens its band). Marks: red / teal 14 px dots with a soft glow (red keeps a halo ring), gold 24 px four-point star with flare, grey a tiny faint dot; labels of empty units smaller and dimmer than those of units with data. One SVG (own band + faint radial lift, faint band lines, sparse star dust, root curves, far stars) + absolutely positioned buttons. Root lines are single quadratic curves bowing left (wider when another star sits on the straight way) and are drawn only with meaning: each unit with data → its strongest root, softly, inside the same sky (near→near, far→far); the open star's whole root path brightly; the light-up's roots. Tap → bottom sheet (code, counts, 状態, もとになる単元 tappable, 「この単元の問題を見る」), root path bright, rest dimmed; Esc / × / tap the sky closes. After 保存 (`?lit=`): lit stars flare 1.2 s and their root lines draw down once (1 s); reduced motion → static highlight only. Header: legend, own-grade counts, 「星図 / 一覧」 toggle (remembered in localStorage); 一覧 = the v0 tile view unchanged. Sky colours: `--sky-*` tokens (contrast notes in tokens.css).
12. **Home screen + offline**: `public/manifest.webmanifest` (start_url `/app`, standalone, ja), icons, apple meta tags in `index.html`. `public/sw.js` (hand-written, registered only in production builds by `src/lib/pwa.ts`): install caches index.html + the hashed assets it references; navigations network-first → cached shell offline; `/assets/*` cache-first; `/api/*` never touched; cache `lens-snap-v1`, older `lens-snap-*` caches deleted on activate, unused hashed assets pruned after each fresh index.html. The server sends the manifest as `application/manifest+json` and `sw.js` with `Cache-Control: no-cache`.
13. **Data safety**: after the first 保存, `navigator.storage.persist()` once (result in localStorage `lens-snap:persist`). Install tip on 撮る after the first 保存 (not in standalone): iPhone/iPad Safari → share-button steps; Android/Chrome → captured `beforeinstallprompt` → 「ホーム画面に追加」 button; 閉じる is remembered. ふりかえり → バックアップ: `lens-snap-backup-YYYYMMDD.json` (`{app, version: 1, exportedAt, grade, pages}` with photos as base64); restore validates with zod (`src/lib/backup.ts`), merges by page id in one IndexedDB transaction (existing pages win), reports 「◯ページを戻しました」; last backup date shown, reminder when never / > 14 days with ≥ 1 page.

## In the monorepo (apps/snap)

- Package `@lens/snap` in the-lens workspace; no `@lens/*` deps. Vite 8 / plugin-react 6 / esbuild 0.28.1 / vitest 4.1.11 match the trainer. Installs use the root `pnpm-lock.yaml` (no per-app lockfile).
- Hex-literal whitelist: **`theme/tokens.css`** (outside `src/`). `src/` contains no hex literals.
- Image: `apps/snap/Dockerfile`, built from the repo root (`docker build -f apps/snap/Dockerfile .`): frozen install of `@lens/snap...` → build → `pnpm deploy --prod` → runtime image. See `docs/DEPLOY.md`.

## Eval (mock reader, 18 Oct 2026)

72/72 problems found, CER 0.1%, unit 100%, mark 100%, answer 97.2% (p08 `30.58` vs truth `30,58`; h06 faint digit), h03 → RETAKE.
CER ignores `[figure]` notes (the prompt asks for them; truth text does not include them).

## v0.1 (19 Oct 2026): star chart + home screen + backup

Tests: 74 (vitest, 10 files; new: `starmap.test.ts` 17, `backup.test.ts` 4, `sw.test.ts` 4). Screenshots added: `07-saved-lit` (mid-flare), `08-starmap` (near 小5/小4, far bands, red 小3 and gold 小6 visible from afar), `08s-starmap-sheet`, `08e-starmap-expanded` (小3 opened), `08l-map-list`, `15-install-tip`, `16-backup` (old `08-map` / `08b-map-other-grade` removed: the tile view is now `08l`).

## Known gaps

- **Claude reader not run here** (no key in this environment): implemented and type-checked only. Default `READER_MODEL` is `claude-haiku-5-5` (`claude-sonnet-5-5` as the higher-accuracy option); run `pnpm eval --reader claude` with each before launch.
- **Waitlist on Cloud Run**: durable only with `WAITLIST_DIR` on the bucket mount (deploy.sh does this). The `WAITLIST_PATH` default in the image (`/tmp`) is lost on restart.
- `docker build` was not run here (Docker Hub is blocked from this sandbox). The Dockerfile steps (frozen install of `@lens/snap...` → build → `pnpm deploy --prod` → run from only the runtime files) were replayed in a clean checkout and the server answered `/` and `/api/read`; Cloud Build runs the real image build on first deploy.
- "Photo crop" is the whole-page thumbnail: the reader returns no per-problem bounding boxes yet.
- HEIC photos on non-Safari browsers are uploaded as-is; the MockReader ignores format, sharp may not decode HEIC in the Claude path.
- **Per-IP limit trusts the first `x-forwarded-for` entry**, which a client can set itself (Google's front end appends the real address after it). A determined user can rotate it to dodge `READ_PER_IP_HOUR`; the global `READ_DAILY_CAP` and the pilot code still bound spend. If abuse appears, key on the last-but-one entry instead.
- Limits reset on every restart / new revision (in memory by design).
- Gold is decided from the page marks; the user can still toggle ○/✕ on the confirm screen, so "proven on a test" relies on the user keeping the teacher's marks. Pages of any type (test/drill/note) count; restricting gold to `pageType: "test"` is a one-line change if wanted.
- Landing: `{CONTACT_EMAIL}` not set, so the footer contact line is omitted; `/privacy` is built only from existing copy (no full legal policy yet).
- Far → near root lines are not drawn softly (they would run through a whole stack); they appear on the selected path and the light-up. Some near curves in the 8-unit 数と計算 stacks still run long beside the stars.
- **Star chart roots are heuristic** (shared words + 2 hand fixes) and stop at the nearest lower grade: 高校 units all root into 中3 (e.g. 微分法 ← 関数 y = ax²), not into each other (数学II → III). A curated root table would be the next step if families use the sheet.
- Star labels show up to 3 short lines (10–10.5 px); the longest topic (小3 二等辺三角形・正三角形、角、円と球) is cut with 「…」 on the chart and shown in full in the sheet.
- The service worker was checked in Chromium (Playwright: offline reload of `/app/map` works, no `/api` entries in the cache) and in a unit test; not yet on a real iPhone. iOS may still clear site data for web pages not added to the home screen, which is why the install tip and backup exist.
- `navigator.storage.persist()` is a request; Chrome may decline it for sites that are not installed or bookmarked. The result is stored but not shown.
- Anthropic SDK 0.32 triggers a harmless Node `punycode` deprecation warning; upgrading the SDK will remove it.
