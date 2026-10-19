import { GRADES, type Grade, UNITS, type Unit, unitById } from "../curriculum";
import { type Level, type LevelCounts, type LevelKey, MADA, type UnitLevel, unitLevels, zeroCounts } from "./ladder";
import type { SavedPage, SavedProblem } from "./model";

/** Below this the reading itself is uncertain, so the problem joins the テスト前リスト. */
export const LOW_CONFIDENCE = 0.6;

export type Reason = "wrong" | "low";

export function reasonFor(p: SavedProblem): Reason | null {
  if (p.mark === "✕") return "wrong";
  if (p.mark !== "○" && p.confidence < LOW_CONFIDENCE) return "low";
  return null;
}

export interface ListItem {
  page: SavedPage;
  problem: SavedProblem;
  index: number; // index in page.problems
  reason: Reason;
}

/** テスト前リスト: the ✕ (and low-confidence) problems of the chosen units, newest page first. */
export function testList(pages: SavedPage[], unitIds: Iterable<string>): ListItem[] {
  const want = new Set(unitIds);
  const items: ListItem[] = [];
  for (const page of [...pages].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    page.problems.forEach((problem, index) => {
      const reason = reasonFor(problem);
      if (reason && problem.unit && want.has(problem.unit)) items.push({ page, problem, index, reason });
    });
  }
  return items;
}

/**
 * テスト前リスト split for the screen:
 *   main      — ✕ / low-confidence problems of the chosen units below マスター (Lv < 3).
 *   nennotame — 念のため: the older ✕ / low-confidence problems of chosen マスター / 定着 units. Their newest
 *               page is all ○, so these are an optional re-check, not tonight's work.
 */
export function splitTestList(pages: SavedPage[], unitIds: Iterable<string>): { main: ListItem[]; nennotame: ListItem[] } {
  const gold = goldUnits(pages);
  const main: ListItem[] = [];
  const nennotame: ListItem[] = [];
  for (const item of testList(pages, unitIds)) (gold.has(item.problem.unit!) ? nennotame : main).push(item);
  return { main, nennotame };
}

/**
 * Share (0–100) of problems in range that need nothing more tonight; null when no data.
 * Old ✕ of gold units are not pending (they sit in 念のため, outside the main list).
 */
export function readiness(pages: SavedPage[], unitIds: Iterable<string>): number | null {
  const want = new Set(unitIds);
  const gold = goldUnits(pages);
  let total = 0;
  let pending = 0;
  for (const page of pages)
    for (const p of page.problems) {
      if (!p.unit || !want.has(p.unit)) continue;
      total++;
      if (reasonFor(p) && !p.reviewed && !gold.has(p.unit)) pending++;
    }
  return total === 0 ? null : Math.round(((total - pending) / total) * 100);
}

/**
 * マップ tile = the unit's step on the 5-step mastery ladder (lib/ladder.ts, the only place with the rules):
 *   Lv4 定着 > Lv3 マスター > Lv1 挑戦中 > Lv2 復習ずみ > Lv0 まだ.
 * マスター: on the newest saved page that has problems in this unit, every one of them has a final mark
 * of ○ (teacher's red mark, else the AI's judgment, or the parent's choice on the confirm screen; see
 * lib/marks.ts). null marks do not count. Ticking 「復習した」 cannot make a tile マスター.
 */
export interface Tile {
  unit: Unit;
  count: number;
  wrong: number;
  level: Level;
  key: LevelKey;
}

/**
 * The four states before the ladder (v0–v0.10), kept for reading old names only:
 * gold → マスター (Lv3), review → 挑戦中 (Lv1), ok → 復習ずみ (Lv2), empty → まだ (Lv0).
 * @deprecated use Tile.level / Tile.key.
 */
export type TileStatus = "gold" | "review" | "ok" | "empty";
export const LEGACY_LEVEL: Record<TileStatus, Level> = { empty: 0, review: 1, ok: 2, gold: 3 };
/** The old four-state name of a step (定着 was not a state before: it reads as gold). */
export function legacyStatus(level: Level): TileStatus {
  return level >= 3 ? "gold" : level === 2 ? "ok" : level === 1 ? "review" : "empty";
}

function tileOf(unit: Unit, u: UnitLevel | undefined): Tile {
  const lv = u ?? MADA;
  return { unit, count: lv.reasons.count, wrong: lv.reasons.wrong, level: lv.level, key: lv.key };
}

/** Units at マスター or above (Lv ≥ 3): their older ✕ sit in 念のため, not in tonight's list. */
export function goldUnits(pages: SavedPage[]): Set<string> {
  const out = new Set<string>();
  for (const [id, u] of unitLevels(pages)) if (u.level >= 3) out.add(id);
  return out;
}

/** マップ tiles for all 110 units, in curriculum order. */
export function mapTiles(pages: SavedPage[], now: Date = new Date()): Tile[] {
  const levels = unitLevels(pages, now);
  return UNITS.map((u) => tileOf(u, levels.get(u.id)));
}

/** Units per step among tiles. */
export function countLevels(tiles: Tile[]): LevelCounts {
  const c = zeroCounts();
  for (const t of tiles) c[t.key]++;
  return c;
}

export interface MapSection {
  grade: Grade;
  own: boolean;
  tiles: Tile[];
  counts: LevelCounts;
}

/** Whole-curriculum map: one section per grade, the child's own grade first, then 小1 … 高3. */
export function mapSections(pages: SavedPage[], grade: Grade): MapSection[] {
  const tiles = mapTiles(pages);
  const sections = GRADES.map((g): MapSection => {
    const ts = tiles.filter((t) => t.unit.appGrade === g);
    return { grade: g, own: g === grade, tiles: ts, counts: countLevels(ts) };
  });
  return [...sections.filter((s) => s.own), ...sections.filter((s) => !s.own)];
}

/** `?lit=5-C3,5-B3` → known unit ids, de-duplicated, in order (unknown ids dropped). */
export function parseLit(param: string | null | undefined): string[] {
  if (!param) return [];
  const out: string[] = [];
  for (const raw of param.split(",")) {
    const id = raw.trim();
    if (id && unitById(id) && !out.includes(id)) out.push(id);
    if (out.length >= 30) break;
  }
  return out;
}

/** Unit ids of a saved page, in problem order (for lighting up the map after 保存). */
export function pageUnitIds(page: SavedPage): string[] {
  return [...new Set(page.problems.map((p) => p.unit).filter((u): u is string => !!u))];
}

/** URL of the map right after saving a page (`page` = its id, for the toast that says what changed). */
export function litMapUrl(page: SavedPage): string {
  const ids = pageUnitIds(page);
  const q = new URLSearchParams({ saved: String(page.problems.length) });
  if (ids.length) q.set("lit", ids.join(","));
  q.set("page", page.id);
  return `/app/map?${q.toString().replace(/%2C/g, ",")}`;
}

/** Problems without a unit (the user has not picked one yet). */
export function unfiled(pages: SavedPage[]): number {
  return pages.reduce((n, pg) => n + pg.problems.filter((p) => !p.unit).length, 0);
}
