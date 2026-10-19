import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { GRADES, UNITS, unitById } from "../src/curriculum";
import { parseBackup } from "../src/lib/backup";
import { buildStrip, focusFromParam } from "../src/lib/home";
import { type SavedPage, migratePage } from "../src/lib/model";
import { buildReport } from "../src/lib/report";
import { mapTiles } from "../src/lib/review";
import { gradeCounts, rootIds } from "../src/lib/starmap";
import { buildHud, territory } from "../src/lib/territory";
import { _resetDbHandle, allPages, savePage } from "../src/lib/store";
import { readerPrompt } from "../src/reader/prompt";
import { toPageResult } from "../src/reader/schema";
import type { Mark } from "../src/reader/schema";

/** 高校 as three grades (19 Oct 2026): territory, report, reader list and the 「高校」 → 高1 migration. */

let seq = 0;
function page(grade: string, createdAt: string, probs: [string | null, Mark, boolean?][]): SavedPage {
  return {
    id: `k${seq++}`,
    createdAt,
    grade: grade as SavedPage["grade"],
    pageType: "test",
    score: null,
    problems: probs.map(([unit, mark, reviewed], i) => ({ n: i + 1, q: `q${i}`, unit, answer: null, mark, confidence: 0.95, reviewed: !!reviewed })),
  };
}

// A 高2 child: 数学II 三角関数 red, 数学B 数列 gold, 数学II いろいろな式 ✕ reviewed; 数学I 二次関数 red (the year below).
const NOW = new Date("2026-10-19T05:00:00Z");
const KOKO2 = [
  page("高2", "2026-10-10T09:00:00Z", [["h-II-4", "✕"], ["h-II-4", "✕"], ["h-II-4", "○"], ["h-II-1", "✕", true], ["h-I-3", "✕"]]),
  page("高2", "2026-10-15T09:00:00Z", [["h-B-1", "○"], ["h-B-1", "○"]]),
];

describe("territory for a 高2 child", () => {
  it("territory: 高1 = 数学I + 数学A islands, 高2 = II + B, 高3 = III + C; each holds exactly its school year's units", () => {
    const T = territory();
    expect(T.byGrade.get("高1")!.districts.sort()).toEqual(["数学A", "数学I"]);
    expect(T.byGrade.get("高2")!.districts.sort()).toEqual(["数学B", "数学II"]);
    expect(T.byGrade.get("高3")!.districts.sort()).toEqual(["数学C", "数学III"]);
    for (const g of ["高1", "高2", "高3"] as const)
      expect(T.units.filter((u) => u.grade === g).map((u) => u.id).sort()).toEqual(UNITS.filter((u) => u.appGrade === g).map((u) => u.id).sort());
  });

  it("roots now run 数学II → 数学I and 数学III → 数学II (still 数学I → 中3)", () => {
    for (const id of ["h-II-1", "h-II-2", "h-II-3", "h-II-4", "h-II-5", "h-B-1", "h-B-2"])
      for (const r of rootIds(id)) expect(unitById(r)?.appGrade, `${id} ← ${r}`).toBe("高1");
    for (const id of ["h-III-1", "h-III-2", "h-III-3", "h-C-1", "h-C-3"])
      for (const r of rootIds(id)) expect(unitById(r)?.appGrade, `${id} ← ${r}`).toBe("高2");
    expect(rootIds("h-I-3")).toEqual(["j3-C1"]);
    for (const u of UNITS.filter((x) => x.level === "高")) expect(rootIds(u.id).length, u.id).toBeGreaterThan(0);
  });

  it("tiles and counts are per school year", () => {
    const tiles = mapTiles(KOKO2);
    expect(gradeCounts(tiles, "高2")).toEqual({ trying: 1, reviewed: 1, master: 1, settled: 0, mada: 5 });
    expect(gradeCounts(tiles, "高1")).toMatchObject({ trying: 1, mada: 6 });
    expect(gradeCounts(tiles, "高3")).toMatchObject({ mada: 6 });
  });
});

describe("report + HUD for a 高2 child", () => {
  it("counts the 8 units of 高2; 数学I ✕ shows as an earlier-grade unit with the 高2 unit it supports", () => {
    const r = buildReport(KOKO2, "高2", NOW);
    expect(r.total).toBe(8);
    expect(r.counts).toEqual({ settled: 0, master: 1, reviewed: 1, trying: 1, mada: 5 });
    expect(r.next.map((n) => [n.unit.id, n.wrong])).toEqual([["h-II-4", 2]]);
    expect(r.earlierIds).toEqual(["h-I-3"]);
    expect(r.earlier[0].supports?.appGrade).toBe("高2");
    expect(r.chips.master.map((u) => u.id)).toEqual(["h-B-1"]);
    const s = buildStrip(KOKO2, "高2", NOW);
    expect([s.grade, s.total, s.earlier]).toEqual(["高2", 8, ["h-I-3"]]);
    // ?unit= on any island opens that unit
    expect(focusFromParam("h-III-2", "高2")).toEqual({ selected: "h-III-2" });
    // HUD: 高2 card = the report's counts; the 高 bar counts the whole high school
    const hud = buildHud(KOKO2, "高2", NOW);
    expect([hud.taken, hud.total, hud.counts.trying]).toEqual([3, 8, 1]);
    expect(hud.levels["高"]).toEqual({ taken: 4, total: 21 });
    expect(hud.next).toEqual(["h-II-4", "h-I-3"]);
  });
});

describe("reader for high-school grades", () => {
  it("prompt lists own year + the year below; 数学I units stay valid on a 高2 page, 数学III do not", () => {
    const p = readerPrompt("高2");
    expect(p).toContain("h-II-4\t数学II");
    expect(p).toContain("h-I-3\t数学I");
    expect(p).not.toContain("h-III-2\t");
    expect(readerPrompt("高1")).toContain("j3-C1\t中3");
    const r = toPageResult({ page_type: "test", problems: [{ q: "a", unit: "h-I-3" }, { q: "b", unit: "h-III-2" }, { q: "c", unit: "h-B-1" }] }, "高2");
    expect(r.problems.map((x) => x.unit)).toEqual(["h-I-3", null, "h-B-1"]);
  });
});

describe("migration: saved grade 「高校」 → 高1", () => {
  beforeEach(async () => {
    await _resetDbHandle();
    await new Promise<void>((res, rej) => {
      const r = indexedDB.deleteDatabase("lens-snap");
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  });

  it("pages in IndexedDB saved as 高校 read back as 高1 (other grades untouched)", async () => {
    await savePage(page("高校", "2026-10-01T00:00:00.000Z", [["h-I-3", "✕"]]));
    await savePage(page("小5", "2026-10-02T00:00:00.000Z", [["5-C3", "○"]]));
    const got = await allPages();
    expect(got.map((p) => p.grade)).toEqual(["小5", "高1"]);
    const same = page("中2", "2026-10-01T00:00:00.000Z", [["j2-A1", null]]);
    same.problems[0].markSource = null;
    expect(migratePage(same)).toBe(same); // nothing to change → same object
  });

  it("a backup with grade 高校 (file and pages) restores as 高1; an unknown grade is still rejected", () => {
    const file = (grade: string) =>
      JSON.stringify({ app: "lens-snap", version: 1, exportedAt: "2026-10-18T00:00:00Z", grade, pages: [{ id: "a", createdAt: "2026-10-01T00:00:00.000Z", grade, pageType: "test", score: null, problems: [{ n: 1, q: "x", unit: "h-A-2", answer: "1", mark: "✕", confidence: 0.9, reviewed: false }] }] });
    const pages = parseBackup(file("高校"));
    expect(pages[0].grade).toBe("高1");
    expect(pages[0].problems[0].markSource).toBe("teacher");
    expect(() => parseBackup(file("高4"))).toThrow();
  });
});

describe("migration: the grade in localStorage", () => {
  it("「高校」 → 高1, written back, and the grade badge is flagged for a check; a current grade is not flagged", async () => {
    const store = new Map<string, string>();
    const ls = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    const prev = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = ls;
    try {
      const { loadGrade, GRADE_CHECK_PREF } = await import("../src/state");
      store.set("lens-snap:grade", "高校");
      expect(loadGrade()).toBe("高1");
      expect(store.get("lens-snap:grade")).toBe("高1");
      expect(store.get(`lens-snap:${GRADE_CHECK_PREF}`)).toBe("1");
      store.clear();
      store.set("lens-snap:grade", "高2");
      expect(loadGrade()).toBe("高2");
      expect(store.has(`lens-snap:${GRADE_CHECK_PREF}`)).toBe(false);
      store.set("lens-snap:grade", "nope");
      expect(loadGrade()).toBeNull();
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = prev;
    }
  });
});
