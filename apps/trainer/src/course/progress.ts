// Course progress and first-time onboarding, on this device only. Never throws (private windows).
const SOLVED_KEY = 'lens.v1.course';
const ONBOARD_KEY = 'lens.v1.onboard';

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
