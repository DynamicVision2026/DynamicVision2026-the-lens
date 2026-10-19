import { GRADES, type Grade, UNITS, type Unit, unitById } from "../curriculum";
import type { Tile, TileStatus } from "./review";

/**
 * 単元星図: the 学習指導要領 as a night-sky chart.
 * Four vertical lanes (strands), grades as horizontal bands rising upward (小1 bottom, 高校 top).
 * Every unit is a star; each star links to its roots: same lane, nearest lower grade.
 * Pure functions only (no DOM), so layout and roots are unit-tested.
 */

export const LANES = ["num", "geo", "rel", "data"] as const;
export type Lane = (typeof LANES)[number];

/** 小学校・中学校: the 領域 letter decides the lane (小1–3 C 測定 → 変化と関係, as planned). */
const LANE_BY_DOMAIN: Record<string, Lane> = { A: "num", B: "geo", C: "rel", D: "data" };

/**
 * 高校 (21 units): one lane per unit, chosen by topic. The only hand-made table in the chart.
 *   数と計算    数と式, いろいろな式, 数学と人間の活動（約数・倍数、互除法、二進法）, 数列
 *   図形        図形と計量, 図形と方程式, 図形の性質, ベクトル, 平面上の曲線と複素数平面
 *   変化と関係  二次関数, 指数・対数関数, 三角関数, 微分・積分の考え, 極限, 微分法, 積分法
 *   データ      データの分析, 場合の数と確率, 統計的な推測, 数学と社会生活, 数学的な表現の工夫（図・表・統計グラフ）
 */
export const HIGH_SCHOOL_LANES: Record<string, Lane> = {
  "h-I-1": "num", // 数と式
  "h-I-2": "geo", // 図形と計量
  "h-I-3": "rel", // 二次関数
  "h-I-4": "data", // データの分析
  "h-II-1": "num", // いろいろな式
  "h-II-2": "geo", // 図形と方程式
  "h-II-3": "rel", // 指数関数・対数関数
  "h-II-4": "rel", // 三角関数
  "h-II-5": "rel", // 微分・積分の考え
  "h-III-1": "rel", // 極限（数列の極限・関数の極限）
  "h-III-2": "rel", // 微分法
  "h-III-3": "rel", // 積分法
  "h-A-1": "geo", // 図形の性質
  "h-A-2": "data", // 場合の数と確率
  "h-A-3": "num", // 数学と人間の活動（整数の性質・記数法）
  "h-B-1": "num", // 数列
  "h-B-2": "data", // 統計的な推測
  "h-B-3": "data", // 数学と社会生活（データで社会の問題を考える）
  "h-C-1": "geo", // ベクトル
  "h-C-2": "geo", // 平面上の曲線と複素数平面
  "h-C-3": "data", // 数学的な表現の工夫（図・表・統計グラフ、行列）
};

/** Stack order inside the 高校 band (bottom → top): the usual study order. */
const HS_SUBJECT_ORDER = ["I", "A", "II", "B", "III", "C"];

export function laneOf(u: Unit): Lane {
  if (u.level === "高") {
    const lane = HIGH_SCHOOL_LANES[u.id];
    if (!lane) throw new Error(`no lane for ${u.id}`);
    return lane;
  }
  const lane = LANE_BY_DOMAIN[u.unit.charAt(0)];
  if (!lane) throw new Error(`no lane for ${u.id}`);
  return lane;
}

function hsRank(u: Unit): number {
  const [, subject, n] = u.id.split("-");
  return HS_SUBJECT_ORDER.indexOf(subject) * 10 + Number(n);
}

/** Units of one grade in one lane, bottom of the stack first. */
export function laneUnits(grade: Grade, lane: Lane): Unit[] {
  const us = UNITS.filter((u) => u.appGrade === grade && laneOf(u) === lane);
  return grade === "高校" ? us.sort((a, b) => hsRank(a) - hsRank(b)) : us;
}

// ---------- roots ----------

/** Kanji / katakana bigrams of a text (hiragana and punctuation split words). */
function bigrams(text: string): Set<string> {
  const out = new Set<string>();
  for (const run of text.match(/[\p{Script=Han}\p{Script=Katakana}ー]+/gu) ?? []) {
    if (run.length === 1) out.add(run);
    for (let i = 0; i + 1 < run.length; i++) out.add(run.slice(i, i + 2));
  }
  return out;
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

/** How strongly unit `b` looks like a root of unit `a` (shared words; the topic counts double). */
function kinship(a: Unit, b: Unit): number {
  const at = bigrams(a.topic);
  const bt = bigrams(b.topic);
  const ac = bigrams(a.covers.join("、"));
  const bc = bigrams(b.covers.join("、"));
  const same = a.topic === b.topic ? 4 : 0; // e.g. そろばん → そろばん (all hiragana, no bigrams)
  return same + 2 * overlap(at, bt) + overlap(at, bc) + overlap(ac, bt) + overlap(ac, bc) * 0.5;
}

/** Hand-set roots where shared words point the wrong way (still same lane, nearest lower grade). */
const ROOT_OVERRIDES: Record<string, string[]> = {
  "4-A2": ["3-A1"], // 概数 ← 整数の表し方 (rounding builds on place value)
  "j1-A3": ["6-A2"], // 一元一次方程式 ← 文字を用いた式
};

const MAX_ROOTS = 3;

/**
 * もとになる単元: same lane, nearest lower grade that has units in that lane.
 * Up to 3, most related first (shared words in topic / covers). If nothing shares a word,
 * the lane's units of that grade (up to 3, curriculum order) are the roots. Two hand fixes above.
 */
export function rootsOf(unit: Unit): Unit[] {
  const fixed = ROOT_OVERRIDES[unit.id];
  if (fixed) return fixed.map((id) => unitById(id)!);
  const lane = laneOf(unit);
  for (let gi = GRADES.indexOf(unit.appGrade) - 1; gi >= 0; gi--) {
    const cands = laneUnits(GRADES[gi], lane);
    if (cands.length === 0) continue;
    const scored = cands.map((u, i) => ({ u, i, s: kinship(unit, u) }));
    const best = Math.max(...scored.map((x) => x.s));
    if (best <= 0) return cands.slice(0, MAX_ROOTS);
    return scored
      .filter((x) => x.s > 0 && x.s >= best / 3)
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .slice(0, MAX_ROOTS)
      .map((x) => x.u);
  }
  return [];
}

const ROOTS = new Map(UNITS.map((u) => [u.id, rootsOf(u).map((r) => r.id)]));

export function rootIds(id: string): string[] {
  return ROOTS.get(id) ?? [];
}

/** The whole root path of a unit: every ancestor id and every edge on the way down. */
export function rootPath(id: string): { units: Set<string>; edges: Set<string> } {
  const units = new Set<string>([id]);
  const edges = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const r of rootIds(cur)) {
      edges.add(edgeKey(cur, r));
      if (!units.has(r)) {
        units.add(r);
        stack.push(r);
      }
    }
  }
  return { units, edges };
}

export function edgeKey(from: string, to: string): string {
  return `${from}>${to}`;
}

// ---------- layout ----------

/**
 * Near sky vs far sky. "Near" bands (the child's grade, the grade below, and one band the child
 * opened) show every star with its label and a 44 px tap target. "Far" bands are one compact row:
 * each lane's stars sit side by side as a small cluster, no labels; the whole band is one tap
 * target that opens it.
 */
export const SKY = {
  /** Grade label strip at the top of a near band. */
  bandHead: 26,
  /** One star + its label (≥ 44 px tap target incl. 1 px inset each side). */
  nodeH: 46,
  bandPad: 8,
  /** Star centre from the lane's left edge / node top. */
  starX: 14,
  starY: 14,
  /** Far band: height, star row, gap between clustered stars. */
  farH: 46,
  farStarY: 31,
  farGap: 12,
  /** Head row above the expanded upper grades (label + 「たたむ」). */
  upperHead: 34,
};

export interface SkyNode {
  id: string;
  lane: Lane;
  grade: Grade;
  /** In a far band: no label, not a button of its own. */
  far: boolean;
  /** Tap box (near) / the star's own small box (far). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Star centre. */
  cx: number;
  cy: number;
}
export interface SkyBand {
  grade: Grade;
  near: boolean;
  y: number;
  h: number;
}
export interface SkyEdge {
  key: string;
  from: string;
  to: string;
  d: string;
}
/**
 * The grades above the child's grade. Merged: one compact far row at the top (every star of
 * those grades side by side per lane, faint), the whole row one button. Expanded: a thin head
 * row (label + 「たたむ」) above their individual far bands.
 */
export interface SkyUpper {
  grades: Grade[];
  merged: boolean;
  /** The merged row, or the head row when expanded. */
  y: number;
  h: number;
}
export interface SkyLayout {
  width: number;
  height: number;
  laneW: number;
  /** Individual bands (merged upper grades are not in here: see `upper`). */
  bands: SkyBand[];
  upper: SkyUpper | null;
  nodes: SkyNode[];
  edges: SkyEdge[];
  byId: Map<string, SkyNode>;
}

/** Bands from the top of the chart: 高校 first, 小1 last (knowledge grows upward). */
export const BANDS_TOP_DOWN: Grade[] = [...GRADES].reverse();

/** Default near bands: the child's grade and the grade below it, plus one opened band. */
export function nearGrades(own: Grade, opened: Grade | null = null): Set<Grade> {
  const i = GRADES.indexOf(own);
  const s = new Set<Grade>([own]);
  if (i > 0) s.add(GRADES[i - 1]);
  if (opened) s.add(opened);
  return s;
}

/**
 * A root line: one gentle quadratic curve from the star down to its root, bowing left.
 * If another star sits on the straight way (same column, between the two), the bow is wider.
 */
function edgePath(a: SkyNode, b: SkyNode, all: SkyNode[]): string {
  const top = Math.min(a.cy, b.cy) + 8;
  const bottom = Math.max(a.cy, b.cy) - 8;
  const minX = Math.min(a.cx, b.cx);
  const maxX = Math.max(a.cx, b.cx);
  const blocked = all.some((n) => n !== a && n !== b && n.cy > top && n.cy < bottom && n.cx > minX - 10 && n.cx < maxX + 10);
  const bow = blocked ? 40 : 16;
  const qx = (a.cx + b.cx) / 2 - bow;
  const qy = (a.cy + b.cy) / 2;
  return `M${a.cx} ${a.cy}Q${qx.toFixed(1)} ${qy.toFixed(1)} ${b.cx} ${b.cy}`;
}

/** Grades above the child's grade, lowest first (小5 → 小6 … 高校; 高校 → none). */
export function gradesAbove(own: Grade): Grade[] {
  return GRADES.slice(GRADES.indexOf(own) + 1);
}

/** Lay out stars of one lane side by side in a far row (centred, gap shrinks to fit the lane). */
function farRow(units: Unit[], li: number, laneW: number, cy: number, lane: Lane, nodes: SkyNode[]) {
  const laneX = li * laneW;
  const gap = units.length > 1 ? Math.min(SKY.farGap, (laneW - 16) / (units.length - 1)) : 0;
  const x0 = laneX + laneW / 2 - (gap * (units.length - 1)) / 2;
  units.forEach((u, k) => {
    const cx = x0 + k * gap;
    nodes.push({ id: u.id, lane, grade: u.appGrade, far: true, x: cx - gap / 2, y: cy - 5, w: Math.max(gap, 1), h: 10, cx, cy });
  });
}

export function layoutStarmap(
  width: number,
  near: Iterable<Grade> = GRADES,
  upperOpt: { grades: Grade[]; merged: boolean } | null = null,
): SkyLayout {
  const nearSet = new Set(near);
  const laneW = width / LANES.length;
  const bands: SkyBand[] = [];
  const nodes: SkyNode[] = [];
  let y = 0;
  let upper: SkyUpper | null = null;
  const upperSet = new Set(upperOpt && upperOpt.grades.length > 0 ? upperOpt.grades : []);
  if (upperSet.size > 0) {
    const merged = upperOpt!.merged && ![...upperSet].some((g) => nearSet.has(g));
    if (merged) {
      // One dense row: per lane, the upper grades' units from the lowest grade (left) up.
      const low = [...upperSet].sort((a, b) => GRADES.indexOf(a) - GRADES.indexOf(b));
      LANES.forEach((lane, li) =>
        farRow(low.flatMap((g) => laneUnits(g, lane)), li, laneW, SKY.farStarY, lane, nodes),
      );
      upper = { grades: low, merged: true, y: 0, h: SKY.farH };
      y = SKY.farH;
    } else {
      upper = { grades: [...upperSet].sort((a, b) => GRADES.indexOf(a) - GRADES.indexOf(b)), merged: false, y: 0, h: SKY.upperHead };
      y = SKY.upperHead;
    }
  }
  for (const grade of BANDS_TOP_DOWN) {
    if (upper?.merged && upperSet.has(grade)) continue;
    const stacks = LANES.map((lane) => laneUnits(grade, lane));
    const isNear = nearSet.has(grade);
    let h: number;
    if (isNear) {
      const rows = Math.max(1, ...stacks.map((s) => s.length));
      h = SKY.bandHead + rows * SKY.nodeH + SKY.bandPad;
      stacks.forEach((units, li) => {
        const laneX = li * laneW;
        units.forEach((u, k) => {
          // The first unit sits lowest in its stack, later units rise above it. Stacks hang from the
          // top of the band, so a root line to the band below stays short.
          const top = y + SKY.bandHead + (units.length - 1 - k) * SKY.nodeH;
          nodes.push({
            id: u.id, lane: LANES[li], grade, far: false,
            x: laneX + 1, y: top + 1, w: laneW - 2, h: SKY.nodeH - 2,
            cx: laneX + SKY.starX, cy: top + SKY.starY,
          });
        });
      });
    } else {
      h = SKY.farH;
      stacks.forEach((units, li) => farRow(units, li, laneW, y + SKY.farStarY, LANES[li], nodes));
    }
    bands.push({ grade, near: isNear, y, h });
    y += h;
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: SkyEdge[] = [];
  for (const n of nodes)
    for (const r of rootIds(n.id)) {
      const m = byId.get(r)!;
      if (m.cy <= n.cy) continue; // both inside the merged upper row: no line
      edges.push({ key: edgeKey(n.id, r), from: n.id, to: r, d: edgePath(n, m, nodes) });
    }
  return { width, height: y, laneW, bands, upper, nodes, edges, byId };
}

// ---------- bottom sheet ----------

export interface SheetData {
  unit: Unit;
  tile: Tile;
  roots: { unit: Unit; status: TileStatus }[];
}

export function sheetData(id: string, tiles: Tile[]): SheetData | null {
  const unit = unitById(id);
  if (!unit) return null;
  const byId = new Map(tiles.map((t) => [t.unit.id, t]));
  const tile = byId.get(id) ?? { unit, count: 0, wrong: 0, status: "empty" as const };
  const roots = rootIds(id).map((r) => ({ unit: unitById(r)!, status: byId.get(r)?.status ?? ("empty" as const) }));
  return { unit, tile, roots };
}

/** Counts of each state among one grade's tiles (header summary). */
export function gradeCounts(tiles: Tile[], grade: Grade): Record<TileStatus, number> {
  const c: Record<TileStatus, number> = { gold: 0, review: 0, ok: 0, empty: 0 };
  for (const t of tiles) if (t.unit.appGrade === grade) c[t.status]++;
  return c;
}

/** Faint background specks (decoration only), deterministic so renders and screenshots are stable. */
export function specks(width: number, height: number, n = Math.round(height / 30)): { x: number; y: number; r: number; o: number }[] {
  let s = 20261019;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  return Array.from({ length: n }, () => ({ x: rnd() * width, y: rnd() * height, r: 0.5 + rnd() * 0.7, o: 0.12 + rnd() * 0.28 }));
}
