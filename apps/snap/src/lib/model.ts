import type { Grade } from "../curriculum";
import type { Mark, PageResult } from "../reader/schema";
import { type MarkSource, finalMark } from "./marks";

export interface SavedProblem {
  n: number;
  q: string;
  unit: string | null;
  answer: string | null;
  /** Final ○/✕ (teacher's mark, else the AI's judgment, or the parent's choice). */
  mark: Mark;
  /** Where `mark` came from. Missing on pages saved before 19 Oct 2026 → read with markSourceOf(). */
  markSource?: MarkSource;
  /** The AI's computed answer, when it had one. */
  correctAnswer?: string | null;
  confidence: number;
  reviewed: boolean;
}

export interface SavedPage {
  id: string;
  createdAt: string; // ISO
  grade: Grade;
  pageType: PageResult["pageType"];
  score: string | null;
  /** Downscaled page photo kept on this device only. */
  photo?: { bytes: ArrayBuffer; mime: string };
  problems: SavedProblem[];
}

/** Draft shown on the confirm screen (editable copy of the reader's result). */
export type DraftProblem = Omit<SavedProblem, "reviewed" | "markSource" | "correctAnswer"> & {
  markSource: MarkSource;
  correctAnswer: string | null;
  unitConfidence: number;
  unitAlt: string | null;
  edited?: boolean;
  /** The parent picked the unit by hand (hides 「単元を確認してください」). */
  unitEdited?: boolean;
};

export function draftFromResult(r: PageResult): DraftProblem[] {
  return r.problems.map((p) => ({
    n: p.n,
    q: p.q,
    unit: p.unit,
    answer: p.answer,
    ...finalMark(p.mark, p.judge),
    correctAnswer: p.correctAnswer,
    confidence: p.confidence,
    unitConfidence: p.unitConfidence,
    unitAlt: p.unitAlt,
  }));
}

/** The parent tapped ○ / ✕ / なし on the confirm screen. */
export function withParentMark(p: DraftProblem, mark: Mark): DraftProblem {
  return { ...p, mark, markSource: "parent", edited: true };
}

export function pageFromDraft(
  draft: DraftProblem[],
  meta: { grade: Grade; pageType: SavedPage["pageType"]; score: string | null; photo?: SavedPage["photo"] },
  now = new Date(),
): SavedPage {
  return {
    id: `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now.toISOString(),
    grade: meta.grade,
    pageType: meta.pageType,
    score: meta.score,
    photo: meta.photo,
    problems: draft.map(({ edited, unitEdited, unitConfidence, unitAlt, ...p }, i) => ({
      ...p,
      n: i + 1,
      // A card the user corrected by hand counts as confirmed.
      confidence: edited ? 1 : p.confidence,
      reviewed: false,
    })),
  };
}
