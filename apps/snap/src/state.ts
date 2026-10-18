import { useCallback, useEffect, useState } from "react";
import { type Grade, isGrade } from "./curriculum";
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

export function useGrade(): [Grade | null, (g: Grade) => void] {
  const [grade, setGrade] = useState<Grade | null>(() => {
    const g = readPref("grade");
    return isGrade(g) ? g : null;
  });
  const set = useCallback((g: Grade) => {
    writePref("grade", g);
    setGrade(g);
  }, []);
  return [grade, set];
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
