import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { GRADES, UNITS, unitById } from "../src/curriculum";
import { parseBackup } from "../src/lib/backup";
import { buildStrip, focusFromParam } from "../src/lib/home";
import { type SavedPage, migratePage } from "../src/lib/model";
import { buildReport } from "../src/lib/report";
import { mapTiles } from "../src/lib/review";
import { SKY, gradeCounts, gradesAbove, layoutStarmap, nearGrades, rootIds } from "../src/lib/starmap";
import { _resetDbHandle, allPages, savePage } from "../src/lib/store";
import { readerPrompt } from "../src/reader/prompt";
import { toPageResult } from "../src/reader/schema";
import type { Mark } from "../src/reader/schema";

/** 高校 as three grades (19 Oct 2026): star chart, report, reader list and the 「高校」 → 高1 migration. */

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

describe("star chart for a 高2 child", () => {
  it("near = 高2 + 高1; only 高3 above (one merged row); 中3 … 小1 as far bands", () => {
    expect([...nearGrades("高2")].sort()).toEqual(["高1", "高2"]);
    expect(gradesAbove("高2")).toEqual(["高3"]);
    const L = layoutStarmap(358, nearGrades("高2"), { grades: gradesAbove("高2"), merged: true });
    expect(L.nodes).toHaveLength(110);
    expect(L.upper).toMatchObject({ merged: true, grades: ["高3"], y: 0, h: SKY.farH });
    expect(L.bands.map((b) => b.grade)).toEqual(GRADES.filter((g) => g !== "高3").reverse());
    expect(L.bands.find((b) => b.grade === "高2")).toMatchObject({ near: true, y: SKY.farH });
    expect(L.bands.find((b) => b.grade === "高1")?.near).toBe(true);
    expect(L.bands.find((b) => b.grade === "中3")?.near).toBe(false);
    // Near 高2 stars are labelled 44 px buttons; 高3 stars sit in the merged row.
    for (const n of L.nodes.filter((x) => x.grade === "高2")) expect([n.far, n.h >= 44]).toEqual([false, true]);
    for (const n of L.nodes.filter((x) => x.grade === "高3")) expect([n.far, n.cy]).toEqual([true, SKY.farStarY]);
    for (let i = 0; i < L.nodes.length; i++)
      for (let j = i + 1; j < L.nodes.length; j++) {
        const a = L.nodes[i];
        const b = L.nodes[j];
        expect(a.x < b.x + b.w - 0.001 && b.x < a.x + a.w - 0.001 && a.y < b.y + b.h && b.y < a.y + a.h, `${a.id} / ${b.id}`).toBe(false);
      }
  });

  it("a 中3 child sees 「高1〜高3」 merged; a 高3 child has nothing above", () => {
    expect(gradesAbove("中3")).toEqual(["高1", "高2", "高3"]);
    expect(layoutStarmap(358, nearGrades("高3"), { grades: gradesAbove("高3"), merged: true }).upper).toBeNull();
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
    expect(gradeCounts(tiles, "高2")).toEqual({ review: 1, ok: 1, gold: 1, empty: 5 });
    expect(gradeCounts(tiles, "高1")).toMatchObject({ review: 1, empty: 6 });
    expect(gradeCounts(tiles, "高3")).toMatchObject({ empty: 6 });
  });
});

describe("report + strip for a 高2 child", () => {
  it("counts the 8 units of 高2; 数学I ✕ shows as an earlier-grade unit with the 高2 unit it supports", () => {
    const r = buildReport(KOKO2, "高2", NOW);
    expect(r.total).toBe(8);
    expect(r.counts).toEqual({ gold: 1, ok: 1, review: 1, empty: 5 });
    expect(r.next.map((n) => [n.unit.id, n.wrong])).toEqual([["h-II-4", 2]]);
    expect(r.earlierIds).toEqual(["h-I-3"]);
    expect(r.earlier[0].supports?.appGrade).toBe("高2");
    expect(r.chips.gold.map((u) => u.id)).toEqual(["h-B-1"]);
    const s = buildStrip(KOKO2, "高2", NOW);
    expect([s.grade, s.total, s.earlier]).toEqual(["高2", 8, ["h-I-3"]]);
    // ?unit= on a 高3 star opens its band; 高1 is near already.
    expect(focusFromParam("h-III-2", "高2")).toEqual({ selected: "h-III-2", opened: "高3" });
    expect(focusFromParam("h-I-3", "高2")).toEqual({ selected: "h-I-3", opened: null });
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
