import { app } from "../copy";
import { unitById } from "../curriculum";
import type { Mark } from "../reader/schema";
import { type MarkSource, markSourceOf } from "./marks";
import type { SavedPage, SavedProblem } from "./model";
import { type UnitLevel, nextStepLine, unitLevel } from "./ladder";
import { type Reason, reasonFor } from "./review";
import { type HistoryRow, shortDate, unitHistory } from "./territory";

/**
 * The unit sheet on the map = layer 3 (the unit's record) + layer 4 (its problems), so the student
 * never leaves the map. Pure: everything the sheet and the page viewer show comes from here.
 */

/** One problem of the unit, as the sheet lists it. */
export interface SheetProblem {
  /** `${pageId}-${index}` (stable React key, also the tick's address). */
  key: string;
  page: SavedPage;
  /** Index in page.problems (what setReviewed takes). */
  index: number;
  problem: SavedProblem;
  /** 「10/19」 and 「テスト」 of its page. */
  date: string;
  type: string;
  /** Final ○/✕ and where it came from (先生の印 / AI判定 / 保護者; "" when no mark). */
  mark: Mark;
  source: MarkSource;
  sourceLabel: string;
  /** On the テスト前リスト (✕, or low confidence without ○) → the 「復習した」 tick is shown. */
  reason: Reason | null;
}

export interface UnitSheet {
  /** Every page with the unit, newest first (date · page type · ✕/○ for this unit). */
  history: HistoryRow[];
  /** This unit's problems, newest page first, in page order within a page. */
  problems: SheetProblem[];
  /**
   * 念のため: for a gold (マスター) unit, its older ✕ / low-confidence problems: the same rule as the
   * テスト前リスト (splitTestList). Empty for every other unit.
   */
  nennotame: SheetProblem[];
  /** マスター or 定着 (Lv ≥ 3). */
  gold: boolean;
  /** The unit's step on the 5-step ladder, and the one line on what makes the next step. */
  ladder: UnitLevel;
  next: string;
}

/** 「先生の印」「AI判定」「保護者」, or "" when the problem has no mark. */
export function markSourceLabel(p: { mark: Mark; markSource?: MarkSource }): string {
  const s = markSourceOf(p);
  return p.mark && s ? app.map.sheet.source[s] : "";
}

/** Everything the unit sheet shows below its header. */
export function unitSheet(pages: SavedPage[], unitId: string, now: Date = new Date()): UnitSheet {
  const ladder = unitLevel(pages, unitId, now);
  const gold = ladder.level >= 3;
  const problems: SheetProblem[] = [];
  const nennotame: SheetProblem[] = [];
  // newest page first; a stable sort keeps page order on an exact tie
  const sorted = [...pages].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const page of sorted) {
    const date = shortDate(page.createdAt);
    const type = app.pageType[page.pageType] ?? app.pageType.other;
    page.problems.forEach((problem, index) => {
      if (problem.unit !== unitId) return;
      const reason = reasonFor(problem);
      const item: SheetProblem = {
        key: `${page.id}-${index}`,
        page,
        index,
        problem,
        date,
        type,
        mark: problem.mark,
        source: markSourceOf(problem),
        sourceLabel: markSourceLabel(problem),
        reason,
      };
      (gold && reason ? nennotame : problems).push(item);
    });
  }
  return { history: unitHistory(pages, unitId), problems, nennotame, gold, ladder, next: nextStepLine(ladder) };
}

/** One row under the photo in the page viewer. */
export interface ViewerRow {
  index: number;
  n: number;
  q: string;
  answer: string | null;
  mark: Mark;
  sourceLabel: string;
  correctAnswer: string | null;
  /** 「小5 割合」 (or 「単元なし」), and the topic alone. */
  unitLabel: string;
  topic: string | null;
  /** A problem of the unit whose sheet opened the viewer: highlighted. */
  inUnit: boolean;
}

export interface PageView {
  pageId: string;
  date: string;
  type: string;
  rows: ViewerRow[];
  /** How many rows are highlighted. */
  inUnit: number;
}

/** The page viewer: every problem of the page, this unit's problems marked. */
export function pageView(page: SavedPage, unitId: string | null): PageView {
  const rows = page.problems.map((p, index): ViewerRow => {
    const u = unitById(p.unit);
    return {
      index,
      n: p.n,
      q: p.q,
      answer: p.answer,
      mark: p.mark,
      sourceLabel: markSourceLabel(p),
      correctAnswer: p.correctAnswer ?? null,
      unitLabel: u ? `${u.appGrade} ${u.topic}` : app.map.viewer.noUnit,
      topic: u?.topic ?? null,
      inUnit: !!unitId && p.unit === unitId,
    };
  });
  return {
    pageId: page.id,
    date: shortDate(page.createdAt),
    type: app.pageType[page.pageType] ?? app.pageType.other,
    rows,
    inUnit: rows.filter((r) => r.inUnit).length,
  };
}
