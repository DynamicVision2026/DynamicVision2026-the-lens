# Lens Snap

撮るだけで、テスト前に「やること」がわかる。

Students or parents photograph homework, workbook pages and graded tests. Lens Snap reads each problem, files it under its curriculum unit (学習指導要領, 110 units), keeps the teacher's ○/✕, and builds the テスト前リスト: exactly what to review tonight.

- Work orders: `docs/WO-*.md` (start with WO-001)
- Market validation: `docs/validation/`
- Curriculum data: `data/units.json`
- Reader test photos + answer key (original synthetic pages): `fixtures/`
- Build, run, deploy, screenshots: `docs/BUILD-NOTES-v0.md`; deploy: `bash apps/snap/deploy.sh <project>` from the repo root
- 単元マップ = a curriculum star chart (`src/lib/starmap.ts`): four lanes, grades rising upward; the child's grade and the grade below in full, every grade above merged into one 「これから学ぶ単元」 row (tap to expand), lower grades as compact far bands (tap to open); units with data glow and link to their roots in the grade below; 「一覧」 keeps the tile view
- **単元マップ = home, always** (`/app` → `/app/map` after the 招待コード and the grade, also before any page; `src/lib/home.ts`): a report strip on top of the star chart (the grade's one-glance bar, 次にやること = the grade's red units topped up with the nearest earlier-grade ones (grade tag) → tap selects the star and opens its sheet, 「テスト前リストで見る」, 「学習レポートをくわしく見る」, 「前の学年に✕のある単元があります（N）」 → opens the far band and rings those stars; folds to one line, remembered). No pages yet: the grade's sky with every star faint and a welcome card in place of the strip (「{学年}の単元マップ」, one line, the four-state legend, big 「ページを撮る」). A floating 「撮る」 button (bottom-right, above the tab bar, hidden while a sheet is open) on the map. After 保存: back on the map, every lit star framed and flaring, a toast that says what changed (「4問を保存しました：✕ 2問（平均、数量の関係を表す式）・○ 2問」, `savedToast`), then the map glides back up to the strip with the new 次にやること rows glowing once. Four tabs: マップ / 撮る / テスト前 / ふりかえり
- Journey screenshots for the founder: `docs/screens/J1…J6` (fresh 小5 profile, mock of his live 4年 sheet = fixture `live4`, journey server with `MOCK_FALLBACK=live4`)
- 学習レポート (`/app/report`, `src/lib/report.ts`): the map's 「詳しく」 page — segmented bar, 次にやること, earlier-grade red units with the unit they support, この1週間, unit chips; every unit opens its star on the map (`/app/map?unit=5-C3`), 「単元マップにもどる」 at the top
- テスト前リスト: gold units' older ✕ sit in a collapsed 「念のため」 section and do not count against 準備度; `?units=a,b` preselects units
- Home-screen app: `public/manifest.webmanifest`, `public/sw.js` (offline app shell, never caches `/api`), icons from `node scripts/icons.mjs`
- **AI ○✕ + unit check** (v0.4): the reader also solves each problem (`correct_answer`) and judges the child's answer (`judge`); the saved ○✕ is the teacher's red mark, else the AI's judgment, else none (`src/lib/marks.ts`, `markSource` teacher / ai / parent). Each unit comes with `unit_confidence` and `unit_alt`; below 0.7 the confirm card shows 「単元を確認してください」 and offers the alternative first (候補)
- **Grades** (v0.5): 12 — 小1…小6, 中1…中3, **高1 / 高2 / 高3** (never one combined 高校). 高校 units keep their ids and are placed by `HIGH_SCHOOL_YEAR` in `src/curriculum.ts` (高1 = 数学I + A, 高2 = II + B, 高3 = III + C; schools vary). Saved data with the old 「高校」 (localStorage, IndexedDB, backups, `/api/read`) is read as 高1 and the grade badge asks the parent to check it once
- **Teacher-marked and unmarked pages** (v0.5): the AI solves every problem; 「正答（AI）」 shows under every toggle, and when the AI's judgment differs from the teacher's red mark a neutral 「先生の印とAIの判定がちがいます。印を確認してください。」 appears (teacher's mark still wins; a parent tap clears it). Each saved problem keeps `aiJudge`
- Data safety: persistent-storage request after the first 保存, install tip, and ふりかえり → バックアップ (one JSON file, restore merges by page id)

## Environment

| Var | Default | Meaning |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Claude reader when set; MockReader (fixture outputs) when absent |
| `READER_MODEL` | `claude-haiku-5-5` | Model id for the Claude reader; `claude-sonnet-5-5` for higher accuracy |
| `PILOT_CODE` | — | If set, photo reading needs this 招待コード (header `x-pilot-code`); 403 otherwise |
| `READ_PER_IP_HOUR` | `20` | Reads per client per hour (429 `rate_limited`) |
| `READ_DAILY_CAP` | `300` | Reads for everyone per UTC day (429 `daily_cap`) |
| `WAITLIST_DIR` | — | One JSON file per signup in this folder (Cloud Storage FUSE safe); wins over `WAITLIST_PATH` |
| `WAITLIST_PATH` | `./data-private/waitlist.jsonl` | JSONL append when `WAITLIST_DIR` is not set |

## Unit-tagging eval (Google Cloud Shell)

From the repo root, with the key from Secret Manager (project = the Lens Snap project, `gcloud config set project <id>` first):

```bash
ANTHROPIC_API_KEY=$(gcloud secrets versions access latest --secret anthropic-api-key) pnpm --filter @lens/snap eval:units --reader claude
```

Options: `--model claude-sonnet-5-5` (default `READER_MODEL` or `claude-haiku-5-5`), `--file fixtures/unit-eval.json` (220 problems, 2 per unit: a = typical, b = look-alike trap; 高校 items carry their school year 高1 / 高2 / 高3). Text only (no photos), same prompt and unit list as the app, 4 calls at a time with retry on 429 / 529. Prints overall, a / b and per-grade accuracy, every miss (`id: got X (alt Y) ≠ truth Z — q`) and the most frequent wrong pairs; writes `apps/snap/eval-out/units-<model>-<date>.json` (git-ignored). Without a key it runs a keyword baseline and says so.

Limits are in memory: run one instance (`--max-instances 1`). Export signups with `node scripts/waitlist-export.mjs <dir-or-jsonl> > waitlist.csv`.

Part of 視点レンズ / Math Japan (Beyond Culture 獨歩文化株式会社).
