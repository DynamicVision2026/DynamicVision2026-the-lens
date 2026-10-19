import { type Grade, unitById } from "../curriculum";
import type { SavedPage } from "./model";
import { type Report, buildReport, listUrl } from "./report";
import { nearGrades } from "./starmap";

/**
 * The 単元マップ as the app home: routing, tabs, `?unit=` focus and the report strip's data.
 * Pure functions only (no DOM), unit-tested.
 */

/** `/app`: the map once the family has saved pages, 撮る before that. */
export function homePath(pageCount: number): "/app/map" | "/app/snap" {
  return pageCount > 0 ? "/app/map" : "/app/snap";
}

export type TabKey = "snap" | "map" | "list" | "archive";
/** The tab bar, left to right. The 学習レポート is the map's 「詳しく」 page, not a tab. */
export const APP_TABS: { key: TabKey; to: string }[] = [
  { key: "snap", to: "/app/snap" },
  { key: "map", to: "/app/map" },
  { key: "list", to: "/app/list" },
  { key: "archive", to: "/app/archive" },
];
/** Routes that light a tab other than their own: the report belongs to the map. */
export function activeTab(pathname: string): TabKey | null {
  if (pathname.startsWith("/app/report")) return "map";
  return APP_TABS.find((t) => pathname.startsWith(t.to))?.key ?? null;
}

/** `/app/map?unit=5-C3`: the map with that star selected (its sheet open). */
export function mapUnitUrl(id: string): string {
  return `/app/map?unit=${encodeURIComponent(id)}`;
}

/**
 * Star to select on arrival from `?unit=`, and the far band to open for it (null when the
 * unit is unknown, or already in the near sky).
 */
export function focusFromParam(param: string | null | undefined, grade: Grade): { selected: string | null; opened: Grade | null } {
  const u = param ? unitById(param.trim()) : undefined;
  if (!u) return { selected: null, opened: null };
  return { selected: u.id, opened: nearGrades(grade).has(u.appGrade) ? null : u.appGrade };
}

/** The far band to open for the earlier-grade ✕ units: the nearest one that is not near already. */
export function earlierBand(ids: string[], grade: Grade): Grade | null {
  const near = nearGrades(grade);
  for (const id of ids) {
    const g = unitById(id)?.appGrade;
    if (g && !near.has(g)) return g;
  }
  return null;
}

export interface Strip {
  grade: Grade;
  total: number;
  counts: Report["counts"];
  next: Report["next"];
  /** `/app/list?units=…` for the 次にやること units (same link as the report's button). */
  nextList: string | null;
  /** Every red unit of an earlier grade, nearest grade first. */
  earlier: string[];
}

/** The report strip on the map: exactly the 学習レポート's numbers, nothing of its own. */
export function stripFromReport(r: Report): Strip {
  return {
    grade: r.grade,
    total: r.total,
    counts: r.counts,
    next: r.next,
    nextList: r.next.length > 0 ? listUrl(r.next.map((n) => n.unit.id)) : null,
    earlier: r.earlierIds,
  };
}

export function buildStrip(pages: SavedPage[], grade: Grade, now = new Date()): Strip {
  return stripFromReport(buildReport(pages, grade, now));
}
