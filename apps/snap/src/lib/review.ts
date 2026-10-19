import { GRADES, type Grade, UNITS, type Unit, unitById } from "../curriculum";
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
 *   main      — ✕ / low-confidence problems of the chosen units that are not gold (マスター).
 *   nennotame — 念のため: the older ✕ / low-confidence problems of chosen gold units. Their newest
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
 * マップ tile status, decided in this order:
 *   gold   — マスター: on the newest saved page that has problems in this unit, every one of
 *            them has a final mark of ○ (teacher's red mark, else the AI's judgment, or the
 *            parent's choice on the confirm screen; see lib/marks.ts). null marks do not count.
 *            Ticking 「復習した」 cannot make a tile gold.
 *   review — has a ✕ not yet ticked 「復習した」.
 *   ok     — has data, every ✕ reviewed.
 *   empty  — no problems yet.
 */
export type TileStatus = "gold" | "review" | "ok" | "empty";
export interface Tile {
  unit: Unit;
  count: number;
  wrong: number;
  status: TileStatus;
}

interface UnitStats {
  count: number;
  wrong: number;
  pending: number;
  /** createdAt of the newest page with problems in this unit, and whether all of them were ○ there. */
  latestAt: string;
  latestAllOk: boolean;
}

function unitStats(pages: SavedPage[]): Map<string, UnitStats> {
  const stats = new Map<string, UnitStats>();
  for (const page of pages) {
    const marks = new Map<string, boolean>(); // unit → all ○ on this page so far
    for (const p of page.problems) {
      if (!p.unit) continue;
      const s = stats.get(p.unit) ?? { count: 0, wrong: 0, pending: 0, latestAt: "", latestAllOk: false };
      s.count++;
      if (p.mark === "✕") {
        s.wrong++;
        if (!p.reviewed) s.pending++;
      }
      stats.set(p.unit, s);
      marks.set(p.unit, (marks.get(p.unit) ?? true) && p.mark === "○");
    }
    for (const [unit, allOk] of marks) {
      const s = stats.get(unit)!;
      // Strictly newer wins; on an exact tie the page read later in the list does not override.
      if (s.latestAt === "" || page.createdAt > s.latestAt) {
        s.latestAt = page.createdAt;
        s.latestAllOk = allOk;
      }
    }
  }
  return stats;
}

function tileOf(unit: Unit, s: UnitStats | undefined): Tile {
  const status: TileStatus = !s ? "empty" : s.latestAllOk ? "gold" : s.pending > 0 ? "review" : "ok";
  return { unit, count: s?.count ?? 0, wrong: s?.wrong ?? 0, status };
}

/** Units that are gold (マスター): the newest page with problems in the unit has only ○ there. */
export function goldUnits(pages: SavedPage[]): Set<string> {
  const out = new Set<string>();
  for (const [id, s] of unitStats(pages)) if (s.latestAllOk) out.add(id);
  return out;
}

/** マップ tiles for all 110 units, in curriculum order. */
export function mapTiles(pages: SavedPage[]): Tile[] {
  const stats = unitStats(pages);
  return UNITS.map((u) => tileOf(u, stats.get(u.id)));
}

export interface MapSection {
  grade: Grade;
  own: boolean;
  tiles: Tile[];
  counts: Record<TileStatus, number>;
}

/** Whole-curriculum map: one section per grade, the child's own grade first, then 小1 … 高校. */
export function mapSections(pages: SavedPage[], grade: Grade): MapSection[] {
  const tiles = mapTiles(pages);
  const sections = GRADES.map((g): MapSection => {
    const ts = tiles.filter((t) => t.unit.appGrade === g);
    const counts: Record<TileStatus, number> = { gold: 0, review: 0, ok: 0, empty: 0 };
    for (const t of ts) counts[t.status]++;
    return { grade: g, own: g === grade, tiles: ts, counts };
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

/** URL of the map right after saving a page. */
export function litMapUrl(page: SavedPage): string {
  const ids = pageUnitIds(page);
  const q = new URLSearchParams({ saved: String(page.problems.length) });
  if (ids.length) q.set("lit", ids.join(","));
  return `/app/map?${q.toString().replace(/%2C/g, ",")}`;
}

/** Problems without a unit (the user has not picked one yet). */
export function unfiled(pages: SavedPage[]): number {
  return pages.reduce((n, pg) => n + pg.problems.filter((p) => !p.unit).length, 0);
}
