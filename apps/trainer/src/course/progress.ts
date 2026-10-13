// Course progress and first-time onboarding, on this device only. Never throws (private windows).
import { emptyMastery, type Mastery, type TimedRun } from './practice';
const SOLVED_KEY = 'lens.v1.course';
const ONBOARD_KEY = 'lens.v1.onboard';
const MASTERY_KEY = 'lens.v1.mastery';
const TIMED_KEY = 'lens.v1.timed';
/** Timed runs kept per lesson (the latest first). */
const TIMED_KEEP = 10;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: progress lasts for this visit only.
  }
}

/** Solved problem ids per `${passId}:${lens}`. */
export function solvedIn(passId: string, lens: string): string[] {
  return read<Record<string, string[]>>(SOLVED_KEY, {})[`${passId}:${lens}`] ?? [];
}

export function markSolved(passId: string, lens: string, problemId: string) {
  const all = read<Record<string, string[]>>(SOLVED_KEY, {});
  const key = `${passId}:${lens}`;
  all[key] = [...new Set([...(all[key] ?? []), problemId])];
  write(SOLVED_KEY, all);
}

/** True the first time a lens's interaction phase is seen on this device (then remembers it). */
export function firstTime(lens: string, phase: string): boolean {
  const seen = read<Record<string, 1>>(ONBOARD_KEY, {});
  const key = `${lens}:${phase}`;
  if (seen[key]) return false;
  seen[key] = 1;
  write(ONBOARD_KEY, seen);
  return true;
}

/** Step 3 mastery per `${passId}:${lens}`: {passId, lens, done, streak, bestStreak, attempts} (WO-010). */
export function masteryOf(passId: string, lens: string): Mastery {
  return read<Record<string, Mastery>>(MASTERY_KEY, {})[`${passId}:${lens}`] ?? emptyMastery(passId, lens);
}

export function saveMastery(m: Mastery) {
  const all = read<Record<string, Mastery>>(MASTERY_KEY, {});
  all[`${m.passId}:${m.lens}`] = m;
  write(MASTERY_KEY, all);
}

/** Step 4 timed runs per `${passId}:${lens}`, latest first. */
export function timedRuns(passId: string, lens: string): TimedRun[] {
  return read<Record<string, TimedRun[]>>(TIMED_KEY, {})[`${passId}:${lens}`] ?? [];
}

export function saveTimedRun(passId: string, lens: string, run: TimedRun) {
  const all = read<Record<string, TimedRun[]>>(TIMED_KEY, {});
  const key = `${passId}:${lens}`;
  all[key] = [run, ...(all[key] ?? [])].slice(0, TIMED_KEEP);
  write(TIMED_KEY, all);
}
