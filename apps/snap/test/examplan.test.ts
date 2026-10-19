import { describe, expect, it } from "vitest";
import {
  EMPTY_STORE,
  MAX_TESTS,
  MIN_PER_PROBLEM,
  addDays,
  buildPlan,
  countdown,
  currentTest,
  dayParts,
  daysUntil,
  defaultRange,
  examDay,
  isoDay,
  keepTick,
  missingLine,
  parseStore,
  planRoots,
  rangeLine,
  rootLabel,
  shareText,
  summaryRows,
  toggleUnit,
  toggleZone,
  whenTitle,
  withTest,
  zoneFull,
} from "../src/lib/examplan";
import type { SavedPage } from "../src/lib/model";
import { RANGE, founderPages } from "./founder-pages";
import { UNITS, unitById } from "../src/curriculum";

const NOW = new Date(2026, 9, 19, 21, 30); // Mon 19 Oct 2026, 21:30 local

const tick = (pages: SavedPage[], pageId: string, index: number): SavedPage[] =>
  pages.map((pg) => (pg.id !== pageId ? pg : { ...pg, problems: pg.problems.map((p, j) => (j === index ? { ...p, reviewed: true } : p)) }));

describe("dates and the countdown (device local time)", () => {
  it("明日 / あさって, days until, month ends", () => {
    expect(isoDay(NOW)).toBe("2026-10-19");
    expect(examDay("tomorrow", NOW)).toBe("2026-10-20");
    expect(examDay("dayAfter", NOW)).toBe("2026-10-21");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(daysUntil("2026-10-20", NOW)).toBe(1);
    expect(daysUntil("2026-10-19", NOW)).toBe(0);
    expect(daysUntil("2026-10-18", NOW)).toBe(-1);
    expect(daysUntil("2026-11-02", new Date(2026, 10, 1, 0, 5))).toBe(1); // just after midnight
  });
  it("「明日のテスト」「あさってのテスト」「10/24（土）のテスト」 and 「テストまで あと1日」", () => {
    expect(whenTitle("2026-10-20", NOW)).toBe("明日のテスト");
    expect(whenTitle("2026-10-21", NOW)).toBe("あさってのテスト");
    expect(whenTitle("2026-10-24", NOW)).toBe("10/24（土）のテスト");
    expect(whenTitle("2026-10-19", NOW)).toBe("今日のテスト");
    expect(dayParts("2026-10-20")).toEqual({ md: "10/20", wd: "火" });
    expect(countdown("2026-10-20", NOW)).toBe("テストまで あと1日");
    expect(countdown("2026-10-23", NOW)).toBe("テストまで あと4日");
    expect(countdown("2026-10-19", NOW)).toBe("テストは今日");
  });
});

describe("the range", () => {
  it("default = the child's grade's units that have data, in curriculum order", () => {
    expect(defaultRange(founderPages(), "小5")).toEqual(RANGE);
    expect(defaultRange(founderPages(), "小4")).toEqual(["4-A4", "4-A6"]);
    expect(defaultRange([], "小5")).toEqual([]);
  });
  it("tap toggles a unit; 「この地帯を全部」 adds the whole zone, again removes it", () => {
    expect(toggleUnit(RANGE, "5-A4")).toEqual(["5-A4", "5-B3", "5-C3", "5-D2"]);
    expect(toggleUnit(RANGE, "5-C3")).toEqual(["5-B3", "5-D2"]);
    const all = toggleZone(["4-A6", "5-D2"], "小5");
    const xiao5 = UNITS.filter((u) => u.appGrade === "小5").map((u) => u.id);
    expect(all.added).toBe(true);
    expect(all.range).toEqual(["4-A6", ...xiao5]);
    expect(zoneFull(all.range, "小5")).toBe(true);
    expect(toggleZone(all.range, "小5")).toEqual({ range: ["4-A6"], added: false });
  });
  it("roots of the range from earlier grades (starmap + the plan's 平均 ← 式 link), never a range unit", () => {
    const r = planRoots(RANGE);
    expect(r.get("4-B4")).toEqual(["5-B3"]); // 平面図形の面積 ← 小4 平面図形の面積
    expect(r.get("4-C2")).toEqual(["5-C3"]); // 割合 ← 簡単な割合
    expect(r.get("4-A6")).toEqual(["5-D2"]); // 平均 ← 数量の関係を表す式 (四則混合と ( ) の式)
    expect(r.get("4-D1")).toEqual(["5-D2"]);
    expect(planRoots(["5-D2", "4-A6"]).has("4-A6")).toBe(false);
  });
});

describe("今夜の作戦 (the founder's three sheets, test tomorrow, range 平面図形の面積 + 割合 + 平均)", () => {
  const pages = founderPages();
  const plan = buildPlan(pages, RANGE);
  it("① まず解き直す: the unreviewed ✕ of 平均, newest first, in one group (平面図形の面積 and 割合 are gold)", () => {
    expect(plan.first.map((g) => g.unit.id)).toEqual(["5-D2"]);
    expect(plan.first[0].items.map((i) => i.key)).toEqual(["zukei-1", "zukei-2", "live4-1"]);
    expect(plan.first[0].items.every((i) => i.mark === "✕" && i.sourceLabel === "AI判定")).toBe(true);
  });
  it("② つまずきのもと: the ✕ of 小4 数量の関係を表す式, labelled as the root of 小5 平均", () => {
    expect(plan.roots.map((g) => g.unit.id)).toEqual(["4-A6"]);
    expect(plan.roots[0].items.map((i) => i.key)).toEqual(["live4-2"]);
    expect(plan.roots[0].items[0].problem.correctAnswer).toBe("480円");
    expect(rootLabel(plan.roots[0])).toBe("小4 数量の関係を表す式 — 小5 平均 のもと");
  });
  it("③ 念のため: the low-confidence reading in the range; nothing else", () => {
    expect(plan.extra.map((i) => [i.key, i.reason])).toEqual([["poly-2", "low"]]);
  });
  it("plan line numbers: 4 problems, 5 minutes each, nothing done, no missing units", () => {
    expect(MIN_PER_PROBLEM).toBe(5);
    expect([plan.total, plan.done, plan.minutes, plan.complete]).toEqual([4, 0, 20, false]);
    expect(plan.missing).toEqual([]);
    expect(missingLine(plan)).toBeNull();
    expect(plan.todo).toEqual(["5-D2", "4-A6"]);
    expect(plan.planUnits).toEqual(["5-D2", "4-A6"]);
  });
  it("a tick in the plan stays in it (done); an old tick from before the plan does not count", () => {
    const ticked = tick(pages, "live4", 2);
    const kept = buildPlan(ticked, RANGE, ["live4-2"]);
    expect([kept.total, kept.done]).toEqual([4, 1]);
    expect(kept.todo).toEqual(["5-D2"]);
    const old = buildPlan(ticked, RANGE, []);
    expect([old.total, old.done, old.roots.length]).toEqual([3, 0, 0]);
  });
  it("everything of ① and ② ticked → complete; ③ stays as it was", () => {
    let pg = pages;
    const keys = ["zukei-1", "zukei-2", "live4-1", "live4-2"];
    for (const k of keys) {
      const [id, i] = k.split("-");
      pg = tick(pg, id, Number(i));
    }
    const done = buildPlan(pg, RANGE, keys);
    expect([done.total, done.done, done.complete, done.extra.length]).toEqual([4, 4, true, 1]);
    expect(done.todo).toEqual([]);
  });
  it("units with no page are listed (we cannot plan what we have not seen)", () => {
    const p = buildPlan(pages, [...RANGE, "5-A4", "5-A5", "5-B4"]);
    expect(p.missing.map((u) => u.id)).toEqual(["5-A4", "5-A5", "5-B4"]);
    expect(missingLine(p)).toBe("まだ撮っていない単元：分数 ほか2");
    expect(p.total).toBe(4);
    const none = buildPlan([], ["5-A4"]);
    expect([none.total, none.complete, none.missing.length]).toEqual([0, false, 1]);
  });
  it("a gold range unit's older ✕ goes to ③; a red root (same strand) joins ②; a gold root does not", () => {
    const older: SavedPage = {
      id: "old", createdAt: "2026-10-01T09:00:00.000Z", grade: "小5", pageType: "test", score: null,
      problems: [
        { n: 1, q: "割合（前の✕）", unit: "5-C3", answer: "1", mark: "✕", confidence: 0.95, reviewed: false },
        { n: 2, q: "簡単な割合", unit: "4-C2", answer: "1", mark: "✕", confidence: 0.95, reviewed: false },
        { n: 3, q: "小4 面積", unit: "4-B4", answer: "1", mark: "✕", confidence: 0.95, reviewed: false },
      ],
    };
    const gold4: SavedPage = { ...older, id: "g4", createdAt: "2026-10-02T09:00:00.000Z", problems: [{ n: 1, q: "面積", unit: "4-B4", answer: "1", mark: "○", confidence: 0.95, reviewed: false }] };
    const p = buildPlan([...founderPages(), older, gold4], RANGE);
    expect(p.extra.map((i) => i.key)).toEqual(["poly-2", "old-0"]);
    expect(p.roots.map((g) => [g.unit.id, g.supports.map((u) => u.id)])).toEqual([
      ["4-A6", ["5-D2"]],
      ["4-C2", ["5-C3"]],
    ]);
  });
});

describe("stored tests (one per date)", () => {
  it("parses only what it understands", () => {
    expect(parseStore(null)).toEqual(EMPTY_STORE);
    expect(parseStore("{not json")).toEqual(EMPTY_STORE);
    const st = parseStore(JSON.stringify({ current: "2026-10-20", tests: { "2026-10-20": { units: ["5-D2", "x-1", 3, "5-B3"], kept: ["a", 1] }, bad: { units: [] } } }));
    expect(st).toEqual({ current: "2026-10-20", tests: { "2026-10-20": { date: "2026-10-20", units: ["5-B3", "5-D2"], kept: ["a"] } } });
    expect(parseStore(JSON.stringify({ current: "2026-10-22", tests: {} })).current).toBeNull();
  });
  it("remembers the range per test, keeps the newest dates, forgets a past test as current", () => {
    let st = withTest(EMPTY_STORE, { date: "2026-10-20", units: RANGE, kept: [] });
    st = withTest(st, { date: "2026-10-27", units: ["5-A4"], kept: [] });
    expect(st.current).toBe("2026-10-27");
    expect(st.tests["2026-10-20"].units).toEqual(RANGE);
    for (let i = 0; i < MAX_TESTS + 3; i++) st = withTest(st, { date: addDays("2026-11-01", i), units: [], kept: [] });
    expect(Object.keys(st.tests)).toHaveLength(MAX_TESTS);
    expect(st.tests["2026-10-20"]).toBeUndefined();
    const t = withTest(EMPTY_STORE, { date: "2026-10-20", units: RANGE, kept: [] });
    expect(currentTest(t, NOW)?.units).toEqual(RANGE);
    expect(currentTest(t, new Date(2026, 9, 21, 8))).toBeNull();
  });
  it("ticks join and leave the test's kept list", () => {
    const t = { date: "2026-10-20", units: RANGE, kept: ["a"] };
    expect(keepTick(t, "b", true).kept).toEqual(["a", "b"]);
    expect(keepTick(t, "a", false).kept).toEqual([]);
    expect(keepTick(keepTick(t, "a", true), "a", true).kept).toEqual(["a"]);
  });
});

describe("the parent summary", () => {
  it("rows per group, the range line, and the shared text (no scores, no promises)", () => {
    const pages = tick(founderPages(), "live4", 2);
    const plan = buildPlan(pages, RANGE, ["live4-2"]);
    expect(rangeLine(plan.range)).toBe("小5 平面図形の面積・割合・平均");
    expect(rangeLine([unitById("4-A6")!, unitById("5-D2")!])).toBe("小4 数量の関係を表す式 ／ 小5 平均");
    expect(summaryRows(plan)).toEqual([
      { section: "first", label: "小5 平均", count: 3, done: 0 },
      { section: "roots", label: "小4 数量の関係を表す式 — 小5 平均 のもと", count: 1, done: 1 },
      { section: "extra", label: "小5 平均", count: 1, done: 0 },
    ]);
    const text = shareText(plan, "2026-10-20", NOW);
    expect(text.split("\n")).toEqual([
      "【テスト前の作戦】明日のテスト（10/20）",
      "範囲：小5 平面図形の面積・割合・平均",
      "今夜やること：4問 ・ めやす 約20分（復習した 1 / 4）",
      "①まず解き直す：小5 平均 3問",
      "②つまずきのもと：小4 数量の関係を表す式 — 小5 平均 のもと 1問 済",
      "③念のため：小5 平均 1問",
      "Lens Snap で作成",
    ]);
    expect(text).not.toMatch(/点数|%|％|合格|上がる|アップ/);
  });
});
