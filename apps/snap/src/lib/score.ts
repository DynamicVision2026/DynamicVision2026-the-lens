import type { PageResult } from "../reader/schema";

export interface TruthProblem { q: string; unit: string; ans: string | null; mark: "○" | "✕" | null; key?: string }
export interface TruthPage { kind: string; grade: string; problems: TruthProblem[] }

export function norm(s: string | null | undefined): string {
  return (s ?? "").normalize("NFKC").replace(/\s+/g, "");
}

export function stripFigure(s: string): string {
  return s.replace(/\[[^\]]*\]/g, "");
}

export function levenshtein(a: string, b: string): number {
  const A = [...a], B = [...b];
  let prev = Array.from({ length: B.length + 1 }, (_, i) => i);
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    for (let j = 1; j <= B.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[B.length];
}

export interface PageScore {
  id: string;
  truth: number;
  found: number;
  retake: boolean;
  editDist: number;
  chars: number;
  unit: number;
  mark: number;
  answer: number;
  matched: number;
}

/** Score one page. Problems are paired by order on the page (the reader numbers them that way). */
export function scorePage(id: string, truth: TruthPage, got: PageResult): PageScore {
  const s: PageScore = { id, truth: truth.problems.length, found: got.problems.length, retake: got.retake, editDist: 0, chars: 0, unit: 0, mark: 0, answer: 0, matched: 0 };
  const n = Math.min(truth.problems.length, got.problems.length);
  for (let i = 0; i < n; i++) {
    const t = truth.problems[i], g = got.problems[i];
    // Figure measurements in [brackets] are extra info the truth text does not carry.
    const tq = norm(stripFigure(t.q)), gq = norm(stripFigure(g.q));
    s.editDist += levenshtein(tq, gq);
    s.chars += [...tq].length;
    if (g.unit === t.unit) s.unit++;
    if (g.mark === t.mark) s.mark++;
    if (norm(g.answer) === norm(t.ans)) s.answer++;
    s.matched++;
  }
  return s;
}

const pct = (a: number, b: number) => (b === 0 ? "—" : `${((a / b) * 100).toFixed(1)}%`);

export function formatTable(rows: PageScore[], readerName: string): string {
  const head = ["photo", "found", "CER", "unit", "mark", "answer", "retake"];
  const line = (r: PageScore) => [
    r.id,
    `${r.found}/${r.truth}`,
    pct(r.editDist, r.chars),
    `${r.unit}/${r.matched}`,
    `${r.mark}/${r.matched}`,
    `${r.answer}/${r.matched}`,
    r.retake ? "RETAKE" : "",
  ];
  // Retake pages are a correct "please retake" outcome, not misreads: excluded from accuracy totals.
  const scored = rows.filter((r) => !r.retake);
  const sum = (k: keyof PageScore) => scored.reduce((a, r) => a + (r[k] as number), 0);
  const total = [
    "TOTAL*",
    `${sum("found")}/${sum("truth")}`,
    pct(sum("editDist"), sum("chars")),
    pct(sum("unit"), sum("matched")),
    pct(sum("mark"), sum("matched")),
    pct(sum("answer"), sum("matched")),
    `${rows.length - scored.length}/${rows.length}`,
  ];
  const table = [head, ...rows.map(line), total];
  const w = head.map((_, i) => Math.max(...table.map((r) => [...r[i]].length)));
  const fmt = (r: string[]) => r.map((c, i) => c.padEnd(w[i])).join("  ");
  return [
    `Lens Snap reader eval — reader: ${readerName}`,
    fmt(head),
    w.map((n) => "-".repeat(n)).join("  "),
    ...rows.map((r) => fmt(line(r))),
    w.map((n) => "-".repeat(n)).join("  "),
    fmt(total),
    "* totals exclude RETAKE pages (asking for a retake is an accepted outcome). CER = character error rate on problem text (NFKC, whitespace and [figure] notes removed).",
  ].join("\n");
}
