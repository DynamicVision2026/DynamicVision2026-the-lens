# WO-001: Lens Snap v0 — snap → problems → unit → テスト前リスト (standalone web app)

**Owner:** Builder · **Review:** Architecture Lead (Claude) · **Founder:** Brian Fu (approves product decisions only)
**Anchor (locked 18 Oct 2026):** テスト前の夜の「今夜、何を復習すればいい？」. Every screen serves that question.

## 0. Principles
- **Standalone.** The tool works on its own from day one. It never depends on the YouTube unit-video schedule; videos only link into it.
- **Simple for a solo operator.** One app, one small server, one Docker image for Cloud Run. No accounts, no payments, no database server in v0.
- **No auto-grading.** We read the teacher's red ○/✕ (or the student taps it). Feasibility test (lens-snap/ocr-feasibility-test.md in the Math Japan project): marks 100%, unit tags 100%, text 0–0.1% error on synthetic pages.
- **Private by default.** Photos stay on the device (IndexedDB). The server forwards one image to the model and keeps nothing; it never logs images or names.

## 1. Stack
- pnpm, TypeScript, Vite + React (frontend), a small Node server (Hono or Express) serving the built app plus `/api/*`, vitest, one `Dockerfile` (listens on `$PORT`).
- Japanese UI, friendly but polite (です・ます). Mobile first (iPhone width 390 px), works on iPad.

## 2. Curriculum map (the engine's data)
- `data/units.json`: 110 units / 278 knowledge points (学習指導要領, 小1–高校). Give every unit a stable id: grade + unit code, e.g. 小5 C(3) → `5-C3`, 中2 → `j2-…`, 高校 → `h-I-…` (document the scheme).
- `src/curriculum.ts`: `unitsForGrade(grade)`, `unitById(id)`, plus the grade → units map used by the reader prompt and the UI dropdown.

## 3. Reader (photo → structured page)
- `interface Reader { read(image: Uint8Array, mime: string, grade: Grade): Promise<PageResult> }`
- `PageResult` = `{ pageType, gradeGuess, score, retake, problems: [{ n, q, unit, answer, mark: "○"|"✕"|null, confidence }], notes }` validated with zod; a `unit` not in the grade's list becomes `null` (the user picks).
- `ClaudeReader`: Anthropic Messages API, one call per photo, image downscaled to ≤ 1600 px long edge, prompt = the feasibility-test prompt (below) with the grade's unit list. Env: `ANTHROPIC_API_KEY`, `READER_MODEL` (default `claude-sonnet-5`; configurable so Haiku can be compared).
- `MockReader`: returns `fixtures/reader-outputs.json` entries (used when no key is set, and in tests).
- Problems are numbered by order on the page (a red ✕ often covers the printed number).

Prompt (keep in `src/reader/prompt.ts`): transcribe the problems exactly; fractions `a/b`, mixed `1と1/2`; figure measurements in [brackets]; ONE unit id from the given list; the student's answer exactly as written or null; the teacher's red mark ○/✕/null; confidence 0–1; `retake: true` when the photo is too poor; never solve, never correct, never invent; ignore the child's name.

## 4. Screens
1. **`/` landing + waitlist**: the pain → promise → how it works (3 steps) → waitlist form (email, grade, 「テスト前、何を復習するか迷いますか？」 毎回/よくある/たまに/ない). POST `/api/waitlist` appends JSONL (file path from env; default `./data-private/waitlist.jsonl`, git-ignored). Copy comes from `docs/validation/landing-copy.md` when it lands; until then use placeholders.
2. **`/app` onboarding**: pick grade (stored locally).
3. **Snap**: camera / file input → `/api/read` → **confirm screen**: each problem as a card with text, unit chip (dropdown of the grade's units), student answer, mark (○/✕/なし toggles). 「保存」 saves page + downscaled photo crop to IndexedDB. Retake flag → 「もう少し明るい所で撮り直してください」.
4. **マップ**: the grade's units as tiles; tile shows count of problems and ✕ count; colour = needs review (has ✕ not yet reviewed) / ok / no data.
5. **テスト前リスト**: pick units (the test range) → the ✕ problems (and low-confidence ones) with the photo crop; 「復習した」 checkbox; readiness % for the selected range.
6. **ふりかえり (archive)**: all saved problems, filter by unit / ✕ / date; delete a page.

## 5. Eval (re-run on every reader change)
- `pnpm eval [--reader mock|claude]`: runs the reader over `fixtures/photos/*.jpg`, scores against `fixtures/truth.json` (problems found, text CER, unit, mark, answer, retake) and prints the table. Real pilot photos will be added to fixtures later (never committed if they show a child's name).

## 6. Tests / done when
- vitest: curriculum ids unique and stable; zod schema; unit outside the grade → null; mock reader → confirm → save → テスト前リスト shows exactly the ✕ problems of the chosen units; waitlist validation (email format, grade required).
- `pnpm build`, `pnpm test`, `pnpm typecheck` green; `docker build` succeeds; the app runs with no API key (mock reader) and with a key (Claude reader).
- Out of scope v0: accounts, payments, parent weekly email, tile fading, auto-grading, sharing.
