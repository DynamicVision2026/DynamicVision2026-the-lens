import { GRADES, type Grade, UNITS, type Unit, unitById } from "../curriculum";
import { app } from "../copy";
import type { SavedPage } from "./model";
import { buildReport } from "./report";
import { type Level as Step, type LevelCounts, countsLine, levelName, zeroCounts } from "./ladder";
import { type Tile, mapTiles } from "./review";
import { STRIP_NEXT, stripFromReport } from "./home";
import { type Terrain, type Zone, buildTerrain } from "./terrain";

export type { Zone } from "./terrain";

/**
 * 領土マップ = 「算数・数学の大陸」: an expedition from the coast (小1) to the summit (高3).
 *
 * Tiles keep the video's geometry (mathvid/map.html): pointy-top axial hexes, one district per grade
 * (高校: one per subject, two subjects per school year), each district a spiral of `points` hexes (the
 * unit's 知識・技能 count) sorted into angle wedges, units filling the wedges in curriculum order (so the
 * strands sit as coloured patches). A unit's territory = its patch of hexes (110 units, 278 hexes).
 * The districts now sit on one continent: each grade is a zone with its own terrain, climbing away
 * from the viewer zone by zone (terrain: ./terrain.ts).
 *
 * Projection: a flat oblique view (no perspective): ground depth squashed by GY, heights lifted by HY.
 * Pure functions only (no DOM): layout, camera framing / clamping, hit testing, HUD numbers.
 */

const SQ3 = Math.sqrt(3);
/** Ground position of an axial cell (video `hx`). */
export const hx = (q: number, r: number): [number, number] => [SQ3 * (q + r / 2), 1.5 * r];
const DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

/** Video `spiral(n)`: the centre, then ring by ring. */
export function spiral(n: number): [number, number][] {
  const out: [number, number][] = [[0, 0]];
  let k = 1;
  while (out.length < n) {
    let q = DIRS[4][0] * k;
    let r = DIRS[4][1] * k;
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < k; j++) {
        out.push([q, r]);
        q += DIRS[i][0];
        r += DIRS[i][1];
      }
    k++;
  }
  return out.slice(0, n);
}

/**
 * Cells of a district → one patch per unit. The video fills its angle-sorted cells in order, which
 * leaves a few thin wedges in two pieces; here each unit grows from the first free cell in that
 * order, always taking the free neighbour that comes first in it. Same district shape, same wedge
 * look, but every unit is one connected territory (one thing to tap).
 */
export function growPatches(sorted: [number, number][], sizes: number[]): [number, number][][] {
  const rank = new Map(sorted.map(([q, r], i) => [`${q},${r}`, i]));
  const free = new Set(rank.keys());
  return sizes.map((size) => {
    const out: [number, number][] = [];
    const take = (k: string) => {
      free.delete(k);
      const [q, r] = k.split(",").map(Number);
      out.push([q, r]);
    };
    /** Would the free cells stay in one piece without k? (≤ 33 cells: a flood fill is cheap.) */
    const keepsWhole = (k: string) => {
      const rest = [...free].filter((x) => x !== k);
      if (rest.length === 0) return true;
      const seen = new Set([rest[0]]);
      const stack = [rest[0]];
      while (stack.length) {
        const [q, r] = stack.pop()!.split(",").map(Number);
        for (const [dq, dr] of DIRS) {
          const n = `${q + dq},${r + dr}`;
          if (n !== k && free.has(n) && !seen.has(n)) {
            seen.add(n);
            stack.push(n);
          }
        }
      }
      return seen.size === rest.length;
    };
    const order = sorted.map(([q, r]) => `${q},${r}`);
    if (free.size === 0) return out;
    take(order.find((k) => free.has(k) && keepsWhole(k)) ?? order.find((k) => free.has(k))!);
    while (out.length < size && free.size > 0) {
      const cands = new Set<string>();
      for (const [q, r] of out)
        for (const [dq, dr] of DIRS) {
          const k = `${q + dq},${r + dr}`;
          if (free.has(k)) cands.add(k);
        }
      const byRank = [...cands].sort((a, b) => rank.get(a)! - rank.get(b)!);
      take(byRank.find(keepsWhole) ?? byRank[0] ?? order.find((k) => free.has(k))!);
    }
    return out;
  });
}

/**
 * 算数・数学の大陸: one landmass from the coast (小1, front left) to the summit (高3, back right).
 * Each grade is one zone; zones climb away from the viewer (smaller z = further back = higher),
 * zig-zagging left / right like switchbacks. 高校 zones hold two subject districts side by side.
 * Ground positions (x, z) are the hex plane; `metres` is the label's 標高 and sets the ground height.
 */
export interface RegionSpec {
  grade: Grade;
  zone: Zone;
  /** 標高 on the label (m). */
  metres: number;
  /** Ground centre of the zone. */
  centre: [number, number];
  /** Districts (小・中: the grade; 高校: its two subjects) as offsets from the centre. */
  districts: { key: string; dx: number; dz: number }[];
}
const one = (g: string) => [{ key: g, dx: 0, dz: 0 }];
export const REGION_SPECS: RegionSpec[] = [
  { grade: "小1", zone: "coast", metres: 10, centre: [-9, 58], districts: one("小1") },
  { grade: "小2", zone: "cove", metres: 40, centre: [9, 49], districts: one("小2") },
  { grade: "小3", zone: "plain", metres: 120, centre: [-6, 38], districts: one("小3") },
  { grade: "小4", zone: "forest", metres: 300, centre: [14, 27], districts: one("小4") },
  { grade: "小5", zone: "deep", metres: 500, centre: [-2, 16], districts: one("小5") },
  { grade: "小6", zone: "lake", metres: 700, centre: [18, 6], districts: one("小6") },
  { grade: "中1", zone: "hills", metres: 1000, centre: [3, -4], districts: one("中1") },
  { grade: "中2", zone: "ridge", metres: 1500, centre: [21, -13], districts: one("中2") },
  { grade: "中3", zone: "plateau", metres: 2000, centre: [6, -22], districts: one("中3") },
  { grade: "高1", zone: "snowline", metres: 2500, centre: [24, -33], districts: [{ key: "数学I", dx: -4.5, dz: 1.5 }, { key: "数学A", dx: 5, dz: -1.5 }] },
  { grade: "高2", zone: "glacier", metres: 3100, centre: [9, -45], districts: [{ key: "数学II", dx: -5, dz: 1.5 }, { key: "数学B", dx: 5, dz: -1.5 }] },
  { grade: "高3", zone: "summit", metres: 3776, centre: [28, -56], districts: [{ key: "数学III", dx: -4.5, dz: 1.5 }, { key: "数学C", dx: 4.5, dz: -1.5 }] },
];

/** Ground position → nearest axial cell. */
export function toAxial(x: number, z: number): [number, number] {
  const r = Math.round(z / 1.5);
  return [Math.round(x / SQ3 - r / 2), r];
}

/** District centres (axial), in climbing order. 高校 districts are subjects. */
export const DISTRICTS: { key: string; grade: Grade; centre: [number, number] }[] = REGION_SPECS.flatMap((s) =>
  s.districts.map((d) => ({ key: d.key, grade: s.grade, centre: toAxial(s.centre[0] + d.dx, s.centre[1] + d.dz) })),
);

/** Ground height of a zone (world units) from its 標高: the climb is visible but tiles stay the tallest thing. */
export const ELEV = { base: 0.12, perMetre: 1 / 1000, step: 0.25 };
export const quantE = (e: number) => Math.round(e / ELEV.step) * ELEV.step;
export const zoneHeight = (metres: number) => quantE(ELEV.base + metres * ELEV.perMetre);

/** Colour family of a unit: the strand (小・中: 領域 letter, as the video legend) or the 高校 subject. */
export type ColorKey = "num" | "geo" | "rel" | "data" | "hI" | "hII" | "hIII" | "hA" | "hB" | "hC";
export const STRANDS = ["num", "geo", "rel", "data"] as const;
const DOMAIN_COLOR: Record<string, ColorKey> = { A: "num", B: "geo", C: "rel", D: "data" };
export function colorKeyOf(u: Unit): ColorKey {
  if (u.level === "高") return `h${u.grade.replace("数学", "")}` as ColorKey;
  return DOMAIN_COLOR[u.unit.charAt(0)];
}

/** Ground tone of a zone (token suffix `--terr-g-…`): untaken tiles take it too (unexplored terrain). */
export type Ground = "sand" | "grass" | "forest" | "deep" | "moss" | "rock" | "alpine" | "scree" | "ice" | "snow";
export const GROUND: Record<Zone, Ground> = {
  coast: "sand", cove: "sand", plain: "grass", forest: "forest", deep: "deep", lake: "forest",
  hills: "moss", ridge: "rock", plateau: "alpine", snowline: "scree", glacier: "ice", summit: "snow",
};

/** Flat oblique projection: ground depth × GY, height × HY (screen y grows downward). */
export const PROJ = { gy: 0.72, hy: 0.7 };
/** Hex radii (video: tile body 0.96, cap 0.80, land 1.0). */
export const HEX = { tile: 0.96, cap: 0.8, land: 1.0 };
/**
 * Column heights above the ground, rising with the ladder: まだ nearly flat; 挑戦中 low (halfway between
 * flat and its seeded height); 復習ずみ its seeded height; マスター + masterLift; 定着 + goldLift (the
 * tallest: goldLift is also the clearance the terrain keeps around every tile).
 */
export const HEIGHT = { empty: 0.16, tryingShare: 0.5, masterLift: 0.27, goldLift: 0.45 };

export interface TerrHex {
  q: number;
  r: number;
  /** Ground position. */
  x: number;
  z: number;
  /** Ground height under the tile (its zone's plateau). */
  e: number;
  /** The tile's discovered column height above the ground. */
  h: number;
  unitId: string;
}
export interface UnitTerritory {
  id: string;
  unit: Unit;
  grade: Grade;
  district: string;
  color: ColorKey;
  hexes: TerrHex[];
  /** The hex nearest the patch's centroid: the unit's button, flag and pin sit on it. */
  anchor: TerrHex;
}
export interface Region {
  grade: Grade;
  zone: Zone;
  metres: number;
  districts: string[];
  /** Ground centre of its unit hexes. */
  x: number;
  z: number;
  /** Ground height of its plateau. */
  e: number;
  /** Projected bounds of the zone (tiles at their tallest + a margin of land). */
  box: Box;
  /** Projected point of the zone label (name + grade + 標高), on the land just above its tiles. */
  label: [number, number];
  /** Projected point where the trail passes the zone: progress badge, flag, 「あなたはここ」. */
  waypoint: [number, number];
}
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface Territory {
  hexes: TerrHex[];
  units: UnitTerritory[];
  byId: Map<string, UnitTerritory>;
  regions: Region[];
  byGrade: Map<Grade, Region>;
  terrain: Terrain;
  /** Projected bounds of everything. */
  box: Box;
}

/** Projected point of a ground position at height h. */
export function project(x: number, z: number, h = 0): [number, number] {
  return [x, z * PROJ.gy - h * PROJ.hy];
}

export function boxOf(pts: [number, number][], pad = 0): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

export function unionBox(boxes: Box[]): Box {
  return {
    x0: Math.min(...boxes.map((b) => b.x0)),
    y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    y1: Math.max(...boxes.map((b) => b.y1)),
  };
}

export function buildTerritory(): Territory {
  // Video `rnd`, same seed.
  let sd = 12345;
  const rnd = () => {
    sd = (sd * 1103515245 + 12345) % 2147483648;
    return sd / 2147483648;
  };
  const specOf = new Map(REGION_SPECS.map((s) => [s.grade, s]));
  const hexes: TerrHex[] = [];
  const units: UnitTerritory[] = [];
  for (const dist of DISTRICTS) {
    const key = dist.key;
    const us = UNITS.filter((u) => u.grade === key);
    const n = us.reduce((s, u) => s + u.points, 0);
    const cells = spiral(n);
    const ang = ([q, r]: [number, number]) => {
      const [x, z] = hx(q, r);
      return (Math.atan2(z, x) + Math.PI * 2.5) % (Math.PI * 2);
    };
    const dist2 = ([q, r]: [number, number]) => {
      const [x, z] = hx(q, r);
      return x * x + z * z;
    };
    cells.sort((a, b) => ang(a) - ang(b) || dist2(a) - dist2(b));
    const plan = growPatches(cells, us.map((u) => u.points));
    const c = dist.centre;
    const e = zoneHeight(specOf.get(dist.grade)!.metres);
    for (const [ui, u] of us.entries()) {
      const own: TerrHex[] = [];
      for (let i = 0; i < u.points; i++) {
        const [q, r] = plan[ui][i];
        const Q = q + c[0];
        const Rr = r + c[1];
        const [x, z] = hx(Q, Rr);
        // the zone gives the height now; columns differ a little, like the video's seeded heights
        const h = 0.5 + 0.28 * rnd();
        const t: TerrHex = { q: Q, r: Rr, x, z, e, h, unitId: u.id };
        hexes.push(t);
        own.push(t);
      }
      const mx = own.reduce((s, t) => s + t.x, 0) / own.length;
      const mz = own.reduce((s, t) => s + t.z, 0) / own.length;
      const anchor = own.reduce((best, t) => ((t.x - mx) ** 2 + (t.z - mz) ** 2 < (best.x - mx) ** 2 + (best.z - mz) ** 2 ? t : best));
      units.push({ id: u.id, unit: u, grade: u.appGrade, district: key, color: colorKeyOf(u), hexes: own, anchor });
    }
  }
  const byUnit = new Map(units.map((u) => [u.id, u]));
  const terrain = buildTerrain(
    hexes.map((t) => ({ q: t.q, r: t.r, e: t.e, top: t.e + t.h + HEIGHT.goldLift, grade: byUnit.get(t.unitId)!.grade })),
    REGION_SPECS.map((s) => {
      const hs = hexes.filter((t) => byUnit.get(t.unitId)!.grade === s.grade);
      return {
        grade: s.grade,
        zone: s.zone,
        e: zoneHeight(s.metres),
        x: hs.reduce((a, t) => a + t.x, 0) / hs.length,
        z: hs.reduce((a, t) => a + t.z, 0) / hs.length,
      };
    }),
  );
  const regions: Region[] = REGION_SPECS.map((s) => {
    const us = units.filter((u) => u.grade === s.grade);
    const hs = us.flatMap((u) => u.hexes);
    const x = hs.reduce((a, t) => a + t.x, 0) / hs.length;
    const z = hs.reduce((a, t) => a + t.z, 0) / hs.length;
    const pts: [number, number][] = [];
    for (const t of hs) {
      pts.push(project(t.x - 1, t.z - 1, t.e + t.h + HEIGHT.goldLift));
      pts.push(project(t.x + 1, t.z + 1, t.e));
    }
    const top = Math.min(...hs.map((t) => project(t.x, t.z - 1, t.e + t.h + HEIGHT.goldLift)[1]));
    const label: [number, number] = [x, top - 0.4];
    const waypoint = terrain.waypoints.get(s.grade)!;
    return {
      grade: s.grade,
      zone: s.zone,
      metres: s.metres,
      districts: [...new Set(us.map((u) => u.district))],
      x,
      z,
      e: zoneHeight(s.metres),
      // tiles, plus the label above and the trail badge below
      box: unionBox([boxOf(pts, 2.2), boxOf([label], 1.6), boxOf([waypoint], 1.8)]),
      label,
      waypoint,
    };
  });
  const all: [number, number][] = [
    ...hexes.map((t) => project(t.x, t.z, t.e + t.h + HEIGHT.goldLift)),
    ...terrain.land.map((l) => project(l.x, l.z, l.e)),
    ...terrain.land.map((l) => project(l.x, l.z + 1, 0)),
  ];
  return {
    hexes,
    units,
    byId: byUnit,
    regions,
    byGrade: new Map(regions.map((r) => [r.grade, r])),
    terrain,
    box: boxOf(all, 2),
  };
}

let cached: Territory | null = null;
export function territory(): Territory {
  return (cached ??= buildTerritory());
}

// ---------- states → visuals ----------

export interface TileLook {
  /** Column height of a hex of the unit, from its video height. */
  height: (h: number) => number;
  /** Colour family to fill with: the strand / subject colour, unexplored or gold. */
  fill: "unex" | "strand" | "gold";
  /** 挑戦中: red flag (+ a soft pulse). */
  flag: boolean;
  pulse: boolean;
  /** マスター: a star over the column. */
  star: boolean;
  /** 定着: a crown, a solid light cap and a subtle glow. */
  crown: boolean;
  glow: boolean;
}

/** The ladder's five steps (lib/ladder.ts) as territory: the column rises with the step; no rules of its own. */
export function lookOf(level: Step): TileLook {
  const base = { flag: false, pulse: false, star: false, crown: false, glow: false };
  switch (level) {
    case 0:
      return { ...base, height: () => HEIGHT.empty, fill: "unex" };
    case 1:
      return { ...base, height: (h) => HEIGHT.empty + (h - HEIGHT.empty) * HEIGHT.tryingShare, fill: "strand", flag: true, pulse: true };
    case 2:
      return { ...base, height: (h) => h, fill: "strand" };
    case 3:
      return { ...base, height: (h) => h + HEIGHT.masterLift, fill: "gold", star: true };
    case 4:
      return { ...base, height: (h) => h + HEIGHT.goldLift, fill: "gold", crown: true, glow: true };
  }
}

/** Corners of a pointy-top hex (radius s) around a projected centre, top face (squashed by GY). */
export function hexCorners(cx: number, cy: number, s: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = ((-90 + 60 * i) * Math.PI) / 180;
    out.push([cx + Math.cos(a) * s, cy + Math.sin(a) * s * PROJ.gy]);
  }
  return out;
}

/** Projected silhouette of a hex column standing on ground height e (top face + the two front side faces), for hit testing. */
export function columnOutline(x: number, z: number, h: number, s = HEX.tile, e = 0): [number, number][] {
  const [cx, cyTop] = project(x, z, e + h);
  const [, cyBase] = project(x, z, e);
  const top = hexCorners(cx, cyTop, s); // 0 top, 1 upper right, 2 lower right, 3 bottom, 4 lower left, 5 upper left
  const base = hexCorners(cx, cyBase, s);
  return [top[0], top[1], base[2], base[3], base[4], top[5]];
}

function inPoly(px: number, py: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * The unit under a projected world point, front-most column first (hexes nearer the viewer
 * cover the ones behind). `heightOf` gives each hex's current column height.
 */
export function hitUnit(T: Territory, X: number, Y: number, heightOf: (t: TerrHex) => number): string | null {
  const order = drawOrder(T.hexes);
  for (let i = order.length - 1; i >= 0; i--) {
    const t = order[i];
    if (inPoly(X, Y, columnOutline(t.x, t.z, heightOf(t), HEX.tile, t.e))) return t.unitId;
  }
  return null;
}

/** Painter's order: back rows first (smaller z), then left to right. */
export function drawOrder<T extends { z: number; x: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.z - b.z || a.x - b.x);
}

/** Projected bounds of a unit's patch at its current look. */
export function unitBox(u: UnitTerritory, level: Step): Box {
  const look = lookOf(level);
  const pts: [number, number][] = [];
  for (const t of u.hexes) {
    pts.push(project(t.x - 1, t.z - 1, t.e + look.height(t.h)));
    pts.push(project(t.x + 1, t.z + 1, t.e));
  }
  return boxOf(pts);
}

// ---------- camera ----------

/** World point shown at the viewport centre, and zoom (screen px per world unit). */
export interface Cam {
  x: number;
  y: number;
  k: number;
}
export interface View {
  w: number;
  h: number;
}
/** Top band of the view the HUD covers (share of the height): the zoomed-out continent sits below it. */
export const HUD_TOP = 0.2;

/** Zoom limits: from the whole continent (below the HUD band) to ~7 hexes across the width. */
export function zoomLimits(T: Territory, v: View): { min: number; max: number } {
  const bw = T.box.x1 - T.box.x0;
  const bh = T.box.y1 - T.box.y0;
  const min = Math.min(v.w / bw, (v.h * (1 - HUD_TOP)) / bh) * 0.94;
  return { min, max: Math.max(min * 2, v.w / 7) };
}

export function toScreen(c: Cam, v: View, X: number, Y: number): [number, number] {
  return [(X - c.x) * c.k + v.w / 2, (Y - c.y) * c.k + v.h / 2];
}
export function toWorld(c: Cam, v: View, sx: number, sy: number): [number, number] {
  return [(sx - v.w / 2) / c.k + c.x, (sy - v.h / 2) / c.k + c.y];
}

/** How far past the map's edge the view may go, as a share of the half view (the rest stays map). */
export const OVERSCROLL = 0.6;

/**
 * Keep the zoom in its limits and the map on screen: the view may run past the map's edge by
 * OVERSCROLL of half a screen at most (so the screen centre never leaves the map); a map narrower
 * than the view is centred, one shorter than the band below the HUD is centred in that band.
 */
export function clampCam(c: Cam, T: Territory, v: View): Cam {
  const { min, max } = zoomLimits(T, v);
  const k = Math.min(max, Math.max(min, c.k));
  const axis = (val: number, lo: number, hi: number, half: number, shift: number) => {
    const a = lo + half * (1 - OVERSCROLL);
    const b = hi - half * (1 - OVERSCROLL);
    return hi - lo <= 2 * half - 2 * shift ? (lo + hi) / 2 - shift : Math.min(b, Math.max(a, val));
  };
  return {
    k,
    x: axis(c.x, T.box.x0, T.box.x1, v.w / 2 / k, 0),
    // a continent shorter than the view sits centred in the band below the HUD
    y: axis(c.y, T.box.y0, T.box.y1, v.h / 2 / k, (v.h * HUD_TOP) / 2 / k),
  };
}

/** Zoom by `f` around a screen point (pinch centre / double-tap / ± buttons use the screen centre). */
export function zoomAt(c: Cam, v: View, f: number, sx: number, sy: number, T: Territory): Cam {
  const [wx, wy] = toWorld(c, v, sx, sy);
  const { min, max } = zoomLimits(T, v);
  const k = Math.min(max, Math.max(min, c.k * f));
  // keep (wx, wy) under (sx, sy)
  return clampCam({ k, x: wx - (sx - v.w / 2) / k, y: wy - (sy - v.h / 2) / k }, T, v);
}

/** Pan by a screen delta. */
export function panBy(c: Cam, v: View, dx: number, dy: number, T: Territory): Cam {
  return clampCam({ k: c.k, x: c.x - dx / c.k, y: c.y - dy / c.k }, T, v);
}

/**
 * Frame a box inside a screen region (default: the whole view): the box fills `fill` of the region's
 * width (or less, when its height would not fit), centred in the region; `maxK` caps the zoom.
 */
export function frameBox(
  b: Box,
  v: View,
  T: Territory,
  opts: { fill?: number; region?: Box; maxK?: number } = {},
): Cam {
  const reg = opts.region ?? { x0: 0, y0: 0, x1: v.w, y1: v.h };
  const fill = opts.fill ?? 0.7;
  const rw = reg.x1 - reg.x0;
  const rh = reg.y1 - reg.y0;
  const bw = Math.max(1e-6, b.x1 - b.x0);
  const bh = Math.max(1e-6, b.y1 - b.y0);
  let k = Math.min((rw * fill) / bw, (rh * 0.96) / bh);
  if (opts.maxK) k = Math.min(k, opts.maxK);
  const { min, max } = zoomLimits(T, v);
  k = Math.min(max, Math.max(min, k));
  // world centre such that the box centre lands on the region centre
  const bx = (b.x0 + b.x1) / 2;
  const by = (b.y0 + b.y1) / 2;
  const rx = (reg.x0 + reg.x1) / 2;
  const ry = (reg.y0 + reg.y1) / 2;
  return clampCam({ k, x: bx - (rx - v.w / 2) / k, y: by - (ry - v.h / 2) / k }, T, v);
}

/**
 * On load: the child's zone fills ~70% of the width, a little below the middle (the HUD sits at the
 * top), so the trail is seen running on into the next zone above it.
 */
export function homeCam(T: Territory, grade: Grade, v: View): Cam {
  const reg = T.byGrade.get(grade)!;
  const c = frameBox(reg.box, v, T, { fill: 0.7, region: { x0: 0, y0: v.h * 0.16, x1: v.w, y1: v.h * 0.94 } });
  // lean towards the next zone up the trail (the zone keeps a 4 % margin on that side)
  const i = T.regions.indexOf(reg);
  const next = T.regions[i + 1];
  if (!next) return c;
  const side = Math.sign(next.x - reg.x);
  return clampCam({ ...c, x: c.x + (side * HOME_LEAN * v.w) / c.k }, T, v);
}
/** How far (share of the width) the home view leans towards the next zone. */
export const HOME_LEAN = 0.11;

/** Ease between two cameras (t in 0…1, smoothstep; zoom interpolated geometrically). */
export function lerpCam(a: Cam, b: Cam, t: number): Cam {
  const s = t * t * (3 - 2 * t);
  return { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s, k: a.k * Math.pow(b.k / a.k, s) };
}

/** The video's "back" easing (columns overshoot a little as they rise). */
export function easeBack(x: number): number {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
}

// ---------- HUD ----------

export const LEVELS = ["小", "中", "高"] as const;
export type Level = (typeof LEVELS)[number];

export interface Hud {
  grade: Grade;
  /** 制覇した単元 of the child's grade: every unit with data, Lv ≥ 1 (red ones are still the child's, under attack). */
  taken: number;
  total: number;
  /** Units of the child's grade on each step (= the report's counts). */
  counts: LevelCounts;
  /** 「定着 1 ・ マスター 2 ・ 挑戦中 1」 (steps with units, highest first). */
  levelsLine: string;
  /** Whole map, per school: units with data / all units. */
  levels: Record<Level, { taken: number; total: number }>;
  /** Red flags on the whole map. */
  flagged: number;
  /** 次にやること, in order (the report's 次にやること topped up from earlier grades). */
  next: string[];
}

/** HUD numbers = the 学習レポート's numbers (counts, 次にやること), plus the whole-map bars. */
export function buildHud(pages: SavedPage[], grade: Grade, now = new Date()): Hud {
  const r = buildReport(pages, grade, now);
  const strip = stripFromReport(r);
  const tiles = mapTiles(pages, now);
  const levels = { 小: { taken: 0, total: 0 }, 中: { taken: 0, total: 0 }, 高: { taken: 0, total: 0 } } as Hud["levels"];
  for (const t of tiles) {
    const l = levels[t.unit.level as Level];
    l.total++;
    if (t.level > 0) l.taken++;
  }
  return {
    grade,
    taken: r.total - r.counts.mada,
    total: r.total,
    counts: r.counts,
    levelsLine: countsLine(r.counts),
    levels,
    flagged: tiles.filter((t) => t.level === 1).length,
    next: strip.next.slice(0, STRIP_NEXT).map((n) => n.unit.id),
  };
}

// ---------- detail sheet ----------

/** 「10/19」 from an ISO time (device time); "" when it cannot be read. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}/${d.getDate()}`;
}

export interface HistoryRow {
  pageId: string;
  /** 「10/19」 (device time). */
  date: string;
  type: string;
  wrong: number;
  ok: number;
  none: number;
}

/** The unit's historic record: every page with problems in it, newest first. */
export function unitHistory(pages: SavedPage[], unitId: string): HistoryRow[] {
  const rows: (HistoryRow & { at: string })[] = [];
  for (const pg of pages) {
    const ps = pg.problems.filter((p) => p.unit === unitId);
    if (ps.length === 0) continue;
    rows.push({
      at: pg.createdAt,
      pageId: pg.id,
      date: shortDate(pg.createdAt),
      type: app.pageType[pg.pageType] ?? app.pageType.other,
      wrong: ps.filter((p) => p.mark === "✕").length,
      ok: ps.filter((p) => p.mark === "○").length,
      none: ps.filter((p) => p.mark !== "✕" && p.mark !== "○").length,
    });
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at)).map(({ at: _at, ...r }) => r);
}

/** Accessible name of a tile: 「小5 平均：挑戦中（✕2）」. */
export function tileLabel(t: Tile): string {
  return `${t.unit.appGrade} ${t.unit.topic}：${levelName(t.level)}${t.level === 1 ? `（✕${t.wrong}）` : ""}`;
}

/** Grade of a unit id (for flying to its zone). */
export function gradeOfUnit(id: string): Grade | null {
  return unitById(id)?.appGrade ?? null;
}

// ---------- zones: progress on the trail ----------

export interface ZoneProgress {
  grade: Grade;
  /** Units with data (Lv ≥ 1). */
  taken: number;
  total: number;
  /** Units of the zone on each step. */
  counts: LevelCounts;
  /** Every unit of the zone taken: the trail marker becomes a planted flag. */
  complete: boolean;
}

/** 制覇 N/M per zone, from the same tiles as the map. */
export function zoneProgress(tiles: Tile[]): Map<Grade, ZoneProgress> {
  const out = new Map<Grade, ZoneProgress>(GRADES.map((g) => [g, { grade: g, taken: 0, total: 0, counts: zeroCounts(), complete: false }]));
  for (const t of tiles) {
    const z = out.get(t.unit.appGrade)!;
    z.total++;
    z.counts[t.key]++;
    if (t.level > 0) z.taken++;
  }
  for (const z of out.values()) z.complete = z.total > 0 && z.taken === z.total;
  return out;
}

/** The zone's name (海岸線 … 山頂). */
export const zoneName = (g: Grade): string => app.map.terr.zones[g];
