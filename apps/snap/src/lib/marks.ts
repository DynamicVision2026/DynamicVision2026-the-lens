import { type Mark, type Problem } from "../reader/schema";
import type { SavedPage } from "./model";

/** Where a saved ○/✕ came from. */
export type MarkSource = "teacher" | "ai" | "parent" | null;
export const MARK_SOURCES = ["teacher", "ai", "parent"] as const;

/** Below this unit confidence the confirm screen asks the parent to check the unit. */
export const UNIT_CHECK_BELOW = 0.7;

/**
 * The ○/✕ used everywhere downstream (map, report, テスト前リスト):
 *   1. the teacher's red mark on the page, if there is one   → source "teacher"
 *   2. else the AI's own judgment of the student's answer     → source "ai"
 *   3. else no mark                                           → null
 */
export function finalMark(teacher: Mark, judge: Mark): { mark: Mark; markSource: MarkSource } {
  if (teacher) return { mark: teacher, markSource: "teacher" };
  if (judge) return { mark: judge, markSource: "ai" };
  return { mark: null, markSource: null };
}

/**
 * Source of a stored mark, back-compatible with pages saved before markSource existed
 * (and their backups): missing → "teacher" when a mark is set, else null.
 */
export function markSourceOf(p: { mark: Mark; markSource?: MarkSource }): MarkSource {
  if (p.markSource !== undefined) return p.markSource;
  return p.mark ? "teacher" : null;
}

/** Show the 「単元を確認してください」 pill: low unit confidence and the parent has not picked a unit yet. */
export function needsUnitCheck(p: Pick<Problem, "unitConfidence"> & { unitEdited?: boolean }): boolean {
  return !p.unitEdited && p.unitConfidence < UNIT_CHECK_BELOW;
}

/** A stored page with every problem's markSource filled in (old pages / backups: see markSourceOf). */
export function withMarkSources(page: SavedPage): SavedPage {
  if (page.problems.every((p) => p.markSource !== undefined)) return page;
  return { ...page, problems: page.problems.map((p) => ({ ...p, markSource: markSourceOf(p) })) };
}
