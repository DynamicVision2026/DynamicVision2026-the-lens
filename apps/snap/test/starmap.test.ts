import { describe, expect, it } from "vitest";
import { GRADES, type Grade, UNITS, unitById } from "../src/curriculum";
import type { SavedPage } from "../src/lib/model";
import { mapTiles } from "../src/lib/review";
import {
  HIGH_SCHOOL_LANES,
  LANES,
  edgeKey,
  gradeCounts,
  gradesAbove,
  laneOf,
  laneUnits,
  SKY,
  layoutStarmap,
  nearGrades,
  rootIds,
  rootPath,
  rootsOf,
  sheetData,
} from "../src/lib/starmap";

describe("lanes", () => {
  it("every one of the 110 units gets exactly one lane", () => {
    expect(UNITS).toHaveLength(110);
    const placed = GRADES.flatMap((g) => LANES.flatMap((l) => laneUnits(g, l).map((u) => u.id)));
    expect(placed).toHaveLength(110);
    expect(new Set(placed)).toEqual(new Set(UNITS.map((u) => u.id)));
    for (const u of UNITS) expect(LANES).toContain(laneOf(u));
  });

  it("the 高校 table covers exactly the 21 high-school units", () => {
    const hs = UNITS.filter((u) => u.level === "高").map((u) => u.id);
    expect(hs).toHaveLength(21);
    expect(Object.keys(HIGH_SCHOOL_LANES).sort()).toEqual([...hs].sort());
  });

  it("小・中 follow the 領域 letter; a few 高校 spot checks", () => {
    const lane = (id: string) => laneOf(unitById(id)!);
    expect([lane("1-A1"), lane("2-B1"), lane("3-C1"), lane("5-D2")]).toEqual(["num", "geo", "rel", "data"]);
    expect([lane("j1-A1"), lane("j2-B2"), lane("j3-C1"), lane("j3-D1")]).toEqual(["num", "geo", "rel", "data"]);
    expect([lane("h-I-1"), lane("h-I-2"), lane("h-I-3"), lane("h-I-4")]).toEqual(["num", "geo", "rel", "data"]);
    expect([lane("h-B-1"), lane("h-C-1"), lane("h-A-2")]).toEqual(["num", "geo", "data"]);
  });
});

describe("roots (もとになる単元)", () => {
  it("same lane, nearest lower grade that has that lane, at most 3", () => {
    for (const u of UNITS) {
      const roots = rootsOf(u);
      expect(roots.length).toBeLessThanOrEqual(3);
      const gi = GRADES.indexOf(u.appGrade);
      if (gi === 0) expect(roots).toEqual([]);
      if (roots.length === 0) continue;
      const rg = roots[0].appGrade;
      for (const r of roots) {
        expect(laneOf(r)).toBe(laneOf(u));
        expect(r.appGrade).toBe(rg);
      }
      // nearest: no grade between the root's grade and the unit's grade has units in this lane
      for (let g = GRADES.indexOf(rg) + 1; g < gi; g++) expect(laneUnits(GRADES[g], laneOf(u))).toHaveLength(0);
    }
  });

  it("every unit above 小1 has at least one root", () => {
    for (const u of UNITS) if (u.appGrade !== "小1") expect(rootsOf(u).length, u.id).toBeGreaterThan(0);
  });

  it("picks the related units first", () => {
    expect(rootIds("5-C3")[0]).toBe("4-C2"); // 割合 ← 簡単な割合
    expect(rootIds("5-A4")[0]).toBe("4-A5"); // 分数 ← 分数とその加法・減法
    expect(rootIds("4-A8")[0]).toBe("3-A8"); // そろばん ← そろばん
    expect(rootIds("h-I-3")).toEqual(["j3-C1"]); // 二次関数 ← 関数 y = ax²
    expect(rootIds("j1-A3")).toEqual(["6-A2"]); // hand fix: 一元一次方程式 ← 文字を用いた式
  });

  it("rootPath walks every ancestor down to 小1", () => {
    const p = rootPath("5-C3");
    expect(p.units.has("5-C3")).toBe(true);
    expect(p.units.has("4-C2")).toBe(true);
    expect([...p.units].some((id) => id.startsWith("1-"))).toBe(true);
    expect(p.edges.has(edgeKey("5-C3", "4-C2"))).toBe(true);
    for (const id of p.units) expect(laneOf(unitById(id)!)).toBe("rel");
  });
});

describe("layout at phone width", () => {
  const near5 = nearGrades("小5");

  it("near sky = the child's grade and the grade below (+ one opened band)", () => {
    expect([...nearGrades("小5")].sort()).toEqual(["小4", "小5"]);
    expect([...nearGrades("小1")]).toEqual(["小1"]);
    expect([...nearGrades("中1", "小3")].sort()).toEqual(["中1", "小3", "小6"].sort());
  });

  for (const [label, near] of [["near 小5/小4", near5], ["everything near", new Set(GRADES)]] as const) {
    for (const width of [358, 390]) {
      it(`${label}, width ${width}: 110 stars, no overlaps, inside the chart, ≥ 44 px near tap targets`, () => {
        const L = layoutStarmap(width, near);
        expect(L.nodes).toHaveLength(110);
        for (const n of L.nodes) {
          expect(n.far).toBe(!near.has(n.grade));
          if (!n.far) {
            expect(n.h).toBeGreaterThanOrEqual(44);
            expect(n.w).toBeGreaterThanOrEqual(44);
          }
          expect(n.x).toBeGreaterThanOrEqual(0);
          expect(n.x + n.w).toBeLessThanOrEqual(width + 0.001);
          expect(n.y + n.h).toBeLessThanOrEqual(L.height);
        }
        for (let i = 0; i < L.nodes.length; i++)
          for (let j = i + 1; j < L.nodes.length; j++) {
            const a = L.nodes[i];
            const b = L.nodes[j];
            const overlap = a.x < b.x + b.w - 0.001 && b.x < a.x + a.w - 0.001 && a.y < b.y + b.h && b.y < a.y + a.h;
            expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
          }
      });
    }
  }

  it("far bands are one compact row (≥ 44 px tall: the band is the tap target)", () => {
    const L = layoutStarmap(358, near5);
    for (const b of L.bands) {
      expect(b.near).toBe(near5.has(b.grade));
      if (!b.near) {
        expect(b.h).toBe(SKY.farH);
        expect(b.h).toBeGreaterThanOrEqual(44);
        const cys = new Set(L.nodes.filter((n) => n.grade === b.grade).map((n) => n.cy));
        expect(cys.size).toBe(1);
      }
    }
    expect(L.height).toBeLessThan(layoutStarmap(358).height / 2);
  });

  it("grades rise upward: 小1 at the bottom, 高3 at the top; stars sit in their band and lane", () => {
    const L = layoutStarmap(358, near5);
    expect(L.bands.slice(0, 3).map((b) => b.grade)).toEqual(["高3", "高2", "高1"]);
    expect(L.bands.at(-1)!.grade).toBe("小1");
    for (const n of L.nodes) {
      const band = L.bands.find((b) => b.grade === n.grade)!;
      expect(n.cy).toBeGreaterThan(band.y);
      expect(n.cy).toBeLessThan(band.y + band.h);
      const li = LANES.indexOf(n.lane);
      expect(n.cx).toBeGreaterThanOrEqual(li * L.laneW);
      expect(n.cx).toBeLessThanOrEqual((li + 1) * L.laneW);
    }
  });

  it("every root line is one curve down to a lower star", () => {
    const L = layoutStarmap(358, near5);
    expect(L.edges.length).toBeGreaterThan(100);
    for (const e of L.edges) {
      expect(L.byId.get(e.to)!.cy).toBeGreaterThan(L.byId.get(e.from)!.cy);
      expect(e.d).toMatch(/^M[\d.]+ [\d.]+Q-?[\d.]+ [\d.]+ [\d.]+ [\d.]+$/);
    }
  });
});

describe("upper grades merged into one band (home)", () => {
  // First screen at 390×844 above the chart, with the report strip open and 3 次にやること rows:
  // topbar 56 + page top 14 + header 44 + strip ≤ 330 + lane header 30 + hint 24 ≈ 500 px.
  const CHROME = 500;
  const FIRST_SCREEN = 844 - 64; // minus the tab bar
  const merged = (own: Grade) => layoutStarmap(358, nearGrades(own), { grades: gradesAbove(own), merged: true });

  it("gradesAbove: next grade up to 高3; none for 高3", () => {
    expect(gradesAbove("小5")).toEqual(["小6", "中1", "中2", "中3", "高1", "高2", "高3"]);
    expect(gradesAbove("中3")).toEqual(["高1", "高2", "高3"]);
    expect(gradesAbove("高2")).toEqual(["高3"]);
    expect(gradesAbove("高3")).toEqual([]);
  });

  for (const own of GRADES) {
    it(`${own}: the child's band starts right under one merged row; first star row on the first screen`, () => {
      const L = merged(own);
      const band = L.bands.find((b) => b.grade === own)!;
      if (own === "高3") {
        expect(L.upper).toBeNull();
        expect(band.y).toBe(0);
      } else {
        expect(L.upper).toMatchObject({ merged: true, y: 0, h: SKY.farH, grades: gradesAbove(own) });
        expect(band.y).toBe(SKY.farH);
        for (const g of gradesAbove(own)) expect(L.bands.some((b) => b.grade === g)).toBe(false);
      }
      expect(CHROME + band.y + SKY.bandHead + SKY.nodeH).toBeLessThanOrEqual(FIRST_SCREEN);
      // Grades below stay individual bands.
      for (const g of GRADES.slice(0, GRADES.indexOf(own))) expect(L.bands.some((b) => b.grade === g)).toBe(true);
    });
  }

  for (const own of ["小2", "小5"] as const) {
    it(`${own}: all 110 stars placed, upper stars in one faint row, no overlaps, no lines inside the row`, () => {
      const L = merged(own);
      expect(L.nodes).toHaveLength(110);
      const up = L.nodes.filter((n) => gradesAbove(own).includes(n.grade));
      expect(up.every((n) => n.far && n.cy === SKY.farStarY)).toBe(true);
      for (let i = 0; i < L.nodes.length; i++)
        for (let j = i + 1; j < L.nodes.length; j++) {
          const a = L.nodes[i];
          const b = L.nodes[j];
          const overlap = a.x < b.x + b.w - 0.001 && b.x < a.x + a.w - 0.001 && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
        }
      for (const e of L.edges) expect(L.byId.get(e.to)!.cy).toBeGreaterThan(L.byId.get(e.from)!.cy);
      // Expanded: a head row, then the upper grades as individual far bands again.
      const X = layoutStarmap(358, nearGrades(own), { grades: gradesAbove(own), merged: false });
      expect(X.upper).toMatchObject({ merged: false, y: 0, h: SKY.upperHead });
      for (const g of gradesAbove(own)) expect(X.bands.find((b) => b.grade === g)).toMatchObject({ near: false, h: SKY.farH });
    });
  }

  it("an opened upper grade (lit / ?unit=) cannot stay merged", () => {
    const L = layoutStarmap(358, nearGrades("小5", "中1"), { grades: gradesAbove("小5"), merged: true });
    expect(L.upper?.merged).toBe(false);
    expect(L.bands.find((b) => b.grade === "中1")?.near).toBe(true);
  });
});

describe("sheet data", () => {
  const page: SavedPage = {
    id: "p1",
    createdAt: "2026-10-10T00:00:00Z",
    grade: "小5",
    pageType: "test",
    score: null,
    problems: [
      { n: 1, q: "a", unit: "5-C3", answer: null, mark: "✕", confidence: 0.9, reviewed: false },
      { n: 2, q: "b", unit: "5-C3", answer: null, mark: "○", confidence: 0.9, reviewed: false },
      { n: 3, q: "c", unit: "4-C2", answer: null, mark: "○", confidence: 0.9, reviewed: false },
    ],
  };

  it("unit, counts, state and roots with their states", () => {
    const tiles = mapTiles([page]);
    const d = sheetData("5-C3", tiles)!;
    expect(d.unit.topic).toBe("割合");
    expect(d.tile).toMatchObject({ count: 2, wrong: 1, status: "review" });
    expect(d.roots[0]).toMatchObject({ status: "gold" });
    expect(d.roots[0].unit.id).toBe("4-C2");
    expect(sheetData("1-A1", tiles)!.roots).toEqual([]);
    expect(sheetData("nope", tiles)).toBeNull();
  });

  it("grade summary counts", () => {
    const c = gradeCounts(mapTiles([page]), "小5");
    expect(c).toMatchObject({ review: 1, gold: 0, ok: 0 });
    expect(c.empty).toBe(14);
  });
});
