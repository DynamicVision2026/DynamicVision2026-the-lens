import { GRADES, type Grade, UNITS, type Unit, unitById } from "../curriculum";
import { app } from "../copy";
import type { SavedPage } from "./model";
import { buildReport } from "./report";
import { type Tile, type TileStatus, mapTiles } from "./review";
import { STRIP_NEXT, stripFromReport } from "./home";

/**
 * 領土マップ: the same map as the video 「日本の算数・数学マップ」 (mathvid/map.html, ported).
 *
 * Geometry is the video's, unchanged: pointy-top axial hexes, one district per grade (高校: one per
 * subject, two subjects per school year), each district a spiral of `points` hexes (the unit's
 * 知識・技能 count) sorted into angle wedges, units filling the wedges in curriculum order (so the
 * strands sit as coloured patches), two coast rings around every tile, the same seeded heights.
 * A unit's territory = its patch of hexes (110 units, 278 hexes).
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

/** District centres (axial), exactly as in the video. 高校 districts are subjects. */
export const DISTRICTS: { key: string; centre: [number, number] }[] = [
  { key: "小1", centre: [-26, 9] },
  { key: "小2", centre: [-19, 4] },
  { key: "小3", centre: [-11, 1] },
  { key: "小4", centre: [-21, 15] },
  { key: "小5", centre: [-12, 10] },
  { key: "小6", centre: [-4, 7] },
  { key: "中1", centre: [9, -6] },
  { key: "中2", centre: [16, -9] },
  { key: "中3", centre: [12, 0] },
  { key: "数学I", centre: [30, -15] },
  { key: "数学II", centre: [36, -20] },
  { key: "数学III", centre: [42, -25] },
  { key: "数学A", centre: [27, -22] },
  { key: "数学B", centre: [33, -27] },
  { key: "数学C", centre: [39, -31] },
];

/** Colour family of a unit: the strand (小・中: 領域 letter, as the video legend) or the 高校 subject. */
export type ColorKey = "num" | "geo" | "rel" | "data" | "hI" | "hII" | "hIII" | "hA" | "hB" | "hC";
export const STRANDS = ["num", "geo", "rel", "data"] as const;
const DOMAIN_COLOR: Record<string, ColorKey> = { A: "num", B: "geo", C: "rel", D: "data" };
export function colorKeyOf(u: Unit): ColorKey {
  if (u.level === "高") return `h${u.grade.replace("数学", "")}` as ColorKey;
  return DOMAIN_COLOR[u.unit.charAt(0)];
}

/** Flat oblique projection: ground depth × GY, height × HY (screen y grows downward). */
export const PROJ = { gy: 0.72, hy: 0.7 };
/** Hex radii (video: tile body 0.96, cap 0.80, land 1.0). */
export const HEX = { tile: 0.96, cap: 0.8, land: 1.0 };
/** Heights: まだ is the video's undiscovered height; マスター stands higher than its discovered height. */
export const HEIGHT = { empty: 0.16, goldLift: 0.55 };

export interface TerrHex {
  q: number;
  r: number;
  /** Ground position. */
  x: number;
  z: number;
  /** The video's discovered height for this hex. */
  h: number;
  unitId: string;
}
export interface LandHex {
  q: number;
  r: number;
  x: number;
  z: number;
  ring: 1 | 2;
  level: string;
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
export interface Island {
  grade: Grade;
  districts: string[];
  /** Ground centre of its unit hexes; the grade label floats above it. */
  x: number;
  z: number;
  /** Projected bounds of the island (tiles + coast), unit heights included. */
  box: Box;
}
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface Territory {
  hexes: TerrHex[];
  land: LandHex[];
  units: UnitTerritory[];
  byId: Map<string, UnitTerritory>;
  islands: Island[];
  byGrade: Map<Grade, Island>;
  /** Route through the district centres in video order (projected ground points). */
  route: [number, number][];
  /** Projected bounds of everything. */
  box: Box;
}

const VIDEO_ORDER = DISTRICTS.map((d) => d.key);

/** Projected point of a ground position at height h. */
export function project(x: number, z: number, h = 0): [number, number] {
  return [x, z * PROJ.gy - h * PROJ.hy];
}

function boxOf(pts: [number, number][], pad = 0): Box {
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
  // Video `rnd`, same seed and call order, so heights match the video.
  let sd = 12345;
  const rnd = () => {
    sd = (sd * 1103515245 + 12345) % 2147483648;
    return sd / 2147483648;
  };
  const hexes: TerrHex[] = [];
  const units: UnitTerritory[] = [];
  const occ = new Set<string>();
  for (const key of VIDEO_ORDER) {
    const gi = VIDEO_ORDER.indexOf(key);
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
    const c = DISTRICTS[gi].centre;
    const R = Math.sqrt(n) * 0.62;
    for (const [ui, u] of us.entries()) {
      const own: TerrHex[] = [];
      for (let i = 0; i < u.points; i++) {
        const [q, r] = plan[ui][i];
        const Q = q + c[0];
        const Rr = r + c[1];
        const [x, z] = hx(Q, Rr);
        const d = Math.sqrt(q * q + r * r + q * r) / Math.max(1, R);
        let h: number;
        if (u.level === "小") h = 0.35 + 0.07 * gi + 0.12 * rnd();
        else if (u.level === "中") h = 1.0 + 0.12 * (gi - 6) + 0.12 * rnd();
        else {
          const peak: Record<string, number> = { 数学I: 2.0, 数学II: 3.0, 数学III: 4.6, 数学A: 2.3, 数学B: 2.7, 数学C: 3.4 };
          h = 1.4 + peak[key] * Math.max(0, 1 - d * 0.85) + 0.15 * rnd();
        }
        const t: TerrHex = { q: Q, r: Rr, x, z, h, unitId: u.id };
        hexes.push(t);
        own.push(t);
        occ.add(`${Q},${Rr}`);
      }
      const mx = own.reduce((s, t) => s + t.x, 0) / own.length;
      const mz = own.reduce((s, t) => s + t.z, 0) / own.length;
      const anchor = own.reduce((best, t) => ((t.x - mx) ** 2 + (t.z - mz) ** 2 < (best.x - mx) ** 2 + (best.z - mz) ** 2 ? t : best));
      units.push({ id: u.id, unit: u, grade: u.appGrade, district: key, color: colorKeyOf(u), hexes: own, anchor });
    }
  }
  // Coast: two rings around every tile, first come first served (video order).
  const land: LandHex[] = [];
  const landSet = new Set<string>();
  const sp = spiral(19);
  const byUnit = new Map(units.map((u) => [u.id, u]));
  for (const t of hexes) {
    const level = byUnit.get(t.unitId)!.unit.level;
    for (const ring of [1, 2] as const) {
      for (const [dq, dr] of sp.slice(ring === 1 ? 1 : 7, ring === 1 ? 7 : 19)) {
        const Q = t.q + dq;
        const Rr = t.r + dr;
        const key = `${Q},${Rr}`;
        if (occ.has(key) || landSet.has(key)) continue;
        landSet.add(key);
        const [x, z] = hx(Q, Rr);
        land.push({ q: Q, r: Rr, x, z, ring, level });
      }
    }
  }
  // Islands = app grades (高1 = 数学I + 数学A, …).
  const islands: Island[] = GRADES.map((grade) => {
    const us = units.filter((u) => u.grade === grade);
    const hs = us.flatMap((u) => u.hexes);
    const x = hs.reduce((s, t) => s + t.x, 0) / hs.length;
    const z = hs.reduce((s, t) => s + t.z, 0) / hs.length;
    const districts = [...new Set(us.map((u) => u.district))];
    // Island box: its tiles at their tallest (gold) height, plus coast within 2.6 cells of a tile.
    const pts: [number, number][] = [];
    for (const t of hs) {
      pts.push(project(t.x - 1, t.z - 1, t.h + HEIGHT.goldLift));
      pts.push(project(t.x + 1, t.z + 1, 0));
    }
    return { grade, districts, x, z, box: boxOf(pts, 2.2) };
  });
  const centre = (key: string) => {
    const hs = units.filter((u) => u.district === key).flatMap((u) => u.hexes);
    return project(hs.reduce((s, t) => s + t.x, 0) / hs.length, hs.reduce((s, t) => s + t.z, 0) / hs.length);
  };
  const all: [number, number][] = [...hexes.map((t) => project(t.x, t.z, t.h + HEIGHT.goldLift)), ...land.map((l) => project(l.x, l.z))];
  return {
    hexes,
    land,
    units,
    byId: byUnit,
    islands,
    byGrade: new Map(islands.map((i) => [i.grade, i])),
    route: VIDEO_ORDER.map(centre),
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
  flag: boolean;
  crown: boolean;
  pulse: boolean;
}

/** The four existing tile states (review.ts) as territory: no rules of its own. */
export function lookOf(status: TileStatus): TileLook {
  switch (status) {
    case "empty":
      return { height: () => HEIGHT.empty, fill: "unex", flag: false, crown: false, pulse: false };
    case "ok":
      return { height: (h) => h, fill: "strand", flag: false, crown: false, pulse: false };
    case "review":
      return { height: (h) => h, fill: "strand", flag: true, crown: false, pulse: true };
    case "gold":
      return { height: (h) => h + HEIGHT.goldLift, fill: "gold", flag: false, crown: true, pulse: false };
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

/** Projected silhouette of a hex column (top face + the two front side faces), for hit testing. */
export function columnOutline(x: number, z: number, h: number, s = HEX.tile): [number, number][] {
  const [cx, cyTop] = project(x, z, h);
  const [, cyBase] = project(x, z, 0);
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
    if (inPoly(X, Y, columnOutline(t.x, t.z, heightOf(t)))) return t.unitId;
  }
  return null;
}

/** Painter's order: back rows first (smaller z), then left to right. */
export function drawOrder<T extends { z: number; x: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.z - b.z || a.x - b.x);
}

/** Projected bounds of a unit's patch at its current look. */
export function unitBox(u: UnitTerritory, status: TileStatus): Box {
  const look = lookOf(status);
  const pts: [number, number][] = [];
  for (const t of u.hexes) {
    pts.push(project(t.x - 1, t.z - 1, look.height(t.h)));
    pts.push(project(t.x + 1, t.z + 1, 0));
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
/** Zoom limits: from the whole map (a bit smaller than the screen) to ~4 hexes across the width. */
export function zoomLimits(T: Territory, v: View): { min: number; max: number } {
  const bw = T.box.x1 - T.box.x0;
  const bh = T.box.y1 - T.box.y0;
  const min = Math.min(v.w / bw, v.h / bh) * 0.9;
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
 * (or shorter) than the view is centred.
 */
export function clampCam(c: Cam, T: Territory, v: View): Cam {
  const { min, max } = zoomLimits(T, v);
  const k = Math.min(max, Math.max(min, c.k));
  const axis = (val: number, lo: number, hi: number, half: number) => {
    const a = lo + half * (1 - OVERSCROLL);
    const b = hi - half * (1 - OVERSCROLL);
    return hi - lo <= 2 * half ? (lo + hi) / 2 : Math.min(b, Math.max(a, val));
  };
  return {
    k,
    x: axis(c.x, T.box.x0, T.box.x1, v.w / 2 / k),
    y: axis(c.y, T.box.y0, T.box.y1, v.h / 2 / k),
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

/** On load: the child's island fills ~70% of the width, neighbours visible at the edges. */
export function homeCam(T: Territory, grade: Grade, v: View): Cam {
  const isl = T.byGrade.get(grade)!;
  // A little below the middle: the HUD card sits at the top.
  return frameBox(isl.box, v, T, { fill: 0.7, region: { x0: 0, y0: v.h * 0.12, x1: v.w, y1: v.h * 0.92 } });
}

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
  /** 制覇した単元 of the child's grade: every unit with data (red ones are still the child's, under attack). */
  taken: number;
  total: number;
  counts: Record<TileStatus, number>;
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
  const tiles = mapTiles(pages);
  const levels = { 小: { taken: 0, total: 0 }, 中: { taken: 0, total: 0 }, 高: { taken: 0, total: 0 } } as Hud["levels"];
  for (const t of tiles) {
    const l = levels[t.unit.level as Level];
    l.total++;
    if (t.status !== "empty") l.taken++;
  }
  return {
    grade,
    taken: r.total - r.counts.empty,
    total: r.total,
    counts: r.counts,
    levels,
    flagged: tiles.filter((t) => t.status === "review").length,
    next: strip.next.slice(0, STRIP_NEXT).map((n) => n.unit.id),
  };
}

// ---------- detail sheet ----------

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
    const d = new Date(pg.createdAt);
    rows.push({
      at: pg.createdAt,
      pageId: pg.id,
      date: Number.isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}/${d.getDate()}`,
      type: app.pageType[pg.pageType] ?? app.pageType.other,
      wrong: ps.filter((p) => p.mark === "✕").length,
      ok: ps.filter((p) => p.mark === "○").length,
      none: ps.filter((p) => p.mark !== "✕" && p.mark !== "○").length,
    });
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at)).map(({ at: _at, ...r }) => r);
}

/** Accessible name of a tile: 「小5 平均：復習が必要（✕2）」. */
export function tileLabel(t: Tile): string {
  const s = app.map.terr.states[t.status];
  return `${t.unit.appGrade} ${t.unit.topic}：${s}${t.status === "review" ? `（✕${t.wrong}）` : ""}`;
}

/** Grade of a unit id (for flying to its island). */
export function gradeOfUnit(id: string): Grade | null {
  return unitById(id)?.appGrade ?? null;
}
