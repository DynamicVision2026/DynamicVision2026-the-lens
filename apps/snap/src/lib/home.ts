import { app } from "../copy";
import { type Grade, unitById } from "../curriculum";
import type { SavedPage } from "./model";
import { type Report, buildReport, listUrl } from "./report";

/**
 * The 単元マップ as the app home: routing, tabs, `?unit=` focus and the HUD's 次にやること data.
 * Pure functions only (no DOM), unit-tested.
 */

/**
 * `/app` (after the 招待コード and the grade): always the 単元マップ, also before any page is saved
 * (the empty map shows the grade's sky and a welcome card that leads to 撮る).
 */
export function homePath(): "/app/map" {
  return "/app/map";
}

export type TabKey = "snap" | "map" | "list" | "archive";
/** The tab bar, left to right: マップ first. The 学習レポート is the map's 「詳しく」 page, not a tab. */
export const APP_TABS: { key: TabKey; to: string }[] = [
  { key: "map", to: "/app/map" },
  { key: "snap", to: "/app/snap" },
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

/** Unit to open on arrival from `?unit=` (null when the unit is unknown). */
export function focusFromParam(param: string | null | undefined, _grade?: Grade): { selected: string | null } {
  const u = param ? unitById(param.trim()) : undefined;
  return { selected: u ? u.id : null };
}

/** Units in the map's 次にやること (the HUD badge and its one-by-one tour). */
export const STRIP_NEXT = 3;

export interface Strip {
  grade: Grade;
  total: number;
  counts: Report["counts"];
  /**
   * 次にやること: the report's red units of the child's grade, then (while there is room) its
   * earlier-grade red units, nearest grade first, so a ✕ just saved from an older sheet shows up.
   */
  next: Report["next"];
  /** `/app/list?units=…` for the 次にやること units (same link as the report's button). */
  nextList: string | null;
  /** Every red unit of an earlier grade, nearest grade first. */
  earlier: string[];
}

/**
 * The map's 学習レポート numbers (HUD), nothing of its own (次にやること = the
 * report's 次にやること, topped up from its 前の学年で気になる単元).
 */
export function stripFromReport(r: Report): Strip {
  const room = Math.max(0, STRIP_NEXT - r.next.length);
  const next = [...r.next.slice(0, STRIP_NEXT), ...r.earlier.slice(0, room).map((e) => ({ unit: e.unit, wrong: e.wrong }))];
  return {
    grade: r.grade,
    total: r.total,
    counts: r.counts,
    next,
    nextList: next.length > 0 ? listUrl(next.map((n) => n.unit.id)) : null,
    earlier: r.earlierIds,
  };
}

export function buildStrip(pages: SavedPage[], grade: Grade, now = new Date()): Strip {
  return stripFromReport(buildReport(pages, grade, now));
}

/** ✕ units named in the save toast; more are summed up as 「ほか」. */
export const TOAST_TOPICS = 3;

/**
 * The toast right after 保存, saying what changed:
 * 「4問を保存しました：✕ 2問（平均、数量の関係を表す式）・○ 2問」.
 * ✕ units in page order (each once); problems without a mark are counted as 印なし.
 */
export function savedToast(page: Pick<SavedPage, "problems">): string {
  const t = app.map.saved;
  const ps = page.problems;
  const wrong = ps.filter((p) => p.mark === "✕");
  const ok = ps.filter((p) => p.mark === "○").length;
  const none = ps.length - wrong.length - ok;
  const topics: string[] = [];
  for (const p of wrong) {
    const topic = unitById(p.unit)?.topic;
    if (topic && !topics.includes(topic)) topics.push(topic);
  }
  const shown = topics.slice(0, TOAST_TOPICS);
  const parts: string[] = [];
  if (wrong.length > 0) parts.push(t.wrong(wrong.length, shown, topics.length > shown.length));
  if (ok > 0) parts.push(t.ok(ok));
  if (none > 0 && parts.length > 0) parts.push(t.none(none));
  return parts.length > 0 ? `${t.head(ps.length)}：${parts.join("・")}` : `${t.head(ps.length)}。`;
}
