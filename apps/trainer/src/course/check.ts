// The どのレンズ？ check (WO-013): which problems it asks, and what the result screen shows.
// Pure functions, so the confusion pairs and times are testable for a scripted run.
import type { LensCard, Pass } from '@lens/scenes';
import { lessonProblems } from './lessons';
import { shuffle } from './shuffle';

/** One problem's outcome: the child's first pick and how long it took (ms from first render). */
export interface CheckAnswer {
  cardId: string;
  lens: string;
  firstPick: string;
  ms: number;
}

export interface CheckResult {
  correct: number;
  total: number;
  /** Mixed-up lens pairs, most frequent first: [the right lens, the one picked instead, count]. */
  confusions: [string, string, number][];
  averageMs: number;
  /** One lens to start with: a missed one (the slowest miss), else the slowest pick. */
  suggest: string | null;
}

/**
 * One problem per lesson (one per lens), in mixed order. The free check uses level-1/2 cards and
 * their variants only; variants keep their parent's level.
 */
export function checkProblems(pass: Pass, rand: () => number = Math.random, maxLevel = 2): LensCard[] {
  const picks = pass.lessons.flatMap((lesson) => {
    const pool = lessonProblems(pass, lesson).filter((c) => (c.level ?? 1) <= maxLevel);
    return pool.length ? [pool[Math.floor(rand() * pool.length)]!] : [];
  });
  return shuffle(picks, rand);
}

export function summarize(answers: CheckAnswer[]): CheckResult {
  const correct = answers.filter((a) => a.firstPick === a.lens).length;
  const pairs = new Map<string, [string, string, number]>();
  for (const a of answers.filter((x) => x.firstPick !== x.lens)) {
    const key = `${a.lens}→${a.firstPick}`;
    const cur = pairs.get(key) ?? [a.lens, a.firstPick, 0];
    pairs.set(key, [cur[0], cur[1], cur[2] + 1]);
  }
  const confusions = [...pairs.values()].sort((x, y) => y[2] - x[2]);
  const averageMs = answers.length ? answers.reduce((s, a) => s + a.ms, 0) / answers.length : 0;
  const misses = answers.filter((a) => a.firstPick !== a.lens);
  const pool = misses.length ? misses : answers;
  const slowest = pool.reduce<CheckAnswer | null>((m, a) => (!m || a.ms > m.ms ? a : m), null);
  return { correct, total: answers.length, confusions, averageMs, suggest: slowest?.lens ?? null };
}

/** Seconds with one decimal, for the result screen. */
export function seconds(ms: number): string {
  return (Math.round(ms / 100) / 10).toFixed(1);
}

const KEY = 'lens.v1.check';

export function saveCheck(result: CheckResult, answers: CheckAnswer[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), result, answers }));
  } catch {
    // Storage unavailable (private window): the result shows, it just isn't kept.
  }
}
