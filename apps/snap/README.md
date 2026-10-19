# Lens Snap

撮るだけで、テスト前に「やること」がわかる。

Students or parents photograph homework, workbook pages and graded tests. Lens Snap reads each problem, files it under its curriculum unit (学習指導要領, 110 units), keeps the teacher's ○/✕, and builds the テスト前リスト: exactly what to review tonight.

- Work orders: `docs/WO-*.md` (start with WO-001)
- Market validation: `docs/validation/`
- Curriculum data: `data/units.json`
- Reader test photos + answer key (original synthetic pages): `fixtures/`
- Build, run, deploy, screenshots: `docs/BUILD-NOTES-v0.md`; deploy: `bash apps/snap/deploy.sh <project>` from the repo root
- 単元マップ = a curriculum star chart (`src/lib/starmap.ts`): four lanes, grades rising upward, each unit linked to its roots in the grade below; 「一覧」 keeps the tile view
- Home-screen app: `public/manifest.webmanifest`, `public/sw.js` (offline app shell, never caches `/api`), icons from `node scripts/icons.mjs`
- Data safety: persistent-storage request after the first 保存, install tip, and ふりかえり → バックアップ (one JSON file, restore merges by page id)

## Environment

| Var | Default | Meaning |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Claude reader when set; MockReader (fixture outputs) when absent |
| `READER_MODEL` | `claude-sonnet-5` | Model id for the Claude reader |
| `PILOT_CODE` | — | If set, photo reading needs this 招待コード (header `x-pilot-code`); 403 otherwise |
| `READ_PER_IP_HOUR` | `20` | Reads per client per hour (429 `rate_limited`) |
| `READ_DAILY_CAP` | `300` | Reads for everyone per UTC day (429 `daily_cap`) |
| `WAITLIST_DIR` | — | One JSON file per signup in this folder (Cloud Storage FUSE safe); wins over `WAITLIST_PATH` |
| `WAITLIST_PATH` | `./data-private/waitlist.jsonl` | JSONL append when `WAITLIST_DIR` is not set |

Limits are in memory: run one instance (`--max-instances 1`). Export signups with `node scripts/waitlist-export.mjs <dir-or-jsonl> > waitlist.csv`.

Part of 視点レンズ / Math Japan (Beyond Culture 獨歩文化株式会社).
