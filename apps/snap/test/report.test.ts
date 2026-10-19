import { describe, expect, it } from "vitest";
import type { SavedPage, SavedProblem } from "../src/lib/model";
import { buildReport, lastWeek, listUrl } from "../src/lib/report";
import { goldUnits, readiness, splitTestList, testList } from "../src/lib/review";
import type { Mark } from "../src/reader/schema";

let seq = 0;
function page(createdAt: string, probs: [unit: string | null, mark: Mark, reviewed?: boolean][]): SavedPage {
  const problems: SavedProblem[] = probs.map(([unit, mark, reviewed], i) => ({
    n: i + 1, q: `q${i}`, unit, answer: null, mark, confidence: 0.95, reviewed: !!reviewed,
  }));
  return { id: `r${seq++}`, createdAt, grade: "小5", pageType: "test", score: null, problems };
}

// Same shape as the screenshot seed: gold, green, red in 小5; red in 小4 and 小3.
const NOW = new Date("2026-10-19T05:00:00Z");
const PAGES = [
  page("2026-10-01T09:00:00Z", [["5-A1", "○"], ["5-A1", "○"], ["5-A3", "✕", true], ["5-A3", "○"]]),
  page("2026-10-03T09:00:00Z", [["5-B1", "✕"], ["5-B1", "✕"], ["5-D1", null], ["5-C1", "✕"], ["5-C1", "○"]]),
  page("2026-10-10T09:00:00Z", [["5-B1", "○"], ["5-B1", "○"], ["4-A2", "✕"]]),
  page("2026-10-12T09:00:00Z", [["4-C2", "✕"], ["4-C2", "✕"], ["3-A4", "✕"], ["6-C2", "○"]]),
  page("2026-10-18T09:00:00Z", [["5-C3", "○"], ["5-C3", "✕"], ["5-C3", "✕"], [null, "✕"]]),
];

describe("テスト前リスト: 念のため for gold units", () => {
  it("a gold unit's old ✕ go to 念のため, not the main list", () => {
    expect(goldUnits(PAGES)).toEqual(new Set(["5-A1", "5-B1", "6-C2"]));
    const { main, nennotame } = splitTestList(PAGES, ["5-B1", "5-C3"]);
    expect(main.map((i) => i.problem.unit)).toEqual(["5-C3", "5-C3"]);
    expect(nennotame.map((i) => i.problem.unit)).toEqual(["5-B1", "5-B1"]);
    expect(nennotame.every((i) => i.reason === "wrong")).toBe(true);
    // Together they are still exactly the full test list.
    expect(main.length + nennotame.length).toBe(testList(PAGES, ["5-B1", "5-C3"]).length);
  });

  it("readiness counts only the main list", () => {
    expect(readiness(PAGES, ["5-B1"])).toBe(100); // old ✕ are not pending
    expect(readiness(PAGES, ["5-C3"])).toBe(33); // 1 of 3 needs nothing more
    expect(readiness(PAGES, ["5-B1", "5-C3"])).toBe(71); // 5 of 7
    expect(splitTestList(PAGES, ["5-B1"]).main).toHaveLength(0);
  });

  it("non-gold units are unchanged", () => {
    const ids = ["5-C1", "5-C3", "5-A3", "4-C2"];
    const { main, nennotame } = splitTestList(PAGES, ids);
    expect(main).toEqual(testList(PAGES, ids));
    expect(nennotame).toHaveLength(0);
  });
});

describe("学習レポート", () => {
  const rep = buildReport(PAGES, "小5", NOW);

  it("counts the states of the child's grade units", () => {
    expect(rep.total).toBe(15);
    expect(rep.counts).toEqual({ settled: 0, master: 2, reviewed: 2, trying: 2, mada: 9 });
    expect(rep.pages).toBe(5);
    expect(rep.lastAt).toBe("2026-10-18T09:00:00Z");
    expect(rep.chips.master.map((u) => u.id)).toEqual(["5-A1", "5-B1"]);
    expect(rep.chips.trying.map((u) => u.id)).toEqual(["5-C1", "5-C3"]);
    expect(rep.chips.reviewed.map((u) => u.id)).toEqual(["5-A3", "5-D1"]);
  });

  it("次にやること: red units of the grade, most open ✕ first, up to 3", () => {
    expect(rep.next.map((n) => [n.unit.id, n.wrong])).toEqual([["5-C3", 2], ["5-C1", 1]]);
    const many = [
      ...PAGES,
      page("2026-10-18T10:00:00Z", [["5-A2", "✕"], ["5-D2", "✕"], ["5-D2", "✕"], ["5-D2", "✕"], ["5-B2", "✕"]]),
    ];
    expect(buildReport(many, "小5", NOW).next.map((n) => n.unit.id)).toEqual(["5-D2", "5-C3", "5-A2"]);
    expect(listUrl(rep.next.map((n) => n.unit.id))).toBe("/app/list?units=5-C3,5-C1");
  });

  it("前の学年: earlier-grade red units, nearest grade first, with the unit they support", () => {
    expect(rep.earlier.map((e) => [e.unit.id, e.wrong, e.supports?.id ?? null])).toEqual([
      ["4-C2", 2, "5-C3"], // 簡単な割合 → 割合 (red unit preferred over 5-C2 with no data)
      ["4-A2", 1, null], // 概数: no 小5 unit roots in it
      ["3-A4", 1, "5-A1"], // 除法, two grades down, via the root path
    ]);
    expect(buildReport(PAGES, "小3", NOW).earlier).toHaveLength(0); // nothing red below 小3
    expect(buildReport(PAGES, "小1", NOW).earlier).toHaveLength(0);
  });

  it("この1週間: pages, problems and ✕ of the last 7 days by createdAt", () => {
    expect(rep.week).toEqual({ pages: 2, problems: 8, wrong: 6 }); // 10-12 and 10-18 (a ✕ without a unit counts too)
    expect(lastWeek(PAGES, new Date("2026-10-30T00:00:00Z"))).toEqual({ pages: 0, problems: 0, wrong: 0 });
    expect(lastWeek([page("2026-10-25T00:00:00Z", [["5-C3", "✕"]])], NOW).pages).toBe(0); // future dates ignored
  });

  it("empty state: no pages", () => {
    const e = buildReport([], "小5", NOW);
    expect(e).toMatchObject({ pages: 0, lastAt: null, total: 15, next: [], earlier: [] });
    expect(e.counts).toEqual({ settled: 0, master: 0, reviewed: 0, trying: 0, mada: 15 });
    expect(e.week).toEqual({ pages: 0, problems: 0, wrong: 0 });
    expect(e.chips).toEqual({ settled: [], master: [], trying: [], reviewed: [] });
  });
});
