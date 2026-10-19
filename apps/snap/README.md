# Lens Snap

撮るだけで、テスト前に「やること」がわかる。

Students or parents photograph homework, workbook pages and graded tests. Lens Snap reads each problem, files it under its curriculum unit (学習指導要領, 110 units), keeps the teacher's ○/✕, and builds the テスト前リスト: exactly what to review tonight.

- Work orders: `docs/WO-*.md` (start with WO-001)
- Market validation: `docs/validation/`
- Curriculum data: `data/units.json`
- Reader test photos + answer key (original synthetic pages): `fixtures/`
- Build, run, deploy, screenshots: `docs/BUILD-NOTES-v0.md`; deploy: `bash apps/snap/deploy.sh <project>` from the repo root
- **単元マップ = the territory map** (v0.7, `src/lib/territory.ts` + `src/components/TerritoryMap.tsx`): the same map as the video 「日本の算数・数学マップ」 (ported from its source, mathvid/map.html): light teal sea, one district per grade (小1…小6, 中1…中3, 高1…高3; since v0.8 zones of one continent, see below), hex patches per unit (one hex per 知識・技能, 278 hexes, grouped by strand), coast rings, seeded heights and palette, dashed sea route. Fog of war from the existing four states: まだ = flat pale tile, 復習ずみ = raised strand column, 復習が必要 = raised + red flag + pulse, マスター = taller gold column + star. Pannable / zoomable canvas (drag, pinch, double-tap, ＋−, 現在地 compass); every unit is also an accessible button (「小5 平均：復習が必要（✕2）」). Details only on a tap: bottom sheet with counts, the unit's page history, もとになる単元 (tap to fly) and dashed root routes. 「一覧」 keeps the tile view
- **単元マップ = home, always** (`/app` → `/app/map` after the 招待コード and the grade, also before any page; `src/lib/home.ts`): HUD over the map like the video's corner cards — brand pill 「単元マップ」 + 一覧 icon, 「次にやること N」 red badge (tap → flies to the red-flagged tiles one by one, opening each sheet with 「次へ（i/N）」), top-right card 「制覇した単元（小5）」 N / total + 小・中・高 bars + 「要復習 N」 (numbers = the 学習レポート's, `buildHud`), bottom-left strand + state legend, ＋− and the compass bottom-right, floating 「撮る」 beside it. No pages yet: all unexplored + one card 「プリントを撮ると、その単元が自分の領土になります」 / 「ページを撮る」. After 保存: the camera flies to the new tiles, they rise (0.8 s, back easing as in the video; reduced motion → static), the toast says what changed (`savedToast`). Four tabs: マップ / 撮る / テスト前 / ふりかえり
- **算数・数学の大陸** (v0.8, `src/lib/terrain.ts` + `src/components/terrainPaint.ts`): the territory map's districts now sit on one continent climbing from the sea (小1, front left) to the summit (高3, back right), one zone per grade with its own terrain and 標高 — 海岸線 (10) · 入り江 (40) · 平原 (120) · 森林帯 (300) · 深い森林帯 (500) · 湖沼帯 (700) · 丘陵帯 (1,000) · 岩稜帯 (1,500) · 高原帯 (2,000) · 雪線 (2,500) · 氷河帯 (3,100) · 山頂 (3,776). Satellite / topographic style: terraced relief with contour lines, shoreline contours, zone borders, a survey grid, canopy dots, rock hachures, glacier cracks, lake + river, pass symbol, summit marker + flag (all vector, under the tiles, never touching one). A dashed trail links the 12 zones in order; each zone's trail marker shows 制覇 N/M (a planted flag when complete), the child's carries the 「あなたはここ」 beacon. Untaken tiles take their zone's ground tone. On load the camera frames the child's zone at 70 % leaning towards the next one; zoomed out, the whole continent sits below the HUD. HUD: glass panels, compact 制覇 card, 「凡例」 folded by default, menu (☰) → 一覧で見る / **年度の記録** (`src/lib/yearly.ts`: one row per school year, April–March, from on-device pages; grade = profile grade minus years back; zone, 制覇 N/M, ✕; a row flies to that zone)
- Journey screenshots for the founder: `docs/screens/J1…J6` (fresh 小5 profile, mock of his live 4年 sheet = fixture `live4`, journey server with `MOCK_FALLBACK=live4`)
- 学習レポート (`/app/report`, `src/lib/report.ts`): the map's 「詳しく」 page — segmented bar, 次にやること, earlier-grade red units with the unit they support, この1週間, unit chips; every unit opens its tile on the map (`/app/map?unit=5-C3`), 「単元マップにもどる」 at the top
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
