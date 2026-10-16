// Access (WO-024): a soft lock with no server and no account. The order email's link
// /open?p=<pass>&k=<key> unlocks that Pass on this device (localStorage lens.v1.unlock.<pass>); if
// storage is blocked, it stays unlocked in memory for this visit. ?preview=1 (dev and Architect review)
// opens every Pass for the tab. The free 3-minute check is always open. §3a: a 3-day trial of each Pass's
// first lesson (below). WO-027: a book QR opens that lens's masterclass (below).
import { loadBundle } from '@lens/scenes';
import { LAUNCH } from '../launch.config';

const PREVIEW = 'lens.v1.preview';
const unlockKey = (passId: string) => `lens.v1.unlock.${passId}`;
/** Unlocks that could not be stored (private mode, blocked storage): good for this visit. */
const memory = new Set<string>();

/** ?preview=1 seen in this tab (dev and Architect review). */
export function previewOn(search: string = window.location.search): boolean {
  try {
    if (new URLSearchParams(search).get('preview') === '1') window.sessionStorage.setItem(PREVIEW, '1');
    return window.sessionStorage.getItem(PREVIEW) === '1';
  } catch {
    return new URLSearchParams(search).get('preview') === '1';
  }
}

/** This Pass was unlocked on this device (an access link). */
export function unlocked(passId: string): boolean {
  if (memory.has(passId)) return true;
  try {
    return window.localStorage.getItem(unlockKey(passId)) === '1';
  } catch {
    return false;
  }
}

/** The access link: unlocks only the Pass whose key matches. Returns whether it did. */
export function openWithKey(passId: string | null, key: string | null): boolean {
  const pass = passId ? LAUNCH.passes[passId] : undefined;
  if (!pass || !key || key !== pass.key) return false;
  memory.add(passId!);
  try {
    window.localStorage.setItem(unlockKey(passId!), '1');
  } catch {
    // Storage blocked: the memory copy keeps it open for this visit.
  }
  return true;
}

/** Lessons of one Pass: open once unlocked on this device, or with preview. */
export function passOpen(passId: string, search: string = window.location.search): boolean {
  return unlocked(passId) || previewOn(search);
}

// ---- WO-024 §3a: the free trial. A Pass's first lesson (masterclass and practice) is open for 3 days
// on this device, no sign-up: lens.v1.trial.<pass> = <ISO start>, set once. Storage blocked: for this
// visit only. A paid (unlocked) Pass ignores the trial.

export const TRIAL_MS = 72 * 60 * 60 * 1000;
const trialKey = (passId: string) => `lens.v1.trial.${passId}`;
const trialMemory = new Map<string, string>();

/** The lesson a Pass's trial opens: its first lesson (chugaku/koukou 囲む, daigaku てんびん). */
export function trialLens(passId: string): string | null {
  return loadBundle().passes?.find((p) => p.id === passId)?.lessons[0]?.lens ?? null;
}

function trialStart(passId: string): string | null {
  try {
    const v = window.localStorage.getItem(trialKey(passId));
    if (v) return v;
  } catch {
    // Storage blocked: the memory copy below.
  }
  return trialMemory.get(passId) ?? null;
}

/** 「無料ではじめる」: start the trial for this Pass, unless it already started (never restarts it). Returns whether it started now. */
export function startTrial(passId: string, now: Date = new Date()): boolean {
  if (!LAUNCH.passes[passId] || trialStart(passId)) return false;
  const iso = now.toISOString();
  trialMemory.set(passId, iso);
  try {
    window.localStorage.setItem(trialKey(passId), iso);
  } catch {
    // Storage blocked: the trial works for this visit only.
  }
  return true;
}

export type TrialState = { status: 'none' } | { status: 'active'; msLeft: number } | { status: 'ended' };

export function trialState(passId: string, now: number = Date.now()): TrialState {
  const start = trialStart(passId);
  if (!start) return { status: 'none' };
  const t = Date.parse(start);
  if (Number.isNaN(t)) return { status: 'none' };
  const left = t + TRIAL_MS - now;
  return left > 0 ? { status: 'active', msLeft: left } : { status: 'ended' };
}

/** One lesson of a Pass: the whole Pass when bought (or previewed); else its first lesson during the trial. */
export function lessonOpen(passId: string, lens: string, search: string = window.location.search, now: number = Date.now()): boolean {
  if (passOpen(passId, search)) return true;
  return lens === trialLens(passId) && trialState(passId, now).status === 'active';
}

// ---- WO-027: book readers. Each chapter's QR (/lesson/<pass>/<lens>?src=book) opens that lens's masterclass
// (Step 1) for free, remembered on the device: lens.v1.book.<pass> = the lenses opened this way. Storage
// blocked: for this visit only. Steps 2–4, the report and the mixed review stay paid (or the trial lens).

const bookKey = (passId: string) => `lens.v1.book.${passId}`;
const bookMemory = new Map<string, Set<string>>();

/** The visit came from a book QR code (?src=book). */
export function fromBook(search: string = window.location.search): boolean {
  return new URLSearchParams(search).get('src') === 'book';
}

/** The lenses of this Pass opened from the book on this device. */
export function bookLenses(passId: string): string[] {
  const out = new Set(bookMemory.get(passId) ?? []);
  try {
    const v = JSON.parse(window.localStorage.getItem(bookKey(passId)) ?? '[]');
    if (Array.isArray(v)) for (const l of v) if (typeof l === 'string') out.add(l);
  } catch {
    // Storage blocked or unreadable: the memory copy only.
  }
  return [...out];
}

/** The Pass has a lesson for this lens. */
export function passLesson(passId: string, lens: string): boolean {
  return !!loadBundle().passes?.find((p) => p.id === passId)?.lessons.some((l) => l.lens === lens);
}

/** A book QR visit: remember this lens's masterclass as open. Returns whether it was new on this device. */
export function openFromBook(passId: string, lens: string): boolean {
  if (!passLesson(passId, lens)) return false;
  const known = bookLenses(passId);
  if (known.includes(lens)) return false;
  const next = [...known, lens];
  bookMemory.set(passId, new Set(next));
  try {
    window.localStorage.setItem(bookKey(passId), JSON.stringify(next));
  } catch {
    // Storage blocked: open for this visit only.
  }
  return true;
}

/** This lens's masterclass was opened from the book on this device. */
export function bookOpen(passId: string, lens: string): boolean {
  return bookLenses(passId).includes(lens);
}

/** Someone who came to this Pass from its book (shown the 「この本の続きの練習…」 line when locked). */
export function bookReader(passId: string): boolean {
  return bookLenses(passId).length > 0;
}

/** Step 1 (the masterclass) of a lesson: whatever opens the lesson, or the book. */
export function masterclassOpen(passId: string, lens: string, search: string = window.location.search, now: number = Date.now()): boolean {
  return lessonOpen(passId, lens, search, now) || bookOpen(passId, lens);
}

export type AccessMode = 'paid' | 'preview' | 'trial' | 'book';

/** WO-025/027: how an open lesson was opened, for analytics: bought, previewed, the free trial, or the book. */
export function accessMode(passId: string, lens?: string, search: string = window.location.search, now: number = Date.now()): AccessMode {
  if (unlocked(passId)) return 'paid';
  if (previewOn(search)) return 'preview';
  if (lens && lens === trialLens(passId) && trialState(passId, now).status === 'active') return 'trial';
  if (lens && bookOpen(passId, lens)) return 'book';
  return 'trial';
}

/** For tests: forget the in-memory unlocks and trials. */
export function resetAccessMemory() {
  memory.clear();
  trialMemory.clear();
  bookMemory.clear();
}
