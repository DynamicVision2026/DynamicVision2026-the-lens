import type { Grade } from "../curriculum";
import type { Mark, PageResult } from "../reader/schema";

export interface SavedProblem {
  n: number;
  q: string;
  unit: string | null;
  answer: string | null;
  mark: Mark;
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
export type DraftProblem = Omit<SavedProblem, "reviewed"> & { edited?: boolean };

export function draftFromResult(r: PageResult): DraftProblem[] {
  return r.problems.map((p) => ({ ...p }));
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
    problems: draft.map(({ edited, ...p }, i) => ({
      ...p,
      n: i + 1,
      // A card the user corrected by hand counts as confirmed.
      confidence: edited ? 1 : p.confidence,
      reviewed: false,
    })),
  };
}
