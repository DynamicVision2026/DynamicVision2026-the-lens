import { type Grade, type Unit, unitById, unitsForGrade } from "../curriculum";
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

/** Share (0–100) of problems in range that need nothing more tonight; null when no data. */
export function readiness(pages: SavedPage[], unitIds: Iterable<string>): number | null {
  const want = new Set(unitIds);
  let total = 0;
  let pending = 0;
  for (const page of pages)
    for (const p of page.problems) {
      if (!p.unit || !want.has(p.unit)) continue;
      total++;
      if (reasonFor(p) && !p.reviewed) pending++;
    }
  return total === 0 ? null : Math.round(((total - pending) / total) * 100);
}

export type TileStatus = "review" | "ok" | "empty";
export interface Tile {
  unit: Unit;
  count: number;
  wrong: number;
  status: TileStatus;
}

/** マップ tiles: the grade's units, plus any other unit that already has saved problems. */
export function mapTiles(pages: SavedPage[], grade: Grade): { own: Tile[]; other: Tile[] } {
  const stats = new Map<string, { count: number; wrong: number; pending: number }>();
  for (const page of pages)
    for (const p of page.problems) {
      if (!p.unit) continue;
      const s = stats.get(p.unit) ?? { count: 0, wrong: 0, pending: 0 };
      s.count++;
      if (p.mark === "✕") {
        s.wrong++;
        if (!p.reviewed) s.pending++;
      }
      stats.set(p.unit, s);
    }
  const tile = (unit: Unit): Tile => {
    const s = stats.get(unit.id);
    const status: TileStatus = !s ? "empty" : s.pending > 0 ? "review" : "ok";
    return { unit, count: s?.count ?? 0, wrong: s?.wrong ?? 0, status };
  };
  const own = unitsForGrade(grade);
  const ownIds = new Set(own.map((u) => u.id));
  const other = [...stats.keys()]
    .filter((id) => !ownIds.has(id))
    .map((id) => unitById(id))
    .filter((u): u is Unit => !!u)
    .map(tile);
  return { own: own.map(tile), other };
}

/** Problems without a unit (the user has not picked one yet). */
export function unfiled(pages: SavedPage[]): number {
  return pages.reduce((n, pg) => n + pg.problems.filter((p) => !p.unit).length, 0);
}
