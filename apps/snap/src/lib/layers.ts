/**
 * Layers over the map, kept in the browser history so the back button (and iPhone swipe-back)
 * peel them off in order: page viewer → unit sheet → (nothing left: the browser's own back).
 * テスト前モード is one more layer: its steps (date → range → plan) replace each other in one entry, the
 * page viewer and the parent summary (share) sit on top of the plan, so one back from any step leaves
 * the mode and the map is back as it was.
 *
 * Each layer we open is one history entry on the same URL (location.state); switching the unit in an
 * open sheet replaces the entry, so one back always closes the sheet. `d` counts the entries we pushed
 * on top of the map's own entry: closing a layer goes back only when d > 0, so the map never leaves
 * the screen because of a ✕ or Esc.
 */

export interface Layers {
  /** Unit id whose sheet is open. */
  sheet: string | null;
  /** Page id open in the full-screen viewer (over the sheet). */
  viewer: string | null;
  /** 年度の記録 sheet. */
  years: boolean;
  /** テスト前モード: which step is on screen (null = the mode is off). */
  exam: ExamStep | null;
  /** The parent summary over the plan. */
  share: boolean;
  /** How many of our entries sit on top of the map's own entry. */
  d: number;
}

export const EXAM_STEPS = ["date", "range", "plan"] as const;
export type ExamStep = (typeof EXAM_STEPS)[number];

export const NO_LAYERS: Layers = { sheet: null, viewer: null, years: false, exam: null, share: false, d: 0 };

/** What history.state / location.state holds for a layer entry. */
export type LayerState = { snap: Layers };

/**
 * The テスト前 tab's entry state (`/app/exam`): the plan, which falls back to the date step when no
 * test is set. d = 0, so closing the mode replaces the entry and the screen moves to the map.
 */
export const EXAM_ENTRY: LayerState = { snap: { ...NO_LAYERS, exam: "plan" } };

/** Layers from a history entry's state (anything else → none open). */
export function layersOf(state: unknown): Layers {
  const s = (state as { snap?: Partial<Layers> } | null)?.snap;
  if (!s || typeof s !== "object") return NO_LAYERS;
  const sheet = typeof s.sheet === "string" ? s.sheet : null;
  const years = !sheet && s.years === true;
  const exam = !sheet && !years && EXAM_STEPS.includes(s.exam as ExamStep) ? (s.exam as ExamStep) : null;
  const share = exam === "plan" && s.share === true;
  const viewer = (sheet || exam === "plan") && !share && typeof s.viewer === "string" ? s.viewer : null;
  const d = typeof s.d === "number" && s.d > 0 ? Math.floor(s.d) : 0;
  return { sheet, viewer, years, exam, share, d };
}

export type NavStep = { kind: "push" | "replace"; state: LayerState } | { kind: "back" };

const push = (l: Layers): NavStep => ({ kind: "push", state: { snap: l } });
const replace = (l: Layers): NavStep => ({ kind: "replace", state: { snap: l } });
const anyOpen = (l: Layers) => !!l.sheet || l.years || !!l.viewer || !!l.exam;

/** Open a unit's sheet: a new entry from the bare map, the same entry when a sheet (or 年度) is open. */
export function openSheet(cur: Layers, unitId: string): NavStep {
  if (cur.sheet || cur.years || cur.exam) return replace({ ...NO_LAYERS, sheet: unitId, d: cur.d });
  return push({ ...NO_LAYERS, sheet: unitId, d: cur.d + 1 });
}

/** Open the page viewer over the open sheet. */
export function openViewer(cur: Layers, pageId: string): NavStep {
  if (cur.viewer) return replace({ ...cur, viewer: pageId });
  return push({ ...cur, viewer: pageId, d: cur.d + 1 });
}

/** Open 年度の記録 (replaces an open unit sheet). */
export function openYears(cur: Layers): NavStep {
  if (cur.sheet || cur.years || cur.exam) return replace({ ...NO_LAYERS, years: true, d: cur.d });
  return push({ ...NO_LAYERS, years: true, d: cur.d + 1 });
}

/**
 * テスト前モード: entering it from the map pushes one entry; moving between its steps (date → range →
 * plan, or back to range from the plan) replaces that entry, so one back always leaves the mode.
 */
export function openExam(cur: Layers, step: ExamStep): NavStep {
  if (cur.exam || cur.sheet || cur.years) return replace({ ...NO_LAYERS, exam: step, d: cur.d });
  return push({ ...NO_LAYERS, exam: step, d: cur.d + 1 });
}

/** The parent summary over the plan (its own entry: back returns to the plan). */
export function openShare(cur: Layers): NavStep | null {
  if (cur.exam !== "plan") return null;
  if (cur.share) return null;
  return push({ ...cur, viewer: null, share: true, d: cur.d + 1 });
}

/**
 * Close the top layer (✕, Esc, a tap on the map): back when the entry is ours, otherwise rewrite it
 * in place. Null when nothing is open (never leaves the map).
 */
export function closeTop(cur: Layers): NavStep | null {
  if (!anyOpen(cur)) return null;
  if (cur.d > 0) return { kind: "back" };
  if (cur.viewer) return replace({ ...cur, viewer: null });
  if (cur.share) return replace({ ...cur, share: false });
  return replace(NO_LAYERS);
}

/** `?unit=5-C3` on arrival (from the 学習レポート): its sheet as its own entry, so back closes it first. */
export function arrivalStep(cur: Layers, unitId: string | null): NavStep | null {
  if (!unitId || anyOpen(cur)) return null;
  return openSheet(cur, unitId);
}

/**
 * The map camera when the sheet opens / closes: remember the view when a sheet appears, fly back to
 * it when the sheet goes (unless the student moved the map meanwhile). The viewer sits over the sheet
 * and never moves the camera; switching units inside the sheet keeps the remembered view.
 */
export function cameraStep(wasOpen: boolean, isOpen: boolean, movedByHand: boolean): "save" | "restore" | "keep" {
  if (!wasOpen && isOpen) return "save";
  if (wasOpen && !isOpen) return movedByHand ? "keep" : "restore";
  return "keep";
}

/** Whether the unit sheet is on screen (the viewer over it does not count as closing it). */
export const sheetShown = (l: Layers) => !!l.sheet;
