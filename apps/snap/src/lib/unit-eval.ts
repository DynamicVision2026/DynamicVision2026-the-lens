import { type Grade, isGrade, readerUnitsForGrade, unitById } from "../curriculum";

/**
 * Unit-tagging eval (text only): pure helpers used by scripts/eval-units.ts and tested.
 * Fixture: fixtures/unit-eval.json — `{ problems: [{ id, grade, unit, kind, q }] }` or a bare array.
 *   grade  the child's grade the problem is shown for (defaults to the unit's grade)
 *   unit   the true unit id
 *   kind   "a" | "b" (2 per unit; b = the harder / look-alike one). Missing → from an id ending in -a / -b.
 */
export interface UnitEvalItem {
  id: string;
  grade: Grade;
  unit: string;
  kind: string;
  q: string;
}

export interface UnitEvalResult {
  id: string;
  grade: Grade;
  kind: string;
  q: string;
  truth: string;
  got: string | null;
  alt: string | null;
  confidence: number | null;
  error?: string;
}

/** Validate the fixture. Returns usable items and one message per rejected item. */
export function loadUnitEval(json: unknown): { items: UnitEvalItem[]; problems: string[] } {
  const list = Array.isArray(json) ? json : (json as { problems?: unknown })?.problems;
  if (!Array.isArray(list)) return { items: [], problems: ["fixture has no problems array"] };
  const items: UnitEvalItem[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  list.forEach((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const id = String(r.id ?? `#${i + 1}`);
    const unitIdRaw = String(r.unit ?? r.truth ?? "");
    const unit = unitById(unitIdRaw);
    const q = String(r.q ?? r.text ?? "").trim();
    const grade = r.grade ?? unit?.appGrade;
    const kind = String(r.kind ?? r.type ?? r.variant ?? id.match(/-([ab])$/)?.[1] ?? "?");
    if (seen.has(id)) return void problems.push(`${id}: duplicate id`);
    if (!unit) return void problems.push(`${id}: unknown unit id "${unitIdRaw}"`);
    if (!q) return void problems.push(`${id}: empty problem text`);
    if (!isGrade(grade)) return void problems.push(`${id}: bad grade "${String(grade)}"`);
    if (!readerUnitsForGrade(grade).some((u) => u.id === unit.id))
      return void problems.push(`${id}: ${unit.id} is not in the ${grade} reader list (own + previous grade)`);
    seen.add(id);
    items.push({ id, grade, unit: unit.id, kind, q });
  });
  return { items, problems };
}

export interface UnitEvalSummary {
  total: number;
  correct: number;
  byKind: Record<string, { total: number; correct: number }>;
  byGrade: Record<string, { total: number; correct: number }>;
  misses: UnitEvalResult[];
  /** Most frequent wrong (truth → got) pairs, most frequent first. */
  confusion: { truth: string; got: string; count: number }[];
  errors: number;
}

export function summarize(results: UnitEvalResult[]): UnitEvalSummary {
  const s: UnitEvalSummary = { total: 0, correct: 0, byKind: {}, byGrade: {}, misses: [], confusion: [], errors: 0 };
  const conf = new Map<string, number>();
  for (const r of results) {
    const ok = r.got === r.truth;
    s.total++;
    if (ok) s.correct++;
    if (r.error) s.errors++;
    for (const [bucket, key] of [[s.byKind, r.kind], [s.byGrade, r.grade]] as const) {
      const b = (bucket[key] ??= { total: 0, correct: 0 });
      b.total++;
      if (ok) b.correct++;
    }
    if (!ok) {
      s.misses.push(r);
      const k = `${r.truth}>${r.got ?? "null"}`;
      conf.set(k, (conf.get(k) ?? 0) + 1);
    }
  }
  s.confusion = [...conf]
    .map(([k, count]) => {
      const [truth, got] = k.split(">");
      return { truth, got, count };
    })
    .sort((a, b) => b.count - a.count || a.truth.localeCompare(b.truth));
  return s;
}

const pct = (a: number, b: number) => (b === 0 ? "—" : `${((a / b) * 100).toFixed(1)}%`);
const name = (id: string | null) => {
  const u = unitById(id);
  return u ? `${id} ${u.grade}${u.topic}` : String(id);
};

export function formatSummary(s: UnitEvalSummary, readerName: string, gradeOrder: readonly string[]): string {
  const lines: string[] = [];
  lines.push(`Unit tagging eval — ${readerName}`);
  lines.push(`overall  ${s.correct}/${s.total}  ${pct(s.correct, s.total)}${s.errors ? `   (${s.errors} calls failed → counted as misses)` : ""}`);
  for (const k of Object.keys(s.byKind).sort()) lines.push(`kind ${k}   ${s.byKind[k].correct}/${s.byKind[k].total}  ${pct(s.byKind[k].correct, s.byKind[k].total)}`);
  lines.push("per grade:");
  for (const g of gradeOrder) {
    const b = s.byGrade[g];
    if (b) lines.push(`  ${g} ${String(b.correct).padStart(3)}/${String(b.total).padEnd(3)} ${pct(b.correct, b.total)}`);
  }
  lines.push(`misses (${s.misses.length}):`);
  for (const m of s.misses)
    lines.push(`  ${m.id}: got ${m.got ?? "null"} (alt ${m.alt ?? "null"}) ≠ truth ${m.truth}${m.error ? ` [${m.error}]` : ""} — ${m.q.replace(/\s+/g, " ").slice(0, 60)}`);
  lines.push("confusion (truth → got):");
  if (!s.confusion.length) lines.push("  (none)");
  for (const c of s.confusion.slice(0, 15)) lines.push(`  ${c.count}× ${name(c.truth)} → ${name(c.got)}`);
  return lines.join("\n");
}

/**
 * No-key stand-in for the Claude reader: picks the allowed unit whose topic + covers share the
 * most kanji / katakana words with the text (ties → the child's own grade). A plumbing check and
 * a floor to beat, not a measurement of the AI.
 */
export function keywordTag(text: string, grade: Grade): string | null {
  const words = (s: string) => new Set(s.match(/[\p{Script=Han}\p{Script=Katakana}ー]{2,}|[%％²³:]/gu) ?? []);
  const t = words(text);
  let best: { id: string; score: number } | null = null;
  for (const u of readerUnitsForGrade(grade)) {
    let score = 0;
    for (const w of words(`${u.topic} ${u.covers.join(" ")}`)) if ([...t].some((x) => x.includes(w) || w.includes(x))) score++;
    if (u.appGrade === grade) score += 0.1;
    if (!best || score > best.score) best = { id: u.id, score };
  }
  return best && best.score >= 1 ? best.id : null;
}
