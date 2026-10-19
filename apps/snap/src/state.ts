import { useCallback, useEffect, useState } from "react";
import { type Grade, gradeFromPref } from "./curriculum";
import type { SavedPage } from "./lib/model";
import { allPages } from "./lib/store";

/** Small per-device preferences (localStorage, wrapped: it can throw in private mode). */
export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(`lens-snap:${key}`);
  } catch {
    return null;
  }
}
export function writePref(key: string, value: string) {
  try {
    localStorage.setItem(`lens-snap:${key}`, value);
  } catch {
    /* ignore */
  }
}

/** Set when a legacy grade (高校) was migrated (→ 高1): the grade badge asks the parent to check it. */
export const GRADE_CHECK_PREF = "grade-check";

/** Read the saved grade; a legacy 「高校」 is rewritten as 高1 and flagged for a check. */
export function loadGrade(): Grade | null {
  const raw = readPref("grade");
  const { grade, migrated } = gradeFromPref(raw);
  if (grade && migrated) {
    writePref("grade", grade);
    writePref(GRADE_CHECK_PREF, "1");
  }
  return grade;
}

export function clearPref(key: string) {
  try {
    localStorage.removeItem(`lens-snap:${key}`);
  } catch {
    /* ignore */
  }
}

/** [grade, set grade, show the 「学年を確認してください」 note, dismiss the note]. */
export function useGrade(): [Grade | null, (g: Grade) => void, boolean, () => void] {
  const [grade, setGrade] = useState<Grade | null>(loadGrade);
  const [check, setCheck] = useState(() => readPref(GRADE_CHECK_PREF) === "1");
  const dismiss = useCallback(() => {
    clearPref(GRADE_CHECK_PREF);
    setCheck(false);
  }, []);
  const set = useCallback(
    (g: Grade) => {
      writePref("grade", g);
      setGrade(g);
      dismiss(); // the parent chose a grade: nothing left to check
    },
    [dismiss],
  );
  return [grade, set, check, dismiss];
}

export function usePages(): {
  pages: SavedPage[] | null;
  reload: () => Promise<void>;
  setPages: (p: SavedPage[]) => void;
} {
  const [pages, setPages] = useState<SavedPage[] | null>(null);
  const reload = useCallback(async () => {
    try {
      setPages(await allPages());
    } catch {
      setPages([]);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { pages, reload, setPages };
}
