import { describe, expect, it } from "vitest";
import { parseColor } from "../src/components/TerritoryMap";
import { GRADES, UNITS, unitsForGrade } from "../src/curriculum";
import { buildStrip } from "../src/lib/home";
import type { SavedPage, SavedProblem } from "../src/lib/model";
import { buildReport } from "../src/lib/report";
import { mapTiles } from "../src/lib/review";
import type { Mark } from "../src/reader/schema";
import {
  DISTRICTS,
  HEIGHT,
  OVERSCROLL,
  type Box,
  buildHud,
  buildTerritory,
  clampCam,
  colorKeyOf,
  frameBox,
  hitUnit,
  homeCam,
  lookOf,
  panBy,
  project,
  tileLabel,
  toScreen,
  toWorld,
  unitHistory,
  zoomAt,
  zoomLimits,
} from "../src/lib/territory";

const T = buildTerritory();
const key = (q: number, r: number) => `${q},${r}`;
const NEIGH = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

/** Connected components of a set of axial cells. */
function components(cells: { q: number; r: number }[]): number {
  const left = new Set(cells.map((c) => key(c.q, c.r)));
  let n = 0;
  while (left.size) {
    n++;
    const stack = [left.values().next().value as string];
    left.delete(stack[0]);
    while (stack.length) {
      const [q, r] = stack.pop()!.split(",").map(Number);
      for (const [dq, dr] of NEIGH) {
        const k = key(q + dq, r + dr);
        if (left.has(k)) {
          left.delete(k);
          stack.push(k);
        }
      }
    }
  }
  return n;
}

let seq = 0;
function page(createdAt: string, probs: [unit: string | null, mark: Mark, reviewed?: boolean][], pageType = "test"): SavedPage {
  const problems: SavedProblem[] = probs.map(([unit, mark, reviewed], i) => ({
    n: i + 1, q: `q${i}`, unit, answer: null, mark, confidence: 0.95, reviewed: !!reviewed,
  }));
  return { id: `t${seq++}`, createdAt, grade: "小5", pageType: pageType as SavedPage["pageType"], score: null, problems };
}
const NOW = new Date("2026-10-19T05:00:00Z");
// The screenshot seed's shape: gold, green, red in 小5; red in 小4 and 小3; gold in 小6.
const PAGES = [
  page("2026-10-01T09:00:00Z", [["5-A1", "○"], ["5-A1", "○"], ["5-A3", "✕", true], ["5-A3", "○"]]),
  page("2026-10-03T09:00:00Z", [["5-B1", "✕"], ["5-B1", "✕"], ["5-D1", null], ["5-C1", "✕"], ["5-C1", "○"]], "drill"),
  page("2026-10-10T09:00:00Z", [["5-B1", "○"], ["5-B1", "○"], ["4-A2", "✕"]]),
  page("2026-10-12T09:00:00Z", [["4-C2", "✕", true], ["3-A4", "✕"], ["6-C2", "○"]], "drill"),
  page("2026-10-18T09:00:00Z", [["5-C3", "○"], ["5-C3", "✕"], ["5-C3", "✕"]]),
];

describe("hex layout = the video's map", () => {
  it("110 units, 278 hexes: each unit holds as many hexes as its 知識・技能 (points)", () => {
    expect(T.units).toHaveLength(110);
    expect(T.hexes).toHaveLength(UNITS.reduce((s, u) => s + u.points, 0));
    expect(T.hexes).toHaveLength(278);
    for (const u of T.units) expect(u.hexes.length, u.id).toBe(u.unit.points);
    expect(new Set(T.units.map((u) => u.id))).toEqual(new Set(UNITS.map((u) => u.id)));
  });

  it("no overlaps: every cell holds one tile at most, and the coast never covers a tile", () => {
    const cells = new Set(T.hexes.map((t) => key(t.q, t.r)));
    expect(cells.size).toBe(T.hexes.length);
    const land = new Set(T.land.map((l) => key(l.q, l.r)));
    expect(land.size).toBe(T.land.length);
    for (const c of land) expect(cells.has(c), c).toBe(false);
    // every tile is ringed by land or other tiles (an island, not a reef)
    for (const t of T.hexes) for (const [dq, dr] of NEIGH) expect(cells.has(key(t.q + dq, t.r + dr)) || land.has(key(t.q + dq, t.r + dr))).toBe(true);
  });

  it("the video's district centres, one district per grade (高校: one per subject)", () => {
    expect(DISTRICTS.map((d) => d.key)).toEqual(["小1", "小2", "小3", "小4", "小5", "小6", "中1", "中2", "中3", "数学I", "数学II", "数学III", "数学A", "数学B", "数学C"]);
    expect(DISTRICTS.find((d) => d.key === "小5")!.centre).toEqual([-12, 10]);
    expect(DISTRICTS.find((d) => d.key === "数学III")!.centre).toEqual([42, -25]);
  });

  it("each grade island contains exactly its units (12 islands, 高1 = I + A, 高2 = II + B, 高3 = III + C)", () => {
    expect(T.islands.map((i) => i.grade)).toEqual([...GRADES]);
    for (const g of GRADES) expect(T.units.filter((u) => u.grade === g).map((u) => u.id).sort(), g).toEqual(unitsForGrade(g).map((u) => u.id).sort());
    expect(T.byGrade.get("小5")!.districts).toEqual(["小5"]);
    expect(T.byGrade.get("高1")!.districts.sort()).toEqual(["数学A", "数学I"]);
  });

  it("strand grouping: each unit is one patch, and inside a district each strand is one coloured patch", () => {
    for (const u of T.units) expect(components(u.hexes), u.id).toBe(1);
    let strandPatches = 0;
    let strands = 0;
    for (const d of DISTRICTS.filter((x) => !x.key.startsWith("数学"))) {
      const us = T.units.filter((u) => u.district === d.key);
      for (const c of new Set(us.map((u) => u.color))) {
        strands++;
        strandPatches += components(us.filter((u) => u.color === c).flatMap((u) => u.hexes));
      }
    }
    expect(strandPatches).toBe(strands);
  });

  it("colours: 小・中 by strand (the video legend), 高校 by subject", () => {
    const by = (id: string) => colorKeyOf(UNITS.find((u) => u.id === id)!);
    expect([by("5-A1"), by("5-B1"), by("5-C3"), by("5-D2"), by("j2-C1")]).toEqual(["num", "geo", "rel", "data", "rel"]);
    expect([by("h-I-3"), by("h-II-4"), by("h-III-2"), by("h-A-2"), by("h-B-1"), by("h-C-1")]).toEqual(["hI", "hII", "hIII", "hA", "hB", "hC"]);
  });

  it("heights follow the video: 小 low, 中 higher, 高校 columns tallest; same every build", () => {
    const hOf = (lvl: string) => T.hexes.filter((t) => T.byId.get(t.unitId)!.unit.level === lvl).map((t) => t.h);
    expect(Math.max(...hOf("小"))).toBeLessThan(1.0);
    expect(Math.min(...hOf("中"))).toBeGreaterThanOrEqual(1.0);
    expect(Math.max(...hOf("高"))).toBeGreaterThan(4);
    expect(buildTerritory().hexes.map((t) => t.h)).toEqual(T.hexes.map((t) => t.h));
  });

  it("islands sit like the video: 小 cluster, then 中, then 高校 furthest away (left → right)", () => {
    const x = (g: (typeof GRADES)[number]) => T.byGrade.get(g)!.x;
    expect(Math.max(x("小1"), x("小2"), x("小3"), x("小4"), x("小5"), x("小6"))).toBeLessThan(Math.min(x("中1"), x("中2"), x("中3")));
    expect(Math.max(x("中1"), x("中2"), x("中3"))).toBeLessThan(Math.min(x("高1"), x("高2"), x("高3")));
    expect(T.route).toHaveLength(15);
  });
});

describe("territory states → visuals (the four review.ts states, no new rules)", () => {
  const h = 0.6;
  it("まだ: flat, unexplored colour; 復習ずみ: raised strand column", () => {
    expect(lookOf("empty")).toMatchObject({ fill: "unex", flag: false, crown: false, pulse: false });
    expect(lookOf("empty").height(h)).toBe(HEIGHT.empty);
    expect(lookOf("ok")).toMatchObject({ fill: "strand", flag: false, crown: false, pulse: false });
    expect(lookOf("ok").height(h)).toBe(h);
  });
  it("復習が必要: raised strand column with a red flag and a pulse; マスター: higher gold column with a crown", () => {
    expect(lookOf("review")).toMatchObject({ fill: "strand", flag: true, pulse: true, crown: false });
    expect(lookOf("review").height(h)).toBe(h);
    expect(lookOf("gold")).toMatchObject({ fill: "gold", crown: true, flag: false });
    expect(lookOf("gold").height(h)).toBeGreaterThan(lookOf("ok").height(h));
    expect(lookOf("ok").height(h)).toBeGreaterThan(lookOf("empty").height(h));
  });
  it("tile accessible name: 「小5 平均：復習が必要（✕2）」", () => {
    const tiles = mapTiles([page("2026-10-19T04:00:00Z", [["5-D2", "✕"], ["5-D2", "✕"], ["5-A1", "○"]])]);
    expect(tileLabel(tiles.find((t) => t.unit.id === "5-D2")!)).toBe("小5 平均：復習が必要（✕2）");
    expect(tileLabel(tiles.find((t) => t.unit.id === "5-A1")!)).toBe("小5 整数の性質：マスター");
    expect(tileLabel(tiles.find((t) => t.unit.id === "5-C3")!)).toBe("小5 割合：まだ");
  });
  it("tap → unit: the top of a unit's anchor column hits that unit; the open sea hits nothing", () => {
    const heightOf = (t: (typeof T.hexes)[number]) => t.h;
    for (const id of ["5-C3", "4-A2", "j2-A1", "h-III-2"]) {
      const a = T.byId.get(id)!.anchor;
      const [X, Y] = project(a.x, a.z, a.h);
      expect(hitUnit(T, X, Y, heightOf), id).toBe(id);
    }
    expect(hitUnit(T, T.box.x0, T.box.y0, heightOf)).toBeNull();
  });
  it("token colours are read in every form the build produces", () => {
    expect(parseColor("#83bdc8")).toEqual([131, 189, 200, 1]);
    expect(parseColor("#fff")).toEqual([255, 255, 255, 1]);
    expect(parseColor("#ffffff47")[3]).toBeCloseTo(0.28, 2);
    expect(parseColor(" rgba(230, 57, 70, 0.55)")).toEqual([230, 57, 70, 0.55]);
  });
});

describe("HUD = the 学習レポート's numbers", () => {
  it("制覇した単元 = units with data in the child's grade; counts, 要復習 and the total equal the report", () => {
    const r = buildReport(PAGES, "小5", NOW);
    const hud = buildHud(PAGES, "小5", NOW);
    expect(hud.counts).toEqual(r.counts);
    expect(hud.total).toBe(r.total);
    expect(hud.taken).toBe(r.counts.gold + r.counts.ok + r.counts.review);
    expect([hud.taken, hud.total, hud.counts.review]).toEqual([6, 15, 2]);
  });
  it("小・中・高 bars count the whole map; flags = every red unit", () => {
    const hud = buildHud(PAGES, "小5", NOW);
    expect(hud.levels).toEqual({ 小: { taken: 10, total: 66 }, 中: { taken: 0, total: 23 }, 高: { taken: 0, total: 21 } });
    expect(hud.flagged).toBe(4); // 5-C3, 5-C1, 4-A2, 3-A4
  });
  it("次にやること badge order = the report's 次にやること, topped up from earlier grades (max 3)", () => {
    const hud = buildHud(PAGES, "小5", NOW);
    expect(hud.next).toEqual(["5-C3", "5-C1", "4-A2"]);
    expect(hud.next).toEqual(buildStrip(PAGES, "小5", NOW).next.map((n) => n.unit.id));
    const live = page("2026-10-19T04:00:00Z", [["4-A4", "○"], ["5-D2", "✕"], ["4-A6", "✕"], ["4-A6", "○"]], "drill");
    expect(buildHud([live], "小5", NOW).next).toEqual(["5-D2", "4-A6"]);
    expect(buildHud([], "小5", NOW)).toMatchObject({ taken: 0, total: 15, flagged: 0, next: [] });
  });
});

describe("detail sheet: the unit's history", () => {
  it("every page with the unit, newest first: date, page type, ✕ / ○ / 印なし", () => {
    const rows = unitHistory(PAGES, "5-B1");
    expect(rows.map((r) => [r.type, r.wrong, r.ok, r.none])).toEqual([["テスト", 0, 2, 0], ["ドリル", 2, 0, 0]]);
    const d = new Date("2026-10-10T09:00:00Z");
    expect(rows[0].date).toBe(`${d.getMonth() + 1}/${d.getDate()}`);
    expect(unitHistory(PAGES, "5-D1")[0]).toMatchObject({ wrong: 0, ok: 0, none: 1 });
    expect(unitHistory(PAGES, "5-A2")).toEqual([]);
  });
});

describe("camera", () => {
  const v = { w: 390, h: 722 };
  const inView = (b: Box, c: ReturnType<typeof homeCam>) => {
    const [x0, y0] = toScreen(c, v, b.x0, b.y0);
    const [x1, y1] = toScreen(c, v, b.x1, b.y1);
    return x1 > 0 && x0 < v.w && y1 > 0 && y0 < v.h;
  };
  it("on load the child's island fills ~70% of the width, centred, with neighbouring islands at the edges", () => {
    for (const g of GRADES) {
      const c = homeCam(T, g, v);
      const b = T.byGrade.get(g)!.box;
      const [x0, y0] = toScreen(c, v, b.x0, b.y0);
      const [x1, y1] = toScreen(c, v, b.x1, b.y1);
      const share = (x1 - x0) / v.w;
      expect(share, g).toBeLessThanOrEqual(0.7 + 1e-6);
      // height-limited islands are narrower, never wider; most are exactly 70 %
      expect(share, g).toBeGreaterThan(0.45);
      expect(y0, g).toBeGreaterThanOrEqual(v.h * 0.12 - 1);
      expect(y1, g).toBeLessThanOrEqual(v.h * 0.92 + 1);
      expect(Math.abs((x0 + x1) / 2 - v.w / 2), g).toBeLessThan(1);
      const neighbours = T.islands.filter((i) => i.grade !== g && inView(i.box, c));
      expect(neighbours.length, g).toBeGreaterThan(0);
    }
    expect(homeCam(T, "小5", v).k * (T.byGrade.get("小5")!.box.x1 - T.byGrade.get("小5")!.box.x0)).toBeCloseTo(0.7 * v.w, 3);
  });

  it("zoom stays within limits (whole map … a few hexes); the screen centre never leaves the map", () => {
    const { min, max } = zoomLimits(T, v);
    expect(max).toBeGreaterThan(min);
    expect(clampCam({ x: 0, y: 0, k: 1e-3 }, T, v).k).toBe(min);
    expect(clampCam({ x: 0, y: 0, k: 1e6 }, T, v).k).toBe(max);
    // dragged far away: the map edge may come in, but at most part of the screen is open sea
    const far = clampCam({ x: 1e5, y: -1e5, k: 40 }, T, v);
    const [ex, ey] = toScreen(far, v, T.box.x1, T.box.y0);
    expect(ex).toBeCloseTo(v.w / 2 + (v.w / 2) * (1 - OVERSCROLL), 6);
    expect(ey).toBeCloseTo(v.h / 2 - (v.h / 2) * (1 - OVERSCROLL), 6);
    let c = homeCam(T, "小5", v);
    for (let i = 0; i < 50; i++) c = panBy(c, v, -400, 300, T);
    expect(c.x).toBeLessThanOrEqual(T.box.x1);
    expect(c.y).toBeGreaterThanOrEqual(T.box.y0);
    // fully zoomed out, the whole map is centred on screen wherever it was dragged
    const out = clampCam({ x: T.box.x0, y: T.box.y1, k: min }, T, v);
    const [ox0, oy0] = toScreen(out, v, T.box.x0, T.box.y0);
    const [ox1, oy1] = toScreen(out, v, T.box.x1, T.box.y1);
    expect(ox0).toBeGreaterThanOrEqual(0);
    expect(ox1).toBeLessThanOrEqual(v.w);
    expect(oy0).toBeGreaterThanOrEqual(0);
    expect(oy1).toBeLessThanOrEqual(v.h);
  });

  it("pinch / double-tap zoom keeps the point under the fingers in place", () => {
    const c = homeCam(T, "小5", v);
    const before = toWorld(c, v, 120, 300);
    const z = zoomAt(c, v, 1.6, 120, 300, T);
    expect(z.k).toBeCloseTo(c.k * 1.6, 6);
    const after = toWorld(z, v, 120, 300);
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
  });

  it("frameBox centres a box inside a region (the band above the sheet) and respects maxK", () => {
    const b = T.byId.get("5-C3")!;
    const box: Box = { x0: b.anchor.x - 2, y0: b.anchor.z * 0.72 - 2, x1: b.anchor.x + 2, y1: b.anchor.z * 0.72 + 1 };
    const region: Box = { x0: 16, y0: 110, x1: 374, y1: 330 };
    const c = frameBox(box, v, T, { fill: 0.8, region, maxK: 30 });
    const [x0, y0] = toScreen(c, v, box.x0, box.y0);
    const [x1, y1] = toScreen(c, v, box.x1, box.y1);
    expect((x0 + x1) / 2).toBeCloseTo(195, 3);
    expect((y0 + y1) / 2).toBeCloseTo(220, 3);
    expect(c.k).toBeLessThanOrEqual(30);
  });
});
