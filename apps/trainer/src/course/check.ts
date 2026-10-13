// The どのレンズ？ check (WO-013): which problems it asks, and what the result screen shows.
// Pure functions, so the confusion pairs and times are testable for a scripted run.
import { getCard, withVariant, type LensCard, type Pass } from '@lens/scenes';
import { scenePool } from './lessons';
import { shuffle } from './shuffle';

/** One problem's outcome: the child's first pick and how long it took (ms from first render). */
export interface CheckAnswer {
  cardId: string;
  /** The right pick: the card's best move (a lens, or "direct" on boundary cards). */
  lens: string;
  firstPick: string;
  ms: number;
  /** The first clue chip tapped was the real one (the drill scores pick + clue). */
  clue?: boolean;
}

export interface CheckResult {
  correct: number;
  /** Right first pick and right first clue. */
  clean: number;
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
    // Standard scene cards only (WO-016): the free check asks which lens; boundary cards are for lessons.
    const pool = scenePool(lesson).filter((c) => (c.level ?? 1) <= maxLevel);
    return pool.length ? [pool[Math.floor(rand() * pool.length)]!] : [];
  });
  return shuffle(picks, rand);
}

/** Drill size (PRD, "Mixed set"): one per lens plus this many boundary items. */
export const DRILL_BOUNDARY = 2;

/** A card and its variants, as drawable cards. */
const withVariants = (c: LensCard) => [c, ...c.variants.map((v) => withVariant(c, v))];

/**
 * The week-4 mixed drill (WO-013, PRD "Mixed set"): one problem per lens from all its standard cards
 * and variants (every level, scene or not), plus DRILL_BOUNDARY failure / no-lens problems from
 * different lenses, where the right pick is the card's best move. Mixed order.
 */
export function drillProblems(pass: Pass, rand: () => number = Math.random): LensCard[] {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
  const anchors = (lens: string) => (pass.lessons.find((l) => l.lens === lens)?.cards ?? []).map((id) => getCard(id)).filter((c): c is LensCard => !!c);
  const standard = pass.lessons.flatMap((l) => {
    const pool = anchors(l.lens).filter((c) => c.kind === 'standard').flatMap(withVariants);
    return pool.length ? [pick(pool)] : [];
  });
  const boundaryLenses = shuffle(
    pass.lessons.map((l) => l.lens).filter((lens) => anchors(lens).some((c) => c.kind !== 'standard')),
    rand,
  ).slice(0, DRILL_BOUNDARY);
  const boundary = boundaryLenses.map((lens) => pick(anchors(lens).filter((c) => c.kind !== 'standard').flatMap(withVariants)));
  return shuffle([...standard, ...boundary], rand);
}

const DRILL_KEY = 'lens.v1.drill';

/** Drill runs, latest first (the last 10), for the parent report. */
export function saveDrill(result: CheckResult, answers: CheckAnswer[]) {
  try {
    const all = JSON.parse(window.localStorage.getItem(DRILL_KEY) ?? '[]') as unknown[];
    window.localStorage.setItem(DRILL_KEY, JSON.stringify([{ at: Date.now(), result, answers }, ...all].slice(0, 10)));
  } catch {
    // Storage unavailable: the result shows, it just isn't kept.
  }
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
  const clean = answers.filter((a) => a.firstPick === a.lens && a.clue !== false).length;
  return { correct, clean, total: answers.length, confusions, averageMs, suggest: slowest?.lens ?? null };
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
