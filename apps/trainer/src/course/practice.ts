// Course Steps 3–4 (WO-010 practice + mastery; README "drill + timer check"). Step 3 ひとりで練習:
// the variants of every card in the lesson, boundary cards included, one problem after another with
// no hints; the lesson is mastered after 3 clean problems in a row. Step 4 時間をはかって確認: a short
// timed set of variants from different cards, recorded so the child can see how much faster they got.
import { withVariant, type Lesson, type LensCard } from '@lens/scenes';
import { problemMode, type LessonProblem } from './lessons';
import { shuffle } from './shuffle';

/** Clean = the first pick and the first clue were both right. */
export const MASTERY_STREAK = 3;
export const TIMED_COUNT = 5;

/** A card's variants as problems; a card without variants stands in for itself. */
function variantsOf(card: LensCard, lens: string): LessonProblem[] {
  const vs = card.variants.length ? card.variants.map((v) => withVariant(card, v)) : [card];
  return vs.map((c) => ({ card: c, mode: problemMode(c, lens) }));
}

/** The lesson's anchors (catalog order), each with its variants. */
function anchorsWithVariants(lesson: Lesson, problems: LessonProblem[]) {
  const anchors = problems.filter((p) => !/-v\d+$/.test(p.card.id)).map((p) => p.card);
  return anchors.map((a) => variantsOf(a, lesson.lens));
}

/**
 * Step 3 practice order: round by round, one variant of every card (v1s, then v2s, …), each round
 * shuffled, so every type comes up before any repeats.
 */
export function practiceQueue(problems: LessonProblem[], lesson: Lesson, rand: () => number = Math.random): LessonProblem[] {
  const per = anchorsWithVariants(lesson, problems);
  const rounds = Math.max(0, ...per.map((v) => v.length));
  const out: LessonProblem[] = [];
  for (let r = 0; r < rounds; r++) out.push(...shuffle(per.flatMap((v) => (v[r] ? [v[r]!] : [])), rand));
  return out;
}

/** Step 4: up to TIMED_COUNT variants, each from a different card, in mixed order. */
export function timedSet(problems: LessonProblem[], lesson: Lesson, rand: () => number = Math.random, n = TIMED_COUNT): LessonProblem[] {
  const per = shuffle(anchorsWithVariants(lesson, problems), rand).slice(0, n);
  return per.map((vs) => vs[Math.floor(rand() * vs.length)]!);
}

export interface Mastery {
  passId: string;
  lens: string;
  done: boolean;
  streak: number;
  bestStreak: number;
  attempts: number;
}

export function emptyMastery(passId: string, lens: string): Mastery {
  return { passId, lens, done: false, streak: 0, bestStreak: 0, attempts: 0 };
}

/** One practice result: the streak grows on a clean problem and resets otherwise; 3 in a row masters the lesson. */
export function applyPractice(m: Mastery, clean: boolean): Mastery {
  const streak = clean ? m.streak + 1 : 0;
  return { ...m, attempts: m.attempts + 1, streak, bestStreak: Math.max(m.bestStreak, streak), done: m.done || streak >= MASTERY_STREAK };
}

export interface TimedItem {
  cardId: string;
  /** The problem's own sentence (a variant's, not its card's). */
  text: string;
  ms: number;
  clean: boolean;
  /** The trap route's estimate for the card (seconds), for 「くせでやると約N分」. */
  trapSec: number | null;
}

export interface TimedRun {
  at: number;
  totalMs: number;
  clean: number;
  n: number;
}

export function summarizeTimed(items: TimedItem[], at = Date.now()): TimedRun {
  return { at, totalMs: items.reduce((s, i) => s + i.ms, 0), clean: items.filter((i) => i.clean).length, n: items.length };
}

/** Seconds faster than the previous run (positive = faster), or null for a first run. */
export function fasterBy(run: TimedRun, previous: TimedRun | undefined): number | null {
  return previous ? Math.round((previous.totalMs - run.totalMs) / 1000) : null;
}

/** 「くせでやると約N分」: minutes from the card's trap estimate, at least 1. */
export function trapMinutes(sec: number | null): number | null {
  return sec ? Math.max(1, Math.round(sec / 60)) : null;
}
