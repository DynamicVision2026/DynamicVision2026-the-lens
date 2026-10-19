import { app } from "../copy";
import { type Grade, UNITS, type Unit, unitById } from "../curriculum";
import { markSourceOf } from "./marks";
import type { SavedPage } from "./model";
import { goldUnits, reasonFor } from "./review";
import { rootIds } from "./starmap";
import { shortDate } from "./territory";
import { type SheetProblem, markSourceLabel } from "./unitsheet";

/**
 * テスト前モード = 「今夜、何を復習すればいい？」 on the map. Pure: the test date and its countdown, the
 * default range, the stored tests (one per date, localStorage via the screen), and 今夜の作戦:
 *   ① まず解き直す   — unreviewed ✕ of the range units below マスター (Lv < 3), newest first, grouped by unit;
 *   ② つまずきのもと — unreviewed ✕ of the もとになる単元 (earlier grades) of the range units;
 *   ③ 念のため       — older ✕ of マスター / 定着 range units + low-confidence readings in the range (collapsed).
 * No scores and no promise of results: the plan only counts problems and estimates minutes.
 */

/** Estimate for re-solving one problem and checking it (めやす): minutes. */
export const MIN_PER_PROBLEM = 5;

/**
 * Cross-strand roots used by the plan only (the map's roots stay same-strand, lib/starmap): 小5 平均 is
 * 合計 ÷ 個数, computed with the 小4 四則混合と ( ) の式 of 数量の関係を表す式 (the founder's example).
 */
export const PLAN_EXTRA_ROOTS: Record<string, string[]> = { "5-D2": ["4-A6"] };

// ---------- dates (device local time; a date is "YYYY-MM-DD") ----------

const pad = (n: number) => String(n).padStart(2, "0");

/** The local calendar day of a time. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDay(day: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}

export const isDay = (day: unknown): day is string => typeof day === "string" && parseDay(day) !== null;

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  if (!d) return day;
  d.setDate(d.getDate() + n);
  return isoDay(d);
}

/** Calendar days from today to the test (1 = tomorrow, 0 = today, < 0 = past). */
export function daysUntil(day: string, now: Date): number {
  const d = parseDay(day);
  if (!d) return 0;
  const today = parseDay(isoDay(now))!;
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

/** 明日 / あさって → the date. */
export function examDay(choice: "tomorrow" | "dayAfter", now: Date): string {
  return addDays(isoDay(now), choice === "tomorrow" ? 1 : 2);
}

/** 「10/20」 and 「火」 of a test date. */
export function dayParts(day: string): { md: string; wd: string } {
  const d = parseDay(day);
  if (!d) return { md: "", wd: "" };
  return { md: `${d.getMonth() + 1}/${d.getDate()}`, wd: app.exam.weekdays.charAt(d.getDay()) };
}

/** 「明日のテスト」「あさってのテスト」「10/24（金）のテスト」. */
export function whenTitle(day: string, now: Date): string {
  const { md, wd } = dayParts(day);
  return app.exam.whenTitle(daysUntil(day, now), md, wd);
}

/** 「テストまで あと1日」 (the HUD chip). */
export function countdown(day: string, now: Date): string {
  return app.exam.countdown(daysUntil(day, now));
}

// ---------- the range ----------

/** Default range: the child's grade's units that already have problems, in curriculum order. */
export function defaultRange(pages: SavedPage[], grade: Grade): string[] {
  const seen = new Set<string>();
  for (const pg of pages) for (const p of pg.problems) if (p.unit) seen.add(p.unit);
  return UNITS.filter((u) => u.appGrade === grade && seen.has(u.id)).map((u) => u.id);
}

/** Tap on a tile in the range step: in → out, out → in (curriculum order kept). */
export function toggleUnit(range: string[], id: string): string[] {
  if (range.includes(id)) return range.filter((x) => x !== id);
  return sortUnits([...range, id]);
}

/** 「この地帯を全部」: every unit of a grade in (or, when they all are already, out). */
export function toggleZone(range: string[], grade: Grade): { range: string[]; added: boolean } {
  const ids = UNITS.filter((u) => u.appGrade === grade).map((u) => u.id);
  const all = ids.every((id) => range.includes(id));
  if (all) return { range: range.filter((id) => !ids.includes(id)), added: false };
  return { range: sortUnits([...new Set([...range, ...ids])]), added: true };
}

/** Whether every unit of the grade is in the range (the zone button then offers 外す). */
export function zoneFull(range: string[], grade: Grade): boolean {
  return UNITS.filter((u) => u.appGrade === grade).every((u) => range.includes(u.id));
}

const ORDER = new Map(UNITS.map((u, i) => [u.id, i]));
function sortUnits(ids: string[]): string[] {
  return ids.filter((id) => ORDER.has(id)).sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);
}

// ---------- stored tests (one per date) ----------

export interface ExamTest {
  date: string;
  units: string[];
  /** Plan items ticked 「復習した」 for this test: they stay in tonight's plan (shown done). */
  kept: string[];
}

export interface ExamStore {
  /** The test the mode opens on (null: ask the date first). */
  current: string | null;
  tests: Record<string, ExamTest>;
}

export const EMPTY_STORE: ExamStore = { current: null, tests: {} };
/** Tests kept on the device (the newest dates). */
export const MAX_TESTS = 12;

/** The stored JSON → a store (anything broken → empty; unknown units dropped). */
export function parseStore(raw: string | null | undefined): ExamStore {
  if (!raw) return EMPTY_STORE;
  try {
    const v = JSON.parse(raw) as Partial<ExamStore>;
    const tests: Record<string, ExamTest> = {};
    for (const [date, t] of Object.entries(v.tests ?? {})) {
      if (!isDay(date) || !t || typeof t !== "object") continue;
      const units = Array.isArray(t.units) ? sortUnits(t.units.filter((u): u is string => typeof u === "string" && !!unitById(u))) : [];
      const kept = Array.isArray(t.kept) ? t.kept.filter((k): k is string => typeof k === "string") : [];
      tests[date] = { date, units, kept };
    }
    const current = isDay(v.current) && tests[v.current] ? v.current : null;
    return { current, tests };
  } catch {
    return EMPTY_STORE;
  }
}

/** Save a test (range and ticks) and make it the current one; only the newest MAX_TESTS dates stay. */
export function withTest(store: ExamStore, test: ExamTest): ExamStore {
  const tests = { ...store.tests, [test.date]: test };
  const keep = Object.keys(tests).sort().reverse().slice(0, MAX_TESTS);
  return { current: test.date, tests: Object.fromEntries(keep.map((d) => [d, tests[d]])) };
}

/** The current test, unless its day has passed (then the mode asks the date again). */
export function currentTest(store: ExamStore, now: Date): ExamTest | null {
  const t = store.current ? store.tests[store.current] : undefined;
  return t && daysUntil(t.date, now) >= 0 ? t : null;
}

/** A tick in the plan: the item's key joins (or leaves) the test's kept list. */
export function keepTick(test: ExamTest, key: string, checked: boolean): ExamTest {
  const kept = test.kept.filter((k) => k !== key);
  return { ...test, kept: checked ? [...kept, key] : kept };
}

// ---------- 今夜の作戦 ----------

export interface PlanItem extends SheetProblem {
  unit: Unit;
}

export interface PlanGroup {
  unit: Unit;
  items: PlanItem[];
  /** ② only: the range units this unit is a root of (「小5 平均 のもと」). */
  supports: Unit[];
}

export interface ExamPlan {
  range: Unit[];
  /** ① まず解き直す (by unit, the unit with the newest ✕ first). */
  first: PlanGroup[];
  /** ② つまずきのもと. */
  roots: PlanGroup[];
  /** ③ 念のため (not counted in tonight's work). */
  extra: PlanItem[];
  /** Range units without any problem yet (we cannot plan what we have not seen). */
  missing: Unit[];
  /** ①+② items, and how many of them are ticked 復習した. */
  total: number;
  done: number;
  /** めやす: total × MIN_PER_PROBLEM. */
  minutes: number;
  /** Every item of ① and ② ticked (and there was at least one). */
  complete: boolean;
  /** Units with ① / ② items still to do tonight (they pulse on the map). */
  todo: string[];
  /** Units of ① and ② (framed on the map with the range). */
  planUnits: string[];
}

/** Roots of the range from earlier grades: root id → the range units it supports (range order). */
export function planRoots(range: string[]): Map<string, string[]> {
  const inRange = new Set(range);
  const out = new Map<string, string[]>();
  for (const id of range)
    for (const r of [...rootIds(id), ...(PLAN_EXTRA_ROOTS[id] ?? [])]) {
      if (inRange.has(r)) continue;
      const list = out.get(r) ?? [];
      if (!list.includes(id)) list.push(id);
      out.set(r, list);
    }
  return out;
}

const itemKey = (pageId: string, index: number) => `${pageId}-${index}`;

/** Group items by unit, keeping the order in which units first appear (newest first). */
function groupByUnit(items: PlanItem[], supports: (id: string) => Unit[]): PlanGroup[] {
  const groups = new Map<string, PlanGroup>();
  for (const it of items) {
    const g = groups.get(it.unit.id) ?? { unit: it.unit, items: [], supports: supports(it.unit.id) };
    g.items.push(it);
    groups.set(it.unit.id, g);
  }
  return [...groups.values()];
}

/**
 * 今夜の作戦 for a range. `kept` = keys ticked in this test's plan: a reviewed problem stays in the plan
 * (shown done) only when it was ticked here, so the progress bar counts tonight's work, not old ticks.
 */
export function buildPlan(pages: SavedPage[], rangeIds: string[], kept: Iterable<string> = []): ExamPlan {
  const range = sortUnits(rangeIds).map((id) => unitById(id)!);
  const inRange = new Set(range.map((u) => u.id));
  const roots = planRoots(range.map((u) => u.id));
  const keep = new Set(kept);
  const gold = goldUnits(pages);
  const seen = new Set<string>();
  const first: PlanItem[] = [];
  const rootItems: PlanItem[] = [];
  const extra: PlanItem[] = [];
  const sorted = [...pages].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const page of sorted) {
    const date = shortDate(page.createdAt);
    const type = app.pageType[page.pageType] ?? app.pageType.other;
    page.problems.forEach((problem, index) => {
      if (!problem.unit) return;
      seen.add(problem.unit);
      const reason = reasonFor(problem);
      if (!reason) return;
      const key = itemKey(page.id, index);
      if (problem.reviewed && !keep.has(key)) return;
      const unit = unitById(problem.unit);
      if (!unit) return;
      const item: PlanItem = {
        key, page, index, problem, date, type, unit, reason,
        mark: problem.mark, source: markSourceOf(problem), sourceLabel: markSourceLabel(problem),
      };
      if (inRange.has(unit.id)) {
        if (gold.has(unit.id) || reason === "low") extra.push(item);
        else first.push(item);
      } else if (roots.has(unit.id) && reason === "wrong" && !gold.has(unit.id)) rootItems.push(item);
    });
  }
  const supports = (id: string) => (roots.get(id) ?? []).map((r) => unitById(r)!);
  const firstGroups = groupByUnit(first, () => []);
  const rootGroups = groupByUnit(rootItems, supports);
  const tonight = [...first, ...rootItems];
  const total = tonight.length;
  const done = tonight.filter((it) => it.problem.reviewed).length;
  const todo = [...new Set(tonight.filter((it) => !it.problem.reviewed).map((it) => it.unit.id))];
  return {
    range,
    first: firstGroups,
    roots: rootGroups,
    extra,
    missing: range.filter((u) => !seen.has(u.id)),
    total,
    done,
    minutes: total * MIN_PER_PROBLEM,
    complete: total > 0 && done === total,
    todo,
    planUnits: [...firstGroups, ...rootGroups].map((g) => g.unit.id),
  };
}

/** 「小5 平均」 (the grade only for units outside the child's grade, as in the テスト前リスト). */
export const unitName = (u: Unit) => `${u.appGrade} ${u.topic}`;

/** 「小4 数量の関係を表す式 — 小5 平均 のもと」. */
export function rootLabel(g: PlanGroup): string {
  return app.exam.rootFor(g.unit.appGrade, g.unit.topic, g.supports.map(unitName).join("・"));
}

/** 「まだ撮っていない単元：分数 ほか2」, or null. */
export function missingLine(plan: ExamPlan): string | null {
  if (plan.missing.length === 0) return null;
  return app.exam.missing(plan.missing[0].topic, plan.missing.length - 1);
}

/** The range as one line: 「小5 平面図形の面積・割合・平均」 (grades grouped, curriculum order). */
export function rangeLine(range: Unit[]): string {
  const byGrade = new Map<string, string[]>();
  for (const u of range) byGrade.set(u.appGrade, [...(byGrade.get(u.appGrade) ?? []), u.topic]);
  return [...byGrade].map(([g, ts]) => `${g} ${ts.join("・")}`).join(" ／ ");
}

/** One summary row per group: label + problems (and how many are done), for the parent summary. */
export interface SummaryRow {
  section: "first" | "roots" | "extra";
  label: string;
  count: number;
  done: number;
}

export function summaryRows(plan: ExamPlan): SummaryRow[] {
  const rows: SummaryRow[] = [];
  const row = (section: SummaryRow["section"], label: string, items: PlanItem[]) =>
    rows.push({ section, label, count: items.length, done: items.filter((i) => i.problem.reviewed).length });
  for (const g of plan.first) row("first", unitName(g.unit), g.items);
  for (const g of plan.roots) row("roots", rootLabel(g), g.items);
  if (plan.extra.length > 0) row("extra", [...new Set(plan.extra.map((i) => unitName(i.unit)))].join("・"), plan.extra);
  return rows;
}

/** The text shared with the Web Share API (or copied): the summary screen in plain lines. */
export function shareText(plan: ExamPlan, day: string, now: Date): string {
  const e = app.exam;
  const head = `【${e.summary}】${e.summaryWhen(whenTitle(day, now), dayParts(day).md)}`;
  const lines = [head, e.summaryLine(e.summaryRange, rangeLine(plan.range))];
  lines.push(plan.total > 0 ? `${e.tonight(plan.total, plan.minutes)}（${e.progress(plan.done, plan.total)}）` : e.tonightNone);
  const sec = { first: `①${e.first}`, roots: `②${e.roots}`, extra: `③${e.extra}` };
  for (const r of summaryRows(plan)) lines.push(`${sec[r.section]}：${r.label} ${r.done === r.count ? e.rowDone(r.count) : e.count(r.count)}`);
  const miss = missingLine(plan);
  if (miss) lines.push(miss);
  lines.push(e.signature);
  return lines.join("\n");
}
