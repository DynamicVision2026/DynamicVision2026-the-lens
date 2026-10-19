import { describe, expect, it } from "vitest";
import { parseColor } from "../src/components/TerritoryMap";
import { GRADES, UNITS, unitsForGrade } from "../src/curriculum";
import { buildStrip } from "../src/lib/home";
import type { SavedPage, SavedProblem } from "../src/lib/model";
import { buildReport } from "../src/lib/report";
import { mapTiles } from "../src/lib/review";
import type { Mark } from "../src/reader/schema";
import { app } from "../src/copy";
import { decoBox } from "../src/lib/terrain";
import { schoolYearOf, yearlyRecord } from "../src/lib/yearly";
import {
  DISTRICTS,
  HEIGHT,
  HEX,
  HUD_TOP,
  OVERSCROLL,
  REGION_SPECS,
  type Box,
  buildHud,
  columnOutline,
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
  zoneProgress,
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

describe("hex layout: the video's tiles on one continent", () => {
  it("110 units, 278 hexes: each unit holds as many hexes as its 知識・技能 (points)", () => {
    expect(T.units).toHaveLength(110);
    expect(T.hexes).toHaveLength(UNITS.reduce((s, u) => s + u.points, 0));
    expect(T.hexes).toHaveLength(278);
    for (const u of T.units) expect(u.hexes.length, u.id).toBe(u.unit.points);
    expect(new Set(T.units.map((u) => u.id))).toEqual(new Set(UNITS.map((u) => u.id)));
  });

  it("no overlaps: every cell holds one tile at most, and the land never covers a tile", () => {
    const cells = new Set(T.hexes.map((t) => key(t.q, t.r)));
    expect(cells.size).toBe(T.hexes.length);
    const land = new Set(T.terrain.land.map((l) => key(l.q, l.r)));
    expect(land.size).toBe(T.terrain.land.length);
    for (const c of land) expect(cells.has(c), c).toBe(false);
    // every tile is ringed by land or other tiles (inland, not a reef)
    for (const t of T.hexes) for (const [dq, dr] of NEIGH) expect(cells.has(key(t.q + dq, t.r + dr)) || land.has(key(t.q + dq, t.r + dr))).toBe(true);
  });

  it("one continuous landmass: all land and tiles form a single piece", () => {
    expect(components([...T.terrain.land, ...T.hexes])).toBe(1);
  });

  it("12 zones in order, coast → summit, each with its name; 高校 zones hold two subject districts", () => {
    expect(T.regions.map((r) => r.grade)).toEqual([...GRADES]);
    expect(T.regions.map((r) => app.map.terr.zones[r.grade])).toEqual([
      "海岸線", "入り江", "平原", "森林帯", "深い森林帯", "湖沼帯", "丘陵帯", "岩稜帯", "高原帯", "雪線", "氷河帯", "山頂",
    ]);
    expect(T.regions.map((r) => r.zone)).toEqual(["coast", "cove", "plain", "forest", "deep", "lake", "hills", "ridge", "plateau", "snowline", "glacier", "summit"]);
    expect(T.regions.at(-1)!.metres).toBe(3776);
    expect(DISTRICTS.map((d) => d.key)).toEqual(["小1", "小2", "小3", "小4", "小5", "小6", "中1", "中2", "中3", "数学I", "数学A", "数学II", "数学B", "数学III", "数学C"]);
    for (const g of GRADES) expect(T.units.filter((u) => u.grade === g).map((u) => u.id).sort(), g).toEqual(unitsForGrade(g).map((u) => u.id).sort());
    expect(T.byGrade.get("小5")!.districts).toEqual(["小5"]);
    expect(T.byGrade.get("高1")!.districts.sort()).toEqual(["数学A", "数学I"]);
  });

  it("the climb: each zone sits further back and higher than the one before (標高 and ground height rise); coast front-left, summit back-right", () => {
    for (let i = 1; i < T.regions.length; i++) {
      const [a, b] = [T.regions[i - 1], T.regions[i]];
      expect(b.z, b.grade).toBeLessThan(a.z);
      expect(b.metres, b.grade).toBeGreaterThan(a.metres);
      expect(b.e, b.grade).toBeGreaterThanOrEqual(a.e);
      expect(b.label[1], b.grade).toBeLessThan(a.label[1]); // higher on screen
    }
    expect(T.regions.at(-1)!.e).toBeGreaterThan(T.regions[0].e + 3);
    const first = T.regions[0];
    const last = T.regions.at(-1)!;
    expect(first.x).toBeLessThan(last.x);
    // tiles stand on their zone's ground; columns stay modest so the land carries the height
    for (const t of T.hexes) expect(t.e, t.unitId).toBe(T.byGrade.get(T.byId.get(t.unitId)!.grade)!.e);
    expect(Math.max(...T.hexes.map((t) => t.h))).toBeLessThan(0.8);
    expect(buildTerritory().hexes.map((t) => t.h)).toEqual(T.hexes.map((t) => t.h));
  });

  it("every unit's tiles lie inside its own zone (nearest zone centre) and on its zone's ground", () => {
    for (const u of T.units)
      for (const t of u.hexes) {
        const near = T.regions.reduce((a, r) => (Math.hypot(r.x - t.x, r.z - t.z) < Math.hypot(a.x - t.x, a.z - t.z) ? r : a));
        expect(near.grade, u.id).toBe(u.grade);
      }
    // the land touching a zone's tiles belongs to that zone
    const tileGrade = new Map(T.hexes.map((t) => [key(t.q, t.r), T.byId.get(t.unitId)!.grade]));
    for (const l of T.terrain.land.filter((c) => c.dTile === 1))
      expect(NEIGH.some(([dq, dr]) => tileGrade.get(key(l.q + dq, l.r + dr)) === l.grade), `${l.q},${l.r}`).toBe(true);
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

  it("the trail links the 12 zones in order (coast → summit) over land, never through a tile", () => {
    const at = GRADES.map((g) => T.terrain.trailAt.get(g)!);
    for (let i = 1; i < at.length; i++) expect(at[i], GRADES[i]).toBeGreaterThan(at[i - 1]);
    for (const g of GRADES) expect(T.terrain.trail[T.terrain.trailAt.get(g)!]).toEqual(T.byGrade.get(g)!.waypoint);
    // consecutive trail points are neighbouring cells (one continuous walk)
    for (let i = 1; i < T.terrain.trail.length; i++) {
      const [a, b] = [T.terrain.trail[i - 1], T.terrain.trail[i]];
      expect(Math.abs(b[0] - a[0]), `step ${i}`).toBeLessThan(1.8);
    }
    const tileCentres = new Set(T.hexes.map((t) => `${t.x.toFixed(3)}`));
    expect(tileCentres.size).toBeGreaterThan(0);
    const landAt = new Map(T.terrain.land.map((l) => [`${l.x.toFixed(3)},${(l.z * 0.72 - l.e * 0.7).toFixed(3)}`, l]));
    for (const [x, y] of T.terrain.trail) {
      const l = landAt.get(`${x.toFixed(3)},${y.toFixed(3)}`);
      expect(l, `${x},${y}`).toBeDefined();
      expect(l!.water).toBe(false);
    }
  });

  it("terrain marks never overlap a tile, even at its tallest (gold) column", () => {
    const outlines = T.hexes.map((t) => {
      const o = columnOutline(t.x, t.z, t.h + HEIGHT.goldLift, HEX.tile, t.e);
      return { x0: Math.min(...o.map((p) => p[0])), x1: Math.max(...o.map((p) => p[0])), y0: Math.min(...o.map((p) => p[1])), y1: Math.max(...o.map((p) => p[1])) };
    });
    expect(T.terrain.decos.length).toBeGreaterThan(300);
    for (const d of T.terrain.decos) {
      const b = decoBox(d);
      for (const o of outlines) expect(b.x0 < o.x1 && o.x0 < b.x1 && b.y0 < o.y1 && o.y0 < b.y1, `${d.kind} at ${d.x},${d.z}`).toBe(false);
    }
    // every zone has its terrain: canopy in the forests, hachures on rock, crevasses on the glacier, a summit marker
    const kinds = new Set(T.terrain.decos.map((d) => d.kind));
    for (const k of ["stipple", "tuft", "canopy", "canopyDense", "hachure", "snow", "crevasse", "pass", "peak"]) expect(kinds.has(k as never), k).toBe(true);
    expect(T.terrain.land.some((l) => l.water && l.grade === "小6")).toBe(true);
  }, 60_000); // heavy geometric check: CI runners are several times slower than local

  it("zone specs: one per grade, 標高 rising to 3776", () => {
    expect(REGION_SPECS.map((s) => s.grade)).toEqual([...GRADES]);
    expect(REGION_SPECS.map((s) => s.metres)).toEqual([...REGION_SPECS.map((s) => s.metres)].sort((a, b) => a - b));
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
      const [X, Y] = project(a.x, a.z, a.e + a.h);
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
  it("on load the child's zone fills ~70% of the width, fully in view, leaning towards the next zone with the trail running into it", () => {
    for (const [i, g] of GRADES.entries()) {
      const c = homeCam(T, g, v);
      const b = T.byGrade.get(g)!.box;
      const [x0, y0] = toScreen(c, v, b.x0, b.y0);
      const [x1, y1] = toScreen(c, v, b.x1, b.y1);
      const share = (x1 - x0) / v.w;
      expect(share, g).toBeLessThanOrEqual(0.7 + 1e-6);
      expect(share, g).toBeGreaterThan(0.45);
      expect(x0, g).toBeGreaterThanOrEqual(-1);
      expect(x1, g).toBeLessThanOrEqual(v.w + 1);
      expect(y0, g).toBeGreaterThanOrEqual(v.h * 0.12 - 1);
      expect(y1, g).toBeLessThanOrEqual(v.h + 1);
      // the zone nearest the screen centre is the child's
      const [cx, cy] = toWorld(c, v, v.w / 2, (y0 + y1) / 2);
      const near = T.regions.reduce((a, r) => (Math.hypot(r.x - cx, r.label[1] + 3 - cy) < Math.hypot(a.x - cx, a.label[1] + 3 - cy) ? r : a));
      expect(near.grade, g).toBe(g);
      const next = GRADES[i + 1];
      if (!next) continue;
      const a = T.terrain.trailAt.get(g)!;
      const z = T.terrain.trailAt.get(next)!;
      const leg = T.terrain.trail.slice(a, z + 1);
      const seen = leg.filter(([x, y]) => {
        const [sx, sy] = toScreen(c, v, x, y);
        return sx >= 0 && sx <= v.w && sy >= 0 && sy <= v.h;
      });
      expect(seen.length / leg.length, `${g} → ${next}`).toBeGreaterThan(0.5);
      expect(T.regions.filter((r) => r.grade !== g && inView(r.box, c)).length, g).toBeGreaterThan(0);
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
    expect(oy0).toBeGreaterThanOrEqual(v.h * HUD_TOP - 1); // below the HUD band: the summit is not hidden
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

describe("zones: progress on the trail", () => {
  it("制覇 N/M per zone from the map's tiles; a zone is complete (planted flag) only when every unit is taken", () => {
    const pr = zoneProgress(mapTiles(PAGES));
    expect(pr.get("小5")).toEqual({ grade: "小5", taken: 6, total: 15, complete: false });
    expect(pr.get("小4")).toMatchObject({ taken: 2, complete: false });
    expect(pr.get("高3")).toMatchObject({ taken: 0, total: 6, complete: false });
    const all = unitsForGrade("小1").map((u) => [u.id, "○"] as [string, Mark]);
    const done = zoneProgress(mapTiles([page("2026-10-18T09:00:00Z", all)]));
    expect(done.get("小1")).toMatchObject({ taken: unitsForGrade("小1").length, complete: true });
    expect(done.get("小2")!.complete).toBe(false);
  });
});

describe("年度の記録 (school year = April–March, from the pages on this device)", () => {
  it("school year starts in April", () => {
    expect(schoolYearOf(new Date(2026, 3, 1))).toBe(2026);
    expect(schoolYearOf(new Date(2026, 2, 31))).toBe(2025);
    expect(schoolYearOf(new Date(2026, 9, 19))).toBe(2026);
  });
  it("one row per school year, newest first; the grade back then = profile grade minus the years back", () => {
    const old = [
      page("2025-06-10T03:00:00Z", [["4-A2", "✕"], ["4-A2", "✕"], ["4-B1", "○"]]),
      page("2026-02-10T03:00:00Z", [["4-C2", "○"], ["4-C2", "✕"]]),
    ];
    const rows = yearlyRecord([...PAGES, ...old], "小5", NOW);
    expect(rows.map((r) => [r.year, r.grade])).toEqual([[2026, "小5"], [2025, "小4"]]);
    // 2026年度: the 小5 zone from this year's pages only (same 6 / 15 as the map), every ✕ saved this year
    expect(rows[0]).toMatchObject({ pages: 5, taken: 6, total: 15, wrong: 9 });
    // 2025年度: 小4 units taken by that year's pages (4-A2, 4-B1, 4-C2), its ✕
    expect(rows[1]).toMatchObject({ pages: 2, taken: 3, total: unitsForGrade("小4").length, wrong: 3 });
  });
  it("the current year is always listed; years before 小1 are left out", () => {
    expect(yearlyRecord([], "中1", NOW)).toEqual([{ year: 2026, grade: "中1", pages: 0, taken: 0, total: unitsForGrade("中1").length, wrong: 0 }]);
    const young = yearlyRecord([page("2024-09-01T03:00:00Z", [["1-A1", "○"]])], "小2", NOW);
    expect(young.map((r) => r.grade)).toEqual(["小2"]);
  });
});
