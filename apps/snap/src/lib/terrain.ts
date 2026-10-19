import type { Grade } from "../curriculum";

/**
 * The continent's terrain (pure; no DOM): land cells around and between the zones, ground heights
 * (terraced, rising zone by zone), contour lines, shoreline contours, zone borders, the trail that
 * links the 12 zones in order, a lake + river (小6) and map-style surface marks (canopy dots,
 * grass ticks, rock hachures, snow, crevasses, the summit marker). Everything here is drawn under
 * the tiles, and no mark's footprint touches a tile (checked when the marks are placed, and tested).
 */

const SQ3 = Math.sqrt(3);
const GY = 0.72;
const HY = 0.7;
const DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const hx = (q: number, r: number): [number, number] => [SQ3 * (q + r / 2), 1.5 * r];
const key = (q: number, r: number) => `${q},${r}`;
const proj = (x: number, z: number, e: number): [number, number] => [x, z * GY - e * HY];
const STEP = 0.25;
const quant = (e: number) => Math.round(e / STEP) * STEP;

/** How far land reaches past the outermost tiles (cells). */
export const LAND_R = 4;

export type Zone = "coast" | "cove" | "plain" | "forest" | "deep" | "lake" | "hills" | "ridge" | "plateau" | "snowline" | "glacier" | "summit";

export interface TileIn {
  q: number;
  r: number;
  /** Ground height under the tile. */
  e: number;
  /** Highest the column ever gets (gold), for keeping marks clear of it. */
  top: number;
  grade: Grade;
}
export interface RegionIn {
  grade: Grade;
  zone: Zone;
  e: number;
  x: number;
  z: number;
}
export interface LandCell {
  q: number;
  r: number;
  x: number;
  z: number;
  /** Ground height (terraced). */
  e: number;
  /** Zone this ground belongs to: the nearest zone's tiles. */
  grade: Grade;
  zone: Zone;
  /** Cells to the nearest tile / to the open sea (1 = on the coast). */
  dTile: number;
  dSea: number;
  /** Lake water (小6). */
  water: boolean;
}
/** A projected line segment. */
export type Seg = [number, number, number, number];
export type DecoKind = "stipple" | "tuft" | "canopy" | "canopyDense" | "hachure" | "snow" | "crevasse" | "peak" | "pass";
export interface Deco {
  kind: DecoKind;
  x: number;
  z: number;
  e: number;
  /** Footprint half-size (ground units). */
  s: number;
  /** Per-mark seed 0…1 (rotation, dot pattern). */
  a: number;
}
export interface Terrain {
  land: LandCell[];
  /** Sea cells in the shallows (小1 / 小2 coast), ground positions. */
  shallow: [number, number][];
  /** Shoreline contours at sea level, nearest first (1…3 cells out). */
  shore: Seg[][];
  /** Terrace edges (ground steps down across them) and the coastline edge. */
  contours: Seg[];
  coastline: Seg[];
  /** Zone borders on the land. */
  borders: Seg[];
  /** Lake shore (inside the land). */
  lakeShore: Seg[];
  /** Projected points of the trail, coast → summit, through every zone's waypoint in order. */
  trail: [number, number][];
  /** Index into `trail` of each zone's waypoint. */
  trailAt: Map<Grade, number>;
  river: [number, number][];
  decos: Deco[];
  /** Projected waypoint of each zone on the trail. */
  waypoints: Map<Grade, [number, number]>;
}

/** Height a mark rises above its ground point (world units), for its footprint box. */
const LIFT: Record<DecoKind, number> = { stipple: 0, tuft: 0.12, canopy: 0.3, canopyDense: 0.3, hachure: 0, snow: 0, crevasse: 0, peak: 2.2, pass: 0 };

/** Projected box a mark is drawn inside (the painter keeps to it). */
export function decoBox(d: Deco): { x0: number; y0: number; x1: number; y1: number } {
  const [, py] = proj(d.x, d.z, d.e);
  return { x0: d.x - d.s, x1: d.x + d.s, y0: py - d.s * GY - LIFT[d.kind], y1: py + d.s * GY };
}

/** Projected box of a tile column at its tallest (corners at ±0.96 of a pointy-top hex). */
export function tileBox(t: { q: number; r: number; e: number; top: number }) {
  const [x, z] = hx(t.q, t.r);
  return { x0: x - 0.84, x1: x + 0.84, y0: z * GY - t.top * HY - 0.96 * GY, y1: z * GY - t.e * HY + 0.96 * GY };
}

const overlaps = (a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Tiny binary heap for Dijkstra. */
class Heap {
  private a: [number, string][] = [];
  get size() {
    return this.a.length;
  }
  push(p: number, k: string) {
    const a = this.a;
    a.push([p, k]);
    let i = a.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (a[j][0] <= a[i][0]) break;
      [a[i], a[j]] = [a[j], a[i]];
      i = j;
    }
  }
  pop(): [number, string] {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

export function buildTerrain(tiles: TileIn[], regions: RegionIn[]): Terrain {
  let sd = 9871;
  const rnd = () => {
    sd = (sd * 1103515245 + 12345) % 2147483648;
    return sd / 2147483648;
  };
  const tileAt = new Map(tiles.map((t) => [key(t.q, t.r), t]));
  const regionOf = new Map(regions.map((r) => [r.grade, r]));
  const land = new Set<string>();
  const nb = (k: string) => {
    const [q, r] = k.split(",").map(Number);
    return DIRS.map(([dq, dr]) => key(q + dq, r + dr));
  };
  const add = (k: string) => {
    if (!tileAt.has(k)) land.add(k);
  };
  // 1. land within LAND_R of any tile
  let front = tiles.map((t) => key(t.q, t.r));
  const seen = new Set(front);
  for (let d = 1; d <= LAND_R; d++) {
    const next: string[] = [];
    for (const k of front)
      for (const n of nb(k))
        if (!seen.has(n)) {
          seen.add(n);
          next.push(n);
          add(n);
        }
    front = next;
  }
  // 2. corridors between neighbouring zones (and every other one) so it is one landmass
  const disc: [number, number][] = [];
  for (let dq = -3; dq <= 3; dq++) for (let dr = -3; dr <= 3; dr++) if (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr) <= 6) disc.push([dq, dr]);
  const toAx = (x: number, z: number) => {
    const r = Math.round(z / 1.5);
    return [Math.round(x / SQ3 - r / 2), r];
  };
  for (let i = 0; i < regions.length; i++)
    for (const j of [i + 1, i + 2]) {
      if (j >= regions.length) continue;
      const a = regions[i];
      const b = regions[j];
      const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.8);
      for (let s = 0; s <= n; s++) {
        const [q, r] = toAx(a.x + ((b.x - a.x) * s) / n, a.z + ((b.z - a.z) * s) / n);
        for (const [dq, dr] of disc) add(key(q + dq, r + dr));
      }
    }
  // 3. smooth the outline, then fill enclosed sea
  const isGround = (k: string) => land.has(k) || tileAt.has(k);
  for (let it = 0; it < 2; it++) {
    const grow: string[] = [];
    const cand = new Set<string>();
    for (const k of land) for (const n of nb(k)) if (!isGround(n)) cand.add(n);
    for (const k of cand) if (nb(k).filter(isGround).length >= 4) grow.push(k);
    for (const k of grow) land.add(k);
  }
  let q0 = Infinity, q1 = -Infinity, r0 = Infinity, r1 = -Infinity;
  for (const k of [...land, ...tileAt.keys()]) {
    const [q, r] = k.split(",").map(Number);
    q0 = Math.min(q0, q);
    q1 = Math.max(q1, q);
    r0 = Math.min(r0, r);
    r1 = Math.max(r1, r);
  }
  // the open sea: everything not ground reachable from outside the land's bounds (+ a margin)
  const M = 5;
  const inBounds = (k: string) => {
    const [q, r] = k.split(",").map(Number);
    return q >= q0 - M && q <= q1 + M && r >= r0 - M && r <= r1 + M;
  };
  const sea = new Set<string>();
  const stack = [key(q0 - M, r0 - M)];
  sea.add(stack[0]);
  while (stack.length) {
    const k = stack.pop()!;
    for (const n of nb(k))
      if (!sea.has(n) && inBounds(n) && !isGround(n)) {
        sea.add(n);
        stack.push(n);
      }
  }
  for (let q = q0; q <= q1; q++) for (let r = r0; r <= r1; r++) if (!sea.has(key(q, r)) && !isGround(key(q, r))) land.add(key(q, r));

  // 4. nearest zone and distance to tiles (multi-source BFS through the land)
  const dTile = new Map<string, number>();
  const gradeAt = new Map<string, Grade>();
  front = [];
  for (const t of tiles) {
    const k = key(t.q, t.r);
    dTile.set(k, 0);
    gradeAt.set(k, t.grade);
    front.push(k);
  }
  for (let d = 1; front.length; d++) {
    const next: string[] = [];
    for (const k of front)
      for (const n of nb(k))
        if (land.has(n) && !dTile.has(n)) {
          dTile.set(n, d);
          gradeAt.set(n, gradeAt.get(k)!);
          next.push(n);
        }
    front = next;
  }
  // distance to the open sea through the land
  const dSea = new Map<string, number>();
  front = [];
  for (const k of land)
    if (nb(k).some((n) => sea.has(n) || (!isGround(n) && !inBounds(n)))) {
      dSea.set(k, 1);
      front.push(k);
    }
  for (let d = 2; front.length; d++) {
    const next: string[] = [];
    for (const k of front)
      for (const n of nb(k))
        if (land.has(n) && !dSea.has(n)) {
          dSea.set(n, d);
          next.push(n);
        }
    front = next;
  }

  // 5. ground height: rises with depth (zone by zone), flat plateaus around each zone's tiles,
  //    lower along the coast; terraced in STEP so contour lines fall on the hex edges
  const byZ = [...regions].sort((a, b) => b.z - a.z);
  const f = (z: number) => {
    if (z >= byZ[0].z) return byZ[0].e;
    for (let i = 1; i < byZ.length; i++)
      if (z >= byZ[i].z) {
        const t = (z - byZ[i].z) / (byZ[i - 1].z - byZ[i].z);
        return byZ[i].e + (byZ[i - 1].e - byZ[i].e) * t;
      }
    return byZ[byZ.length - 1].e;
  };
  const cells = new Map<string, LandCell>();
  for (const k of land) {
    const [q, r] = k.split(",").map(Number);
    const [x, z] = hx(q, r);
    const g = gradeAt.get(k)!;
    const reg = regionOf.get(g)!;
    const dt = dTile.get(k) ?? LAND_R;
    const ds = dSea.get(k) ?? 9;
    let e = dt <= 2 ? reg.e : quant(f(z));
    if (dt >= 2 && ds <= 2) e = Math.min(e, quant(e * (ds === 1 ? 0.4 : 0.72)));
    cells.set(k, { q, r, x, z, e, grade: g, zone: reg.zone, dTile: dt, dSea: ds, water: false });
  }
  const groundE = (k: string) => cells.get(k)?.e ?? tileAt.get(k)?.e ?? 0;

  // 6. the lake (小6): the inland cells furthest from its tiles, one level
  const lakeRegion = regions.find((r) => r.zone === "lake");
  if (lakeRegion) {
    const cand = [...cells.values()].filter((c) => c.grade === lakeRegion.grade && c.dTile >= 3 && c.dSea >= 3);
    cand.sort((a, b) => b.dTile - a.dTile || Math.hypot(a.x - lakeRegion.x, a.z - lakeRegion.z) - Math.hypot(b.x - lakeRegion.x, b.z - lakeRegion.z));
    const seed = cand[0];
    if (seed) {
      const lake = [seed];
      for (const n of nb(key(seed.q, seed.r))) {
        const c = cells.get(n);
        if (c && c.grade === lakeRegion.grade && c.dTile >= 2 && c.dSea >= 2 && lake.length < 6) lake.push(c);
      }
      const le = Math.min(...lake.map((c) => c.e));
      for (const c of lake) {
        c.water = true;
        c.e = le;
      }
    }
  }

  // 7. lines: terrace contours, coastline, zone borders, lake shore, shoreline contours
  const edge = (x: number, z: number, dq: number, dr: number, e: number): Seg => {
    const [dx, dz] = hx(dq, dr);
    const th = Math.atan2(dz, dx);
    const a = proj(x + Math.cos(th - Math.PI / 6), z + Math.sin(th - Math.PI / 6), e);
    const b = proj(x + Math.cos(th + Math.PI / 6), z + Math.sin(th + Math.PI / 6), e);
    return [a[0], a[1], b[0], b[1]];
  };
  const contours: Seg[] = [];
  const coastline: Seg[] = [];
  const borders: Seg[] = [];
  const lakeShore: Seg[] = [];
  for (const [k, c] of cells) {
    for (const [dq, dr] of DIRS) {
      const n = key(c.q + dq, c.r + dr);
      const o = cells.get(n);
      if (!o && !tileAt.has(n)) {
        coastline.push(edge(c.x, c.z, dq, dr, c.e));
        continue;
      }
      if (o && c.water !== o.water) {
        if (c.water) lakeShore.push(edge(c.x, c.z, dq, dr, c.e));
        continue;
      }
      if (groundE(n) < c.e - 1e-6) contours.push(edge(c.x, c.z, dq, dr, c.e));
      if (o && o.grade !== c.grade && !c.water && k < n) borders.push(edge(c.x, c.z, dq, dr, Math.max(c.e, o.e)));
    }
  }
  // sea: distance from the land, nearest land's zone (for the shallows)
  const dOut = new Map<string, number>();
  const seaGrade = new Map<string, Grade>();
  front = [];
  for (const [k, c] of cells)
    for (const n of nb(k))
      if (!isGround(n) && !dOut.has(n)) {
        dOut.set(n, 1);
        seaGrade.set(n, c.grade);
        front.push(n);
      }
  for (let d = 2; d <= 3; d++) {
    const next: string[] = [];
    for (const k of front)
      for (const n of nb(k))
        if (!isGround(n) && !dOut.has(n)) {
          dOut.set(n, d);
          seaGrade.set(n, seaGrade.get(k)!);
          next.push(n);
        }
    front = next;
  }
  const shore: Seg[][] = [[], [], []];
  const shallow: [number, number][] = [];
  for (const [k, d] of dOut) {
    const [q, r] = k.split(",").map(Number);
    const [x, z] = hx(q, r);
    const g = seaGrade.get(k)!;
    if (d <= 2 && (regionOf.get(g)!.zone === "coast" || regionOf.get(g)!.zone === "cove")) shallow.push([x, z]);
    for (const [dq, dr] of DIRS) {
      const n = key(q + dq, r + dr);
      const inner = d === 1 ? isGround(n) : dOut.get(n) === d - 1;
      if (inner) shore[d - 1].push(edge(x, z, dq, dr, 0));
    }
  }

  // 8. waypoints + the trail (cheapest walk over the land, kept off the tiles' edge)
  const waypointCell = new Map<Grade, LandCell>();
  for (const reg of regions) {
    const zMax = Math.max(...tiles.filter((t) => t.grade === reg.grade).map((t) => hx(t.q, t.r)[1]));
    const cand = [...cells.values()].filter((c) => c.grade === reg.grade && c.dTile === 2 && !c.water);
    cand.sort((a, b) => Math.hypot(a.x - reg.x, a.z - zMax - 3) - Math.hypot(b.x - reg.x, b.z - zMax - 3));
    waypointCell.set(reg.grade, cand[0]);
  }
  const walk = (from: string, to: string, ok: (c: LandCell) => boolean, cost: (c: LandCell) => number): string[] => {
    const dist = new Map([[from, 0]]);
    const prev = new Map<string, string>();
    const h = new Heap();
    h.push(0, from);
    while (h.size) {
      const [d, k] = h.pop();
      if (k === to) break;
      if (d > dist.get(k)!) continue;
      for (const n of nb(k)) {
        const c = cells.get(n);
        if (!c || !ok(c)) continue;
        const nd = d + cost(c);
        if (nd < (dist.get(n) ?? Infinity)) {
          dist.set(n, nd);
          prev.set(n, k);
          h.push(nd, n);
        }
      }
    }
    if (!dist.has(to)) return [];
    const path = [to];
    while (path[0] !== from) path.unshift(prev.get(path[0])!);
    return path;
  };
  const trailCost = (c: LandCell) => 1 + (c.dTile === 1 ? 8 : c.dTile === 2 ? 1.5 : 0);
  const onLand = (c: LandCell) => !c.water;
  const trailKeys: string[] = [];
  const trailAt = new Map<Grade, number>();
  // start where the first zone meets the sea
  const first = waypointCell.get(regions[0].grade)!;
  const landing = [...cells.values()].filter((c) => c.dSea === 1 && c.grade === regions[0].grade).sort((a, b) => b.z - a.z || Math.abs(a.x - first.x) - Math.abs(b.x - first.x))[0];
  if (landing) trailKeys.push(...walk(key(landing.q, landing.r), key(first.q, first.r), onLand, trailCost));
  else trailKeys.push(key(first.q, first.r));
  trailAt.set(regions[0].grade, trailKeys.length - 1);
  let passAt: string | null = null;
  for (let i = 1; i < regions.length; i++) {
    const a = waypointCell.get(regions[i - 1].grade)!;
    const b = waypointCell.get(regions[i].grade)!;
    const p = walk(key(a.q, a.r), key(b.q, b.r), onLand, trailCost);
    if (regions[i - 1].zone === "plateau" && p.length > 2) passAt = p[Math.floor(p.length / 2)];
    trailKeys.push(...p.slice(1));
    trailAt.set(regions[i].grade, trailKeys.length - 1);
  }
  // the last stretch: up to the summit marker (the back-most open ground of the last zone)
  const last = regions[regions.length - 1];
  const peakCell = [...cells.values()]
    .filter((c) => c.grade === last.grade && c.dTile >= 2 && !c.water)
    .sort((a, b) => a.z - b.z || Math.abs(a.x - last.x) - Math.abs(b.x - last.x))[0];
  const lastWp = waypointCell.get(last.grade)!;
  if (peakCell) trailKeys.push(...walk(key(lastWp.q, lastWp.r), key(peakCell.q, peakCell.r), onLand, trailCost).slice(1));
  const trail = trailKeys.map((k) => {
    const c = cells.get(k)!;
    return proj(c.x, c.z, c.e);
  });
  const waypoints = new Map<Grade, [number, number]>([...waypointCell].map(([g, c]) => [g, proj(c.x, c.z, c.e)]));

  // 9. river: from the lake down to the coast, away from the tiles
  let river: [number, number][] = [];
  const lakeCells = [...cells.values()].filter((c) => c.water);
  if (lakeCells.length) {
    const src = lakeCells.reduce((a, b) => (b.z > a.z ? b : a));
    const mouth = [...cells.values()]
      .filter((c) => c.dSea === 1 && c.dTile >= 2)
      .sort((a, b) => Math.hypot(a.x - src.x, a.z - src.z) - Math.hypot(b.x - src.x, b.z - src.z))[0];
    if (mouth) {
      const p = walk(key(src.q, src.r), key(mouth.q, mouth.r), (c) => c.dTile >= 2 && (!c.water || c === src), (c) => 1 + (c.dTile === 2 ? 2 : 0));
      river = p.map((k) => {
        const c = cells.get(k)!;
        return proj(c.x, c.z, c.e);
      });
    }
  }

  // 10. surface marks, kept clear of every tile column
  const tileBoxes = tiles.map(tileBox);
  const G = 4;
  const grid = new Map<string, number[]>();
  tileBoxes.forEach((b, i) => {
    for (let gx = Math.floor(b.x0 / G); gx <= Math.floor(b.x1 / G); gx++)
      for (let gy = Math.floor(b.y0 / G); gy <= Math.floor(b.y1 / G); gy++) {
        const gk = `${gx},${gy}`;
        if (!grid.has(gk)) grid.set(gk, []);
        grid.get(gk)!.push(i);
      }
  });
  const clear = (d: Deco) => {
    const b = decoBox(d);
    for (let gx = Math.floor(b.x0 / G); gx <= Math.floor(b.x1 / G); gx++)
      for (let gy = Math.floor(b.y0 / G); gy <= Math.floor(b.y1 / G); gy++)
        for (const i of grid.get(`${gx},${gy}`) ?? []) if (overlaps(b, tileBoxes[i])) return false;
    return true;
  };
  const trailSet = new Set(trailKeys);
  const decos: Deco[] = [];
  const put = (d: Deco) => {
    if (clear(d)) decos.push(d);
  };
  const ordered = [...cells.values()].sort((a, b) => a.z - b.z || a.x - b.x);
  for (const c of ordered) {
    if (c.water) continue;
    const p = rnd();
    const a = rnd();
    const jx = (rnd() - 0.5) * 0.4;
    const jz = (rnd() - 0.5) * 0.4;
    const at = (kind: DecoKind, s: number) => put({ kind, x: c.x + jx, z: c.z + jz, e: c.e, s, a });
    const onTrail = trailSet.has(key(c.q, c.r));
    switch (c.zone) {
      case "coast":
      case "cove":
        if (p < 0.55) at("stipple", 0.55);
        break;
      case "plain":
        if (p < 0.5 && !onTrail) at("tuft", 0.5);
        break;
      case "forest":
        if (p < 0.72 && !onTrail) at("canopy", 0.6);
        break;
      case "deep":
        if (!onTrail) at(p < 0.8 ? "canopyDense" : "canopy", 0.66);
        break;
      case "lake":
        if (p < 0.55 && !onTrail) at("canopy", 0.6);
        break;
      case "hills":
        if (p < 0.35 && !onTrail) at("tuft", 0.5);
        break;
      case "ridge":
        if (p < 0.75 && !onTrail) at("hachure", 0.6);
        break;
      case "plateau":
        if (p < 0.4 && !onTrail) at("tuft", 0.5);
        break;
      case "snowline":
        if (!onTrail) {
          if (p < 0.45) at("hachure", 0.6);
          else if (p < 0.8) at("snow", 0.55);
        }
        break;
      case "glacier":
        if (p < 0.55 && !onTrail) at("crevasse", 0.6);
        break;
      case "summit":
        if (p < 0.3 && !onTrail) at("hachure", 0.55);
        break;
    }
  }
  if (passAt) {
    const c = cells.get(passAt)!;
    put({ kind: "pass", x: c.x, z: c.z, e: c.e, s: 0.75, a: 0 });
  }
  if (peakCell) put({ kind: "peak", x: peakCell.x, z: peakCell.z, e: peakCell.e, s: 0.75, a: 0 });

  return {
    land: [...cells.values()],
    shallow,
    shore,
    contours,
    coastline,
    borders,
    lakeShore,
    trail,
    trailAt,
    river,
    decos,
    waypoints,
  };
}
