# Lens Snap v0 — build notes (WO-001)

## Run locally

```bash
corepack enable            # pnpm 9.15.9 (pinned in package.json)
pnpm install
pnpm dev                   # API on :8080 (tsx watch) + Vite on :5173 (proxies /api)
# or the production build:
pnpm build && pnpm start   # one server on :8080 serving dist/ + /api/*
```

Checks: `pnpm test` (vitest), `pnpm typecheck`, `pnpm eval --reader mock` (or `--reader claude` with a key), `pnpm eval:units` (unit tagging, text only; `--reader claude` with a key — see README for the Cloud Shell one-liner).
UI walkthrough + screenshots (three built servers: one open, one with a pilot code, one for the founder's journey):

```bash
pnpm build
PORT=8093 WAITLIST_DIR=/tmp/wl1 node dist-server/index.js &
PORT=8094 PILOT_CODE=kumo42 WAITLIST_DIR=/tmp/wl2 node dist-server/index.js &
PORT=8095 MOCK_FALLBACK=live4 WAITLIST_DIR=/tmp/wl3 node dist-server/index.js &   # J* journey (the live 4年 sheet)
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/screens.py   # → docs/screens/*.png (390×844)
```

The script seeds four earlier pages into IndexedDB (sample problems, no photos) so the star chart shows red, green, gold and grey stars in 小5 and a few in 小4, then runs the real snap → confirm → save flow on fixture p01, the sheet, 一覧, backup / restore, an offline reload through the service worker, both install tips and the pilot-code flow. Restart all three servers after every `pnpm build` (the server keeps index.html in memory). Run them without `ANTHROPIC_API_KEY` (or with `READER=mock`).

Icons: `node scripts/icons.mjs` (from apps/snap) regenerates `public/icon.svg` and `public/icons/*.png` from one SVG mark (sharp). The PNGs are committed.

## Environment variables

| Var | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8080` | Listen port (Cloud Run sets it) |
| `ANTHROPIC_API_KEY` | — | When set, the Claude reader is used; when absent, the MockReader |
| `READER` | auto | Force `mock` or `claude` |
| `MOCK_FALLBACK` | `p01` | Mock reader only: fixture id answered for a photo it cannot match by hash (the browser re-encodes large uploads, so a journey run pins its page this way, e.g. `live4`) |
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

## v0.2 (19 Oct 2026): 学習レポート + 念のため

- **テスト前リスト 念のため**: `splitTestList()` in `review.ts` puts the ✕ / low-confidence problems of gold (マスター) units into a collapsed `<details>` 「念のため（最新のページでは全問○の単元）」 with a count (same card, same 「復習した」 tick); the main list keeps every other unit unchanged. `readiness()` no longer counts gold units' old ✕ as pending. Main list empty but 念のため not → 「選んだ単元で、今夜やる問題はありません。念のための見直しは下にあります。」. `?units=5-C3,5-D2` selects exactly those units (parsed like `?lit=`); `?unit=` still works.
- **学習レポート** (`/app/report`, `src/screens/Report.tsx`, pure logic in `src/lib/report.ts`): light theme; title + 最後に撮った日 / page count; one segmented bar of the child's grade units (マスター / 復習ずみ / 復習が必要 / まだ, light map colours, `role="img"` with the counts as its label, plus a text line with swatches; zero states omitted); 次にやること (red units of the grade, most open ✕ first, up to 3, one button → `/app/list?units=…`); 前の学年で気になる単元 (red units of earlier grades, nearest grade first, up to 3; `supports` = the child's-grade unit whose star-chart root path reaches it, red preferred, e.g. 小3 除法 → 小5「整数の性質」のもと; none known → no arrow line); この1週間 (pages / problems / ✕ saved in the last 7 days by createdAt); unit chips for マスター / 復習が必要 / 復習ずみ (まだ only counted) → that unit's list; link to the map. No pages → a card explaining the four states + 「ページを撮る」.
- **App home**: `/app` (and unknown `/app/*`) → `/app/report` when pages exist, `/app/snap` when none; choosing a grade goes through the same redirect. After 保存 the map + toast stay; the toast now carries 「レポートを見る」. (v0.3: home is now the map.)
- **Tab bar**: 5 tabs (撮る / レポート / マップ / テスト前 / ふりかえり), 24 px line icons in `currentColor` (inline SVG in `App.tsx`), 0.72rem labels, no wrap at 390 px. (v0.3: back to 4 tabs.)
- New token `--c-empty-strong` (まだ in the report bar).

Tests: 82 (11 files; new `report.test.ts` 8: 念のため split, readiness, unchanged non-gold units, state counts, next-to-do order, earlier-grade reds with supported unit, last-7-days, empty). Screenshots added: `17-report`, `17e-report-empty`, `09n-test-list-nennotame`. `screens.py` computes the この1週間 expectation from today's date (the seed pages are fixed dates).

## v0.3 (19 Oct 2026): the 単元マップ is home

Founder decision: the star chart is the main dashboard for parents and students; everything links from it.

- **Home + tabs** (`src/lib/home.ts`, pure + tested): `/app` → `/app/map` when pages exist, `/app/snap` when none (`homePath`); choosing a grade goes through the same redirect. Tabs back to four (`APP_TABS`: 撮る / マップ / テスト前 / ふりかえり); `/app/report` still works and keeps マップ lit (`activeTab`). The レポート tab icon is gone.
- **Report strip** (`src/components/ReportStrip.tsx`) at the top of the map, inside the night sky (soft pane that fades into the sky, star colours): 「小5の15単元」, a 10 px bar (マスター / 復習ずみ / 復習が必要 / まだ, zero segments omitted, `role="img"` with the counts), a counts line that also serves as the legend (star glyph + word + number, all four states), 次にやること (up to 3 rows: red star, unit, ✕N問; tap → the star is selected, scrolled to and its sheet opened), 「テスト前リストで見る」 (same `?units=` link as the report) and 「学習レポートをくわしく見る」 on one line, and, when earlier grades have red units, 「前の学年に✕のある単元があります（N）」 (N = all of them, not capped at 3: `Report.earlierIds`). That line toggles: the nearest far band holding one opens (`earlierBand`) and every such star gets a dashed red ring (`is-marked`, also on far stars); tap again → rings off, band closed. 「たたむ」 folds the strip to one line (title + glyph counts + 「ひらく」), kept in localStorage `lens-snap:map-strip` (wrapped in try/catch via `readPref`/`writePref`). Strip data = `stripFromReport(buildReport(...))`: no numbers of its own.
- Merged: the old header text (「下から上へ…」), separate legend and own-grade summary line are gone; the strip's counts line is the legend. Header = 「単元マップ」 (smaller on the sky) + 星図 / 一覧. The strip shows in the 星図 view only; 一覧 keeps its v0 header.
- **Scroll on arrival**: plain load → top of the page (strip, then the chart down to the child's grade); `?lit=` → lit star centred (unchanged); `?unit=5-C3` → that star selected with its sheet open, its far band opened if needed (`focusFromParam`).
- **学習レポート**: 「‹ 単元マップにもどる」 at the top; 次にやること rows, 前の学年 rows and the unit chips open `/app/map?unit=…` (rows carry a ›); 「テスト前リストで見る」 still goes to the list.
- **Sheet**: footer = 「この単元の問題を見る」 + a small 「学習レポート」 link. After 保存 unchanged (map, lit stars, toast with 「レポートを見る」); the strip reflects the new page.
- **Upper grades merged** (`layoutStarmap(width, near, { grades: gradesAbove(grade), merged })`): every grade above the child's is one 46 px far row at the top, 「これから学ぶ単元（小6〜高校）」 (one grade → 「（高校）」; 高校 children have none): per lane, all those units side by side from the lowest grade, faint, coloured stars still visible, no root lines inside the row; the whole row is one button. Tap → a 34 px head row (label + 「たたむ」, aria 「これから学ぶ単元をたたむ」) and the upper grades as individual far bands again. A lit / `?unit=` star in an upper grade expands them automatically. Grades below stay individual far bands. The child's band now always starts 46 px under the lane header, so it is on the first screen for every grade (test: chrome budget 500 px + band head + one star row ≤ 780 px for all 12 grades). One-line hint under the lane headers: 「下の学年の単元が、上の学年の単元のもとになっています。」.
- New tokens: `--sky-strip`, `--sky-strip-fade`, `--sky-strip-edge`, `--sky-bar-empty`, `--sky-red-soft`.

Tests: 104 (12 files; `starmap.test.ts` +14 for the merged upper row: gradesAbove, own band right under it for every grade, 小2 / 小5 no overlaps + no flat lines + expanded bands, an opened upper grade never merged; new `home.test.ts` 8: home routing, 4 tabs, active tab on the report, `?unit=` near/far/unknown + its sheet, strip = report data, earlier ids uncapped + band, no-pages strip). Screenshots added: `18-map-home` (first screen at 390×844), `18c-map-home-collapsed`, `18e-map-earlier` (小3 opened, 4-A2 and 3-A4 ringed), `18u-map-unit-from-report` (`?unit=3-A4`), `18y-map-home-young` (a 小2 child: strip, merged 「これから学ぶ単元（小3〜高校）」, 小2 and 小1 on the first screen). `screens.py` now checks `/app` → map, the tabs, the strip, row → sheet, the earlier toggle, the fold surviving a reload, and the report's links to the map.

## v0.4 (19 Oct 2026): AI ○✕ + unit tagging accuracy

Founder decisions after the live iPhone test: (A) the engine judges ○/✕ itself; (B) first, the problem → unit link must be accurate.

- **Prompt** (`src/reader/prompt.ts`): each unit line still carries grade, code, topic and covers. New 「How to choose the unit」 block: decide by the mathematics tested, not surface words; compare with the covers; when two units fit, the child's grade wins unless the content is clearly below it; then the look-alike lines for this grade's list (`src/reader/lookalikes.ts`, 31 hand-made groups from `data/units.json`: 割合 4-C2 / 5-C3 / 6-C2, 5-C2 vs 5-C3, 比例 5-C1 / 6-C1 / j1-C1 / j2-C1 / j3-C1, 面積 4-B4 / 5-B3 / 6-B3 / 6-B2, 円周 vs 円の面積, 体積, 時刻 1-C2 / 2-C2 / 3-C2, 量の単位, 小数, 分数, 式, 方程式, グラフ, 代表値, 確率 …). Only the ids in the page's list are printed (tested for every grade); identical topic names not separated by a line get a "decide by the covers" line. Per problem the model now returns `unit_confidence`, `unit_alt`, `correct_answer` and `judge` (○ equal incl. equivalent forms; ✕ wrong / blank / 式 only; null undecidable). "Never correct the student's text" stays: `answer` and `mark` are as written; solving only fills `correct_answer` / `judge`. `readerPrompt(grade, "text")` = same prompt for a problem given as text.
- **Schema** (`toPageResult`): `unitConfidence` (0–1, else 0.8), `unitAlt` (in the allowed list and ≠ unit, else null), `correctAnswer`, `judge` (normalised like marks: 正解 / maru / true → ○, 不正解 / batsu / × / false → ✕; ✓ deliberately unmapped).
- **Final mark** (`src/lib/marks.ts`, pure): teacher's red mark → `teacher`; else `judge` → `ai`; else null. A tap on the confirm screen → `parent`. Saved problems carry `markSource` and `correctAnswer`; pages and backups without `markSource` read as `teacher` when a mark is set (`withMarkSources` in `allPages()` and `parseBackup`; backup version stays 1). Map, report, テスト前リスト and gold use the final mark unchanged.
- **Confirm screen**: row label 「○✕」; under the toggle a tiny 「先生の印」 or 「AI判定」 (none after a parent tap); 「正答（AI）：3000人」 in small muted text when the mark is not the teacher's. Amber pill 「単元を確認してください」 when `unitConfidence < 0.7` until the unit is picked; the dropdown starts with a 「候補」 group holding `unit_alt`.
- **ClaudeReader.readText(text, grade)**: same prompt + schema, text block instead of the image.
- **`pnpm eval:units`** (`scripts/eval-units.ts`, helpers in `src/lib/unit-eval.ts`): see README. Fixture `fixtures/unit-eval.json`: 220 problems by the curriculum agent (2 per unit, ids `<unit>-a|b`, each with a `note` on why), validated here: all 110 units twice, every id known and inside its grade's reader list. No-key run = keyword baseline (36.4% on the 220: a floor, not the AI).
- **Mock**: `fixtures/reader-outputs.json` p01 (teacher marks + matching judge), p06 (no marks: AI ○○○○✕, Q3 unit_confidence 0.62 with alt 5-C3), p10 (AI ✕ on 2m³).

Tests: 120 (13 files; new `judge-units.test.ts` 16: precedence, draft → saved with source, AI ✕ on the list, judge normalisation, unit_confidence default, unit_alt validation, pill threshold, mock p06, back-compat pages + v1 backups, look-alike ids valid / co-occurring / never outside the list, prompt fields for every grade, eval fixture validation + summary). Screenshots: `06-confirm` is now p06 (AI判定 ×5, 正答（AI）, one 単元を確認 pill), new `06b-confirm-teacher` (p01, 先生の印). `screens.py` also checks parent tap → label gone, picking 候補 → pill gone.

## v0.5 (19 Oct 2026): 高1 / 高2 / 高3 + judgment on both kinds of pages

Founder decisions: (1) 高校 is three grades, never one; (2) teacher-marked pages and unmarked pages must both work.

- **Grades** (`src/curriculum.ts`): `GRADES` = 小1…小6, 中1…中3, 高1, 高2, 高3 (12). Unit ids unchanged (`h-I-3` …). `HIGH_SCHOOL_YEAR` (one documented table, "schools vary"): 高1 = 数学I + 数学A (7 units), 高2 = 数学II + 数学B (8), 高3 = 数学III + 数学C (6). Reader rule unchanged (own grade + the grade below): 高1 → I/A + 中3, 高2 → II/B + I/A, 高3 → III/C + II/B. Helpers `isHighSchool`, `toGrade`, `gradeFromPref`, `LEGACY_GRADES = { 高校: 高1 }`.
- **Star chart**: 高1 / 高2 / 高3 are separate bands (study-order stacks inside each); the merged upper row reads 「これから学ぶ単元（小6〜高3）」, 「（高1〜高3）」 for 中3, 「（高3）」 for 高2, none for 高3. Roots now go 数学II/B → 数学I/A and 数学III/C → 数学II/B (still 数学I → 中3); `HIGH_SCHOOL_LANES` unchanged. 一覧 has 12 sections (subject name on every 高 tile). Chart label 「下が小1、上が高3です。」 Report / strip / header badge use the grade as is (「高2の8単元」, 「高2の学習レポート」).
- **Waitlist**: 「高校生」 → 「高校1年生」「高校2年生」「高校3年生」; the server still accepts 「高校生」 (`LEGACY_WAITLIST_GRADES`) for saved signups and an open old form.
- **Migration**: localStorage grade 「高校」 → written back as 高1 + flag `lens-snap:grade-check` → a note under the header (「学年を「高1」にしました。高2・高3のときは、右上の学年をタップして変えてください。」, 「このままでよい」) and a ring on the badge until the parent picks a grade or dismisses it. IndexedDB pages and backups: `migratePage()` (grade + markSource) in `allPages()` and `parseBackup()`; the backup schema preprocesses the grade (version stays 1). `POST /api/read` reads 「高校」 as 高1 (an old open tab).
- **Judgment on both kinds of pages** (`judgeDisagrees` in `src/lib/marks.ts`): unmarked problems → AI ○✕ (unchanged); teacher-marked → the teacher's mark (unchanged), but 「正答（AI）：…」 now shows under every toggle with an AI answer, and when the teacher's mark ≠ the AI's judgment a small neutral note (`.mark-note`, navy tint) 「先生の印とAIの判定がちがいます。印を確認してください。」. Per problem, so mixed pages work. A parent tap (source parent) clears the note. Saved problems carry `aiJudge` (optional; backups accept it, older ones load without it).
- **Fixtures**: `unit-eval.json` 高校 items re-graded by school year (14 高1 / 16 高2 / 12 高3); keyword baseline now 38.2% (was 36.4%: shorter high-school lists). `reader-outputs.json` p01 Q5: AI `correct_answer` 300人 / judge ✕ against the teacher's ○ (a deliberate mock slip) so 06b shows the note; `pnpm eval` (marks, answers) unchanged.

Tests: 144 (14 files; new `koko-grades.test.ts` 9: 高2 star chart near / merged / no overlaps, 中3 and 高3 upper rows, roots II→I and III→II, per-year counts, 高2 report + strip + `?unit=`, reader list + prompt for 高1 / 高2, IndexedDB and backup migration, localStorage migration + check flag; `curriculum.test.ts` +4: 12 grades, each of the 110 units in exactly one grade, school-year table, 高1/高2/高3 reader lists, `toGrade`; `judge-units.test.ts` +7: teacher ○ + AI ✕, AI-only ✕, agreeing / missing judgment, mixed page, parent tap clears the note and `aiJudge` is saved, mock p01, backup round-trip; waitlist +2: three 高校 options + legacy 「高校生」, `/read` with 「高校」). Screenshots: `04-onboarding-grade` (12 buttons, 4 rows of 3), `06b-confirm-teacher` (正答（AI） under every toggle, the note on Q5), new `18k-map-home-koko2` (高2 child), new `04m-grade-migrated` (old 「高校」 → 高1 note); 小5 map / report unchanged apart from 「（小6〜高3）」. `screens.py` also checks the parent tap clearing the note, the 10 expanded far bands, the 高2 report and the migration flow.

## v0.6 (19 Oct 2026): the map is the centre of the app

Founder, after his live test (he reached the confirm screen but never found the map; the app started on 撮る): "Where's the map? The UI should be very clear and around the map."

- **The map is always home** (`homePath()` → `/app/map`, no page count): after the 招待コード and the grade the app opens on the 単元マップ, also before the first page. Tabs: マップ / 撮る / テスト前 / ふりかえり (`APP_TABS`, マップ first).
- **Empty map** (`src/components/WelcomeCard.tsx`): the full night-sky chart of the grade band (all stars faint, まだ) and, in place of the report strip, a card in the same sky pane: 「小5の単元マップ」, 「プリントやテストを撮ると、その単元の星が光ります。」, the four-state legend (small star glyphs) and a big 「ページを撮る」 (→ `/app/snap`).
- **Floating 「撮る」** (`src/components/SnapFab.tsx`): camera icon + 撮る, bottom-right above the tab bar (`env(safe-area-inset-bottom)` aware, aligned to the 720 px column on wide screens), on both 星図 and 一覧; not rendered while a star's sheet is open. The sky page has 80 px more bottom room so it never hides the lowest band. The 撮る tab and the button share one camera glyph (`CameraGlyph`).
- **After 保存**: `litMapUrl` now carries the page id (`&page=…`); the toast is built by `savedToast(page)` (pure, `src/lib/home.ts`): 「4問を保存しました：✕ 2問（平均、数量の関係を表す式）・○ 2問」 (✕ units in page order, each once, max 3 then 「ほか」; unmarked problems → 「印なし N問」; no marks → 「N問を保存しました。」). The toast now sits at the top of the map (over the lane header) and the lit stars are framed between it and the tab bar (all of them when they fit, centred; else from the first). Once the toast is gone (4.5 s) the map glides back up to the strip and the new 次にやること rows glow once, unless the user has touched or scrolled meanwhile. 「レポートを見る」 stays in the toast. Counts never split across lines (`keep-all`, no-break space after ✕/○).
- **次にやること in the strip** = the report's 次にやること (red units of the child's grade) topped up to 3 with its 前の学年で気になる単元 (nearest grade first, with a small grade tag, e.g. 「小4」), so a ✕ saved from an older sheet appears there. The 学習レポート page itself is unchanged.
- **テスト前リスト** opened with `?units=` / `?unit=` (from the strip, the report or a sheet) starts at the readiness card, so the problems are on the first screen; a problem from an earlier grade shows its grade (「小4 A(6) 数量の関係を表す式」, which 小5 also has).
- **Journey screenshots** (`J*`, fresh 小5 profile, journey server `MOCK_FALLBACK=live4`): fixture `live4` = the founder's live reading of a 4年 sheet (4 problems: 4-A4 ○, 5-D2 ✕ (empty table), 4-A6 ✕ (式 only), 4-A6 ○ at confidence 0.6; no teacher marks, drill) + `fixtures/photos/live4.jpg` (the photo; no `truth.json` entry, so `pnpm eval` skips it). Shots: `J1-empty-map`, `J2-confirm`, `J3-saved-map` (mid-flare, toast), `J4-map-after` (strip: 平均 + 小4 数量の関係を表す式), `J5-sheet` (平均), `J6-list` (the two ✕).

Tests: 151 (15 files; `home.test.ts`: home always the map, tab order, strip top-up from earlier grades (+ the live-sheet case), `savedToast` (live text, all ○ / all ✕ / no marks / 印なし / no unit / 「ほか」 / empty), MOCK_FALLBACK=live4 → draft → `litMapUrl` + toast; new `welcome.test.ts` 3: card title / line / 4-item legend / 「ページを撮る」 → `/app/snap`, empty sky all まだ, floating button → `/app/snap`; `map.test.ts`: `litMapUrl` with `page`). `screens.py`: grade → empty map + welcome + tab order, 撮る from the floating button, toast text, strip with 3 rows (4-A2 tagged 小4), button hidden under an open sheet, `/app` with no pages → map, gated server → map after code + grade, plus the J journey.

## Known gaps

- **Claude reader not run here** (no key in this environment): implemented and type-checked only. Default `READER_MODEL` is `claude-haiku-5-5` (`claude-sonnet-5-5` as the higher-accuracy option); run `pnpm eval --reader claude` with each before launch.
- **Waitlist on Cloud Run**: durable only with `WAITLIST_DIR` on the bucket mount (deploy.sh does this). The `WAITLIST_PATH` default in the image (`/tmp`) is lost on restart.
- `docker build` was not run here (Docker Hub is blocked from this sandbox). The Dockerfile steps (frozen install of `@lens/snap...` → build → `pnpm deploy --prod` → run from only the runtime files) were replayed in a clean checkout and the server answered `/` and `/api/read`; Cloud Build runs the real image build on first deploy.
- "Photo crop" is the whole-page thumbnail: the reader returns no per-problem bounding boxes yet.
- HEIC photos on non-Safari browsers are uploaded as-is; the MockReader ignores format, sharp may not decode HEIC in the Claude path.
- **Per-IP limit trusts the first `x-forwarded-for` entry**, which a client can set itself (Google's front end appends the real address after it). A determined user can rotate it to dodge `READ_PER_IP_HOUR`; the global `READ_DAILY_CAP` and the pilot code still bound spend. If abuse appears, key on the last-but-one entry instead.
- Limits reset on every restart / new revision (in memory by design).
- **AI judgment and the new tagging rules are not measured yet** (no key here). Run `eval:units --reader claude` with haiku and sonnet; `pnpm eval` still scores the teacher's mark only (judge accuracy vs `truth.json` keys is a next step).
- Gold now also follows AI ○ (final mark): a drill page judged all ○ by the AI can make a unit gold. If gold should stay "proven by a teacher", restrict it to `markSource === "teacher"` in `unitStats`.
- Gold is decided from the page marks; the user can still toggle ○/✕ on the confirm screen, so "proven on a test" relies on the user keeping the teacher's marks. Pages of any type (test/drill/note) count; restricting gold to `pageType: "test"` is a one-line change if wanted.
- **School-year table is the usual order only**: a school teaching 数学C in 高2, or 数学II from the 3rd term of 高1, gets null units for those problems (the parent picks). Widening the 高校 reader list to two years below is a one-line change if the pilot shows it.
- **Landing copy vs AI answers**: the landing's 「採点もしません」「答えを表示したりはしません」 predates v0.4/v0.5 (the app now shows 正答（AI） and AI ○✕); left as is (final copy) — the founder should decide the wording.
- Landing: `{CONTACT_EMAIL}` not set, so the footer contact line is omitted; `/privacy` is built only from existing copy (no full legal policy yet).
- Far → near root lines are not drawn softly (they would run through a whole stack); they appear on the selected path and the light-up. Some near curves in the 8-unit 数と計算 stacks still run long beside the stars.
- **Star chart roots are heuristic** (shared words + 2 hand fixes) and stop at the nearest lower grade. Since v0.5 high-school units root year by year (数学III → II, II → I, I → 中3), still by shared words only (e.g. 三角関数 ← 二次関数, because 図形と計量 is in another lane). A curated root table would be the next step if families use the sheet.
- Star labels show up to 3 short lines (10–10.5 px); the longest topic (小3 二等辺三角形・正三角形、角、円と球) is cut with 「…」 on the chart and shown in full in the sheet.
- The service worker was checked in Chromium (Playwright: offline reload of `/app/map` works, no `/api` entries in the cache) and in a unit test; not yet on a real iPhone. iOS may still clear site data for web pages not added to the home screen, which is why the install tip and backup exist.
- `navigator.storage.persist()` is a request; Chrome may decline it for sites that are not installed or bookmarked. The result is stored but not shown.
- The report strip is in the 星図 view only; a family that chose 一覧 sees the v0 tile header without it (the floating 撮る is there; the welcome card is not).
- **Strip vs 学習レポート**: the strip's 次にやること may now list an earlier-grade unit (topped up) that the report shows under 前の学年で気になる単元 instead, and that unit is also counted in the strip's 「前の学年に✕…（N）」 line. Making the report's 次にやること follow the same rule is a one-line change in `buildReport` if the founder prefers one list everywhere.
- The glide back to the strip after 保存 is skipped when the user touches, scrolls or presses a key during the 4.5 s toast; a family that taps a lit star right away stays where it is.
- The empty map keeps the small 「単元マップ」 page heading above the card's 「小5の単元マップ」 (the 星図 / 一覧 toggle lives there).
- 学習レポート fits one phone screen down to 次にやること; 前の学年, この1週間 and the chips need one short scroll on a 390×844 phone. The 復習が必要 chip group repeats the 次にやること units (kept as specified; dropping it would save ~50 px).
- 「最後に撮った日」 and この1週間 use the device clock and local time; a page saved on another device with a skewed clock (backup restore) can fall outside the week.
- 準備度 is still shown as a percentage of problems in range with nothing left to do (existing v0 wording); it describes review progress, not understanding, but the founder may want to re-check it against the no-score rule.
- Anthropic SDK 0.32 triggers a harmless Node `punycode` deprecation warning; upgrading the SDK will remove it.

### Unit-tagging blind test (19 Oct 2026, Haiku-class proxy, text mode, anonymous ids)
| Prompt | Top-1 | Ordinary (a) | Look-alike (b) | Within 1st/2nd choice |
|---|---|---|---|---|
| v0.3 (units + covers) | 215/220 (97.7%) | 110/110 | 105/110 | — |
| v0.4 (how-to-choose + look-alikes + unit_alt) | 213/220 (96.8%) | 110/110 | 103/110 | 218/220 (99.1%) |
Misses are all neighbouring units (e.g. 6-C1 反比例 → 6-A2 文字と式, 5-D1 円グラフ → 5-C3 割合, h-I-4 ↔ h-B-2).
Check rule chosen from this run: show 「単元を確認してください」 when confidence < 0.7, or ≤ 0.8 with a second choice →
flags 31/220 (14%), catches 5 of 7 misses; silent wrong tags 2/220 (0.9%). Re-measure with the real model:
`ANTHROPIC_API_KEY=$(gcloud secrets versions access latest --secret anthropic-api-key) pnpm --filter @lens/snap eval:units --reader claude`.
