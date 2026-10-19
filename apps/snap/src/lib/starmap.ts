import { GRADES, type Grade, UNITS, type Unit, isHighSchool, unitById } from "../curriculum";
import { type Level, type LevelCounts, keyOf, zeroCounts } from "./ladder";
import type { Tile } from "./review";

/**
 * Curriculum strands (lanes) and roots: each unit links to its もとになる単元 (same lane, nearest
 * lower grade). Used by the territory map's sheet and root routes, and by the 学習レポート.
 * (v0.1–v0.6 drew these as a star chart; since v0.7 the map is the territory map, lib/territory.ts.)
 * Pure functions only (no DOM), unit-tested.
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

/** Stack order inside a 高1 / 高2 / 高3 band (bottom → top): the usual study order. */
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
  return isHighSchool(grade) ? us.sort((a, b) => hsRank(a) - hsRank(b)) : us;
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

// ---------- bottom sheet ----------

export interface SheetData {
  unit: Unit;
  tile: Tile;
  roots: { unit: Unit; level: Level }[];
}

export function sheetData(id: string, tiles: Tile[]): SheetData | null {
  const unit = unitById(id);
  if (!unit) return null;
  const byId = new Map(tiles.map((t) => [t.unit.id, t]));
  const tile: Tile = byId.get(id) ?? { unit, count: 0, wrong: 0, level: 0, key: keyOf(0) };
  const roots = rootIds(id).map((r) => ({ unit: unitById(r)!, level: byId.get(r)?.level ?? (0 as Level) }));
  return { unit, tile, roots };
}

/** Units on each step among one grade's tiles (header summary). */
export function gradeCounts(tiles: Tile[], grade: Grade): LevelCounts {
  const c = zeroCounts();
  for (const t of tiles) if (t.unit.appGrade === grade) c[t.key]++;
  return c;
}
