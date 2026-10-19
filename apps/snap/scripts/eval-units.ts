/**
 * pnpm eval:units [--reader mock|claude] [--model id] [--file fixtures/unit-eval.json]
 *
 * Unit-tagging eval, text only: each problem's text goes to the reader with the same prompt and
 * the grade's unit list (ClaudeReader.readText), and the tagged unit is compared with the truth.
 * Prints overall / a-b / per-grade accuracy, every miss and the most frequent wrong pairs, and
 * writes eval-out/units-<model>-<date>.json (git-ignored).
 *
 * Google Cloud Shell, from the repo root:
 *   ANTHROPIC_API_KEY=$(gcloud secrets versions access latest --secret anthropic-api-key) pnpm --filter @lens/snap eval:units --reader claude
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { GRADES } from "../src/curriculum";
import { type UnitEvalItem, type UnitEvalResult, formatSummary, keywordTag, loadUnitEval, summarize } from "../src/lib/unit-eval";
import { ClaudeReader, DEFAULT_READER_MODEL } from "../src/reader/claude";

const argv = process.argv.slice(2);
function flag(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}
const kind = flag("reader") ?? (process.env.ANTHROPIC_API_KEY ? "claude" : "mock");
const model = flag("model") ?? process.env.READER_MODEL ?? DEFAULT_READER_MODEL;
const file = resolve(process.cwd(), flag("file") ?? "fixtures/unit-eval.json");
const CONCURRENCY = 4;
const KEY_HELP =
  "The Claude reader needs ANTHROPIC_API_KEY. In Google Cloud Shell, from the repo root:\n" +
  "  ANTHROPIC_API_KEY=$(gcloud secrets versions access latest --secret anthropic-api-key) pnpm --filter @lens/snap eval:units --reader claude";

if (kind !== "mock" && kind !== "claude") {
  console.error("usage: pnpm eval:units [--reader mock|claude] [--model id] [--file fixtures/unit-eval.json]");
  process.exit(2);
}
if (kind === "claude" && !process.env.ANTHROPIC_API_KEY) {
  console.error(KEY_HELP);
  process.exit(2);
}

const { items, problems } = loadUnitEval(JSON.parse(readFileSync(file, "utf8")));
for (const p of problems) console.warn(`skipped ${p}`);
if (!items.length) {
  console.error(`no usable problems in ${file}`);
  process.exit(1);
}

const reader = kind === "claude" ? new ClaudeReader(process.env.ANTHROPIC_API_KEY, model) : null;
const readerName = reader ? reader.name : "mock (keyword baseline — not the AI)";
if (!reader) console.log(`${KEY_HELP}\nRunning the keyword baseline instead (checks the plumbing; not the AI's accuracy).\n`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** 429 rate limit / 529 overloaded / 5xx: back off and retry (the SDK's own 2 retries come first). */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const status = (e as { status?: number }).status;
      const retryable = status === 429 || status === 529 || (status !== undefined && status >= 500);
      if (!retryable || attempt >= 5) throw e;
      await sleep(Math.min(60000, 2000 * 2 ** attempt) + Math.random() * 1000);
    }
  }
}

async function tag(item: UnitEvalItem): Promise<UnitEvalResult> {
  const base = { id: item.id, grade: item.grade, kind: item.kind, q: item.q, truth: item.unit };
  if (!reader) return { ...base, got: keywordTag(item.q, item.grade), alt: null, confidence: null };
  try {
    const page = await withRetry(() => reader.readText(item.q, item.grade));
    const p = page.problems[0];
    return { ...base, got: p?.unit ?? null, alt: p?.unitAlt ?? null, confidence: p?.unitConfidence ?? null };
  } catch (e) {
    return { ...base, got: null, alt: null, confidence: null, error: String((e as Error).message ?? e).slice(0, 120) };
  }
}

const results: UnitEvalResult[] = new Array(items.length);
let next = 0;
let done = 0;
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await tag(items[i]);
      if (reader && ++done % 20 === 0) console.error(`… ${done}/${items.length}`);
    }
  }),
);

const summary = summarize(results);
console.log(formatSummary(summary, readerName, GRADES));

const date = new Date().toISOString().slice(0, 10);
const outDir = join(process.cwd(), "eval-out");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `units-${reader ? model : "mock"}-${date}.json`);
writeFileSync(out, JSON.stringify({ reader: readerName, model: reader ? model : null, date, file, summary, results }, null, 2));
console.log(`\nwrote ${out}`);
