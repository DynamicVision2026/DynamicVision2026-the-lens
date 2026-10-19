import { app } from "../copy";
import type { SavedPage } from "./model";

/**
 * 5-step mastery ladder (founder decision, 19 Oct 2026). Decided from the student's own saved pages only;
 * a problem's mark is its final mark (先生の印, else AI判定, else 保護者; lib/marks.ts), so all three count.
 * A problem without a mark (null) is neither ○ nor ✕.
 *
 *   Lv0 まだ     — no problems in this unit.
 *   Lv1 挑戦中   — has a ✕ not yet ticked 「復習した」.
 *   Lv2 復習ずみ — has data, every ✕ reviewed, not Lv3.
 *   Lv3 マスター — the newest page with this unit has ≥ 1 problem there and all of them are ○.
 *   Lv4 定着     — Lv3, and an earlier page whose problems in this unit were all ○ (≥ 1) is dated at least
 *                  RETENTION_DAYS calendar days before the newest page, with no page holding a ✕ for this
 *                  unit in between: correct again ≥ 2 weeks after first mastering it.
 *
 * Checked in the order 定着 > マスター > 挑戦中 > 復習ずみ > まだ, so a later all-○ page makes a unit
 * マスター even when older ✕ are still unreviewed (those stay in 念のため).
 * Pages are ordered by createdAt; on an exact tie the page earlier in the list counts as the newer one
 * (same as before v0.11). Days are local calendar days (device time).
 */

/** Days between the first all-○ page and a later all-○ page for 定着 (calendar days, device time). */
export const RETENTION_DAYS = 14;

export type Level = 0 | 1 | 2 | 3 | 4;
export const LEVEL_KEYS = ["mada", "trying", "reviewed", "master", "settled"] as const;
export type LevelKey = (typeof LEVEL_KEYS)[number];
/** Highest first: the order of every count line (「定着 1 ・ マスター 2 ・ 挑戦中 1」). */
export const LEVELS_DESC: Level[] = [4, 3, 2, 1, 0];

export const keyOf = (level: Level): LevelKey => LEVEL_KEYS[level];
export const levelOfKey = (key: LevelKey): Level => LEVEL_KEYS.indexOf(key) as Level;
export const levelName = (level: Level): string => app.ladder.names[keyOf(level)];

/** Why a unit is on its step (what the sheet's next-step line and the tests read). */
export interface LevelReasons {
  /** Problems in this unit, ✕ among them, and ✕ not yet ticked 「復習した」. */
  count: number;
  wrong: number;
  pending: number;
  /** createdAt of the newest page with this unit, and whether all its problems there were ○. */
  latestAt: string | null;
  latestAllOk: boolean;
  /**
   * The earliest all-○ page of the current run (back from the newest page, up to the first page with a ✕
   * for this unit): when the unit was first mastered this time. null below Lv3.
   */
  masteredAt: string | null;
  /** The local day (YYYY-MM-DD) from which another all-○ page makes it 定着 (masteredAt + 14). null below Lv3. */
  settleDay: string | null;
  /** Calendar days from now to settleDay (0 when it has come). null below Lv3. */
  daysLeft: number | null;
}

export interface UnitLevel {
  level: Level;
  key: LevelKey;
  name: string;
  reasons: LevelReasons;
}

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Local midnight of an ISO time (NaN when unreadable). */
function dayStart(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NaN;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
/** Calendar days from a to b (local time); DST-safe by rounding. */
export function calendarDays(aIso: string, bIso: string): number {
  return Math.round((dayStart(bIso) - dayStart(aIso)) / 86_400_000);
}

interface PageMarks {
  at: string;
  count: number;
  allOk: boolean;
  hasX: boolean;
}

/** The pages with problems in each unit (unit → pages, newest first; ties keep list order). */
function marksByUnit(pages: SavedPage[]): Map<string, { pages: PageMarks[]; count: number; wrong: number; pending: number }> {
  const out = new Map<string, { pages: PageMarks[]; count: number; wrong: number; pending: number }>();
  for (const page of pages) {
    const per = new Map<string, PageMarks>();
    for (const p of page.problems) {
      if (!p.unit) continue;
      const u = out.get(p.unit) ?? { pages: [], count: 0, wrong: 0, pending: 0 };
      out.set(p.unit, u);
      u.count++;
      if (p.mark === "✕") {
        u.wrong++;
        if (!p.reviewed) u.pending++;
      }
      const m = per.get(p.unit) ?? { at: page.createdAt, count: 0, allOk: true, hasX: false };
      m.count++;
      m.allOk = m.allOk && p.mark === "○";
      m.hasX = m.hasX || p.mark === "✕";
      per.set(p.unit, m);
    }
    for (const [unit, m] of per) out.get(unit)!.pages.push(m);
  }
  // newest first; Array.prototype.sort is stable, so on an exact tie the page earlier in the list stays first
  for (const u of out.values()) u.pages.sort((a, b) => b.at.localeCompare(a.at));
  return out;
}

function levelFrom(u: { pages: PageMarks[]; count: number; wrong: number; pending: number } | undefined, now: Date): UnitLevel {
  const reasons: LevelReasons = {
    count: u?.count ?? 0,
    wrong: u?.wrong ?? 0,
    pending: u?.pending ?? 0,
    latestAt: u?.pages[0]?.at ?? null,
    latestAllOk: !!u?.pages[0]?.allOk,
    masteredAt: null,
    settleDay: null,
    daysLeft: null,
  };
  let level: Level;
  if (!u || u.count === 0) level = 0;
  else if (reasons.latestAllOk) {
    const newest = u.pages[0];
    // back from the newest page through the run without a ✕ page: its all-○ pages
    let first = newest;
    let settled = false;
    for (const pg of u.pages.slice(1)) {
      if (pg.hasX) break;
      if (!pg.allOk) continue;
      first = pg;
      if (calendarDays(pg.at, newest.at) >= RETENTION_DAYS) settled = true;
    }
    level = settled ? 4 : 3;
    reasons.masteredAt = first.at;
    const start = new Date(dayStart(first.at));
    if (!Number.isNaN(start.getTime())) {
      start.setDate(start.getDate() + RETENTION_DAYS);
      reasons.settleDay = localDay(start);
      reasons.daysLeft = Math.max(0, calendarDays(localDay(now) + "T12:00:00", reasons.settleDay + "T12:00:00"));
    }
  } else level = u.pending > 0 ? 1 : 2;
  return { level, key: keyOf(level), name: levelName(level), reasons };
}

/** The ladder step of one unit. `now` only feeds the 定着 countdown (daysLeft), never the level itself. */
export function unitLevel(pages: SavedPage[], unitId: string, now: Date = new Date()): UnitLevel {
  return levelFrom(marksByUnit(pages).get(unitId), now);
}

/** Every unit that has problems → its step (one pass over the pages; units without data are まだ). */
export function unitLevels(pages: SavedPage[], now: Date = new Date()): Map<string, UnitLevel> {
  const out = new Map<string, UnitLevel>();
  for (const [id, u] of marksByUnit(pages)) out.set(id, levelFrom(u, now));
  return out;
}

export const MADA: UnitLevel = levelFrom(undefined, new Date(0));

export type LevelCounts = Record<LevelKey, number>;
export const zeroCounts = (): LevelCounts => ({ mada: 0, trying: 0, reviewed: 0, master: 0, settled: 0 });

/** 「定着 1 ・ マスター 2 ・ 挑戦中 1」: steps with units, highest first; まだ left out unless asked. */
export function countsLine(counts: LevelCounts, withMada = false): string {
  return LEVELS_DESC.filter((l) => (withMada || l > 0) && counts[keyOf(l)] > 0)
    .map((l) => app.ladder.count(levelName(l), counts[keyOf(l)]))
    .join(app.ladder.sep);
}

/** The sheet's one line under the ladder bar: what makes the next step. */
export function nextStepLine(u: UnitLevel): string {
  const n = app.ladder.next;
  switch (u.level) {
    case 0:
      return n.mada;
    case 1:
      return n.trying;
    case 2:
      return n.reviewed;
    case 3: {
      const d = u.reasons.settleDay;
      if (!d || u.reasons.daysLeft === 0) return n.masterNow;
      const [, m, day] = d.split("-").map(Number);
      return n.master(`${m}/${day}`);
    }
    case 4:
      return n.settled;
  }
}
