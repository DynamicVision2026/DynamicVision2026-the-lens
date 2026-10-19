import { GRADES, type Grade, unitsForGrade } from "../curriculum";
import type { SavedPage } from "./model";
import { mapTiles } from "./review";

/**
 * 年度の記録: one row per school year (April–March, device time) from the pages on this device.
 * The grade of a past year = the profile grade minus the years back (a 小5 child's 2025年度 = 小4).
 * Per row: that year's zone, 制覇 N/M of that grade's units from that year's pages only, and the
 * ✕ saved that year (all units). The current year is always listed. Accounts / sync come in v1.
 */
export interface YearRow {
  /** School year (2026 = 2026年4月〜2027年3月). */
  year: number;
  grade: Grade;
  pages: number;
  taken: number;
  total: number;
  wrong: number;
}

/** School year of a date: April starts the year. */
export function schoolYearOf(d: Date): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

export function yearlyRecord(pages: SavedPage[], grade: Grade, now = new Date()): YearRow[] {
  const current = schoolYearOf(now);
  const gi = GRADES.indexOf(grade);
  const byYear = new Map<number, SavedPage[]>([[current, []]]);
  for (const pg of pages) {
    const d = new Date(pg.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const y = Math.min(current, schoolYearOf(d)); // a clock ahead of the device counts as this year
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(pg);
  }
  const rows: YearRow[] = [];
  for (const [year, ps] of byYear) {
    const back = current - year;
    if (gi - back < 0) continue; // before 小1: no zone to show
    const g = GRADES[gi - back];
    const ids = new Set(unitsForGrade(g).map((u) => u.id));
    const tiles = mapTiles(ps).filter((t) => ids.has(t.unit.id));
    rows.push({
      year,
      grade: g,
      pages: ps.length,
      taken: tiles.filter((t) => t.status !== "empty").length,
      total: tiles.length,
      wrong: ps.reduce((s, pg) => s + pg.problems.filter((p) => p.mark === "✕").length, 0),
    });
  }
  return rows.sort((a, b) => b.year - a.year);
}
