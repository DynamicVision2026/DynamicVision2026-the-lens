import { GRADES, type Grade, type Unit, unitsForGrade } from "../curriculum";
import type { SavedPage } from "./model";
import { type LevelCounts, type LevelKey, zeroCounts } from "./ladder";
import { type Tile, mapTiles } from "./review";
import { rootPath } from "./starmap";

/**
 * 学習レポート: the parent's one-glance page. Pure computations only (no DOM), unit-tested.
 * Describes what happened (which units have ✕, which are all ○, which have no data); never a
 * score, a percentage of understanding, or a promise.
 */

/** Order of the segmented bar, left to right: the ladder from the top (定着) down to まだ. */
export const BAR_ORDER: LevelKey[] = ["settled", "master", "reviewed", "trying", "mada"];
/** Unit chip groups (まだ units are only counted, not listed). */
export const CHIP_ORDER = ["settled", "master", "trying", "reviewed"] as const;
export type ChipState = (typeof CHIP_ORDER)[number];

const MAX_NEXT = 3;
const MAX_EARLIER = 3;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface ReviewUnit {
  unit: Unit;
  /** ✕ problems not yet ticked 「復習した」 (what the テスト前リスト will show as open). */
  wrong: number;
}
export interface EarlierUnit extends ReviewUnit {
  /** The child's-grade unit this one is a root of (via the star chart's roots), when known. */
  supports: Unit | null;
}
export interface WeekCounts {
  pages: number;
  problems: number;
  wrong: number;
}
export interface Report {
  grade: Grade;
  pages: number;
  /** createdAt of the newest page, null when there are none. */
  lastAt: string | null;
  /** Units of the child's grade, and how many are on each step of the ladder. */
  total: number;
  counts: LevelCounts;
  next: ReviewUnit[];
  earlier: EarlierUnit[];
  /** Every red unit of an earlier grade (same order as `earlier`, not capped). */
  earlierIds: string[];
  week: WeekCounts;
  chips: Record<ChipState, Unit[]>;
}

/** Unreviewed ✕ per unit id. */
function openWrong(pages: SavedPage[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const pg of pages) for (const p of pg.problems) if (p.unit && p.mark === "✕" && !p.reviewed) m.set(p.unit, (m.get(p.unit) ?? 0) + 1);
  return m;
}

/** Units on each step among one grade's tiles. */
export function stateCounts(tiles: Tile[], grade: Grade): { total: number; counts: LevelCounts } {
  const counts = zeroCounts();
  let total = 0;
  for (const t of tiles)
    if (t.unit.appGrade === grade) {
      counts[t.key]++;
      total++;
    }
  return { total, counts };
}

/** 次にやること: red (挑戦中) units of the child's grade, most open ✕ first (ties: curriculum order), up to 3. */
export function nextToDo(tiles: Tile[], grade: Grade, wrong: Map<string, number>, max = MAX_NEXT): ReviewUnit[] {
  return tiles
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.unit.appGrade === grade && t.level === 1)
    .map(({ t, i }) => ({ unit: t.unit, wrong: wrong.get(t.unit.id) ?? 0, i }))
    .sort((a, b) => b.wrong - a.wrong || a.i - b.i)
    .slice(0, max)
    .map(({ unit, wrong: w }) => ({ unit, wrong: w }));
}

/**
 * 前の学年で気になる単元: red units of earlier grades, nearest grade first, then most open ✕,
 * up to 3. `supports` = a child's-grade unit whose root path (star chart roots, followed down
 * grade by grade) reaches it; a red one first, then one with data, then curriculum order.
 */
export function earlierRed(tiles: Tile[], grade: Grade, wrong: Map<string, number>, max = MAX_EARLIER): EarlierUnit[] {
  const gi = GRADES.indexOf(grade);
  const byId = new Map(tiles.map((t) => [t.unit.id, t]));
  const rank = (lv: number | undefined) => (lv === 1 ? 0 : !lv ? 2 : 1);
  const own = unitsForGrade(grade)
    .map((u, i) => ({ u, i, path: rootPath(u.id).units, r: rank(byId.get(u.id)?.level) }))
    .sort((a, b) => a.r - b.r || a.i - b.i);
  return tiles
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => GRADES.indexOf(t.unit.appGrade) < gi && t.level === 1)
    .map(({ t, i }) => ({ unit: t.unit, wrong: wrong.get(t.unit.id) ?? 0, i, g: GRADES.indexOf(t.unit.appGrade) }))
    .sort((a, b) => b.g - a.g || b.wrong - a.wrong || a.i - b.i)
    .slice(0, max)
    .map(({ unit, wrong: w }) => ({ unit, wrong: w, supports: own.find((o) => o.path.has(unit.id))?.u ?? null }));
}

/** この1週間: pages saved in the last 7 days (by createdAt), their problems and ✕. */
export function lastWeek(pages: SavedPage[], now: Date): WeekCounts {
  const since = now.getTime() - WEEK_MS;
  const out: WeekCounts = { pages: 0, problems: 0, wrong: 0 };
  for (const pg of pages) {
    const t = Date.parse(pg.createdAt);
    if (!(t >= since && t <= now.getTime())) continue;
    out.pages++;
    out.problems += pg.problems.length;
    out.wrong += pg.problems.filter((p) => p.mark === "✕").length;
  }
  return out;
}

export function buildReport(pages: SavedPage[], grade: Grade, now = new Date()): Report {
  const tiles = mapTiles(pages, now);
  const wrong = openWrong(pages);
  const { total, counts } = stateCounts(tiles, grade);
  const chips: Record<ChipState, Unit[]> = { settled: [], master: [], trying: [], reviewed: [] };
  for (const t of tiles) if (t.unit.appGrade === grade && t.key !== "mada") chips[t.key].push(t.unit);
  let lastAt: string | null = null;
  for (const pg of pages) if (lastAt === null || pg.createdAt > lastAt) lastAt = pg.createdAt;
  const earlierAll = earlierRed(tiles, grade, wrong, Infinity);
  return {
    grade,
    pages: pages.length,
    lastAt,
    total,
    counts,
    next: nextToDo(tiles, grade, wrong),
    earlier: earlierAll.slice(0, MAX_EARLIER),
    earlierIds: earlierAll.map((e) => e.unit.id),
    week: lastWeek(pages, now),
    chips,
  };
}

/** `/app/list?units=…` for a set of units (commas kept readable). */
export function listUrl(ids: string[]): string {
  return `/app/list?units=${ids.map(encodeURIComponent).join(",")}`;
}
