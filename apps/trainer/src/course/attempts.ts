// WO-019: the decision-speed log. Every problem appearance, in every mode, records the child's first
// lens pick and how long it took (visible time only). Day 1 = the first どのレンズ？ check on this
// device; week 4 = the week-4 check. The parent report compares the two. Nothing leaves the device.
import { getCard, withVariant, type LensCard, type Pass } from '@lens/scenes';
import { scenePool } from './lessons';
import { shuffle } from './shuffle';

export type AttemptCtx = 'check' | 'lesson' | 'drill' | 'timer' | 'week4';

export interface Attempt {
  at: string; // ISO date-time
  pass: string;
  ctx: AttemptCtx;
  /** Groups one sitting (a check run, a lesson visit), so day 1 and week 4 are whole sessions. */
  sid: string;
  card: string; // card or variant id
  anchor: string; // variant → its parent
  want: string; // picker.correct
  first: string; // first lens tapped
  ok: boolean;
  ms: number; // shown → first tap, visible time only
  msRight?: number; // shown → the right tap, when the first was wrong
}

export const ATTEMPTS_KEY = 'lens.attempts.v1';
export const ATTEMPTS_CAP = 3000;
/** Problems in a day-1 or week-4 session. */
export const SESSION_SIZE = 8;
/** Week 4 opens on day 22 after the baseline. */
export const WEEK4_AFTER_DAYS = 21;
const DAY = 86_400_000;

export const anchorOf = (id: string) => id.replace(/-v\d+$/, '');

export function readAttempts(): Attempt[] {
  try {
    const raw = window.localStorage.getItem(ATTEMPTS_KEY);
    const all = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(all) ? (all as Attempt[]) : [];
  } catch {
    return [];
  }
}

function writeAttempts(all: Attempt[]) {
  try {
    window.localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(all.slice(-ATTEMPTS_CAP)));
  } catch {
    // Storage full or blocked (private window): the measurement is lost, the child's play is not.
  }
}

/** Appends one record (keeping the newest ATTEMPTS_CAP). Never throws. */
export function logAttempt(a: Attempt) {
  writeAttempts([...readAttempts(), a]);
}

/** Adds msRight to the record of this appearance (same sid, card and time). Never throws. */
export function logRightAfter(a: Pick<Attempt, 'sid' | 'card' | 'at'>, msRight: number) {
  const all = readAttempts();
  for (let i = all.length - 1; i >= 0; i--) {
    const x = all[i]!;
    if (x.sid === a.sid && x.card === a.card && x.at === a.at) {
      all[i] = { ...x, msRight };
      writeAttempts(all);
      return;
    }
  }
}

export function clearAttempts() {
  try {
    window.localStorage.removeItem(ATTEMPTS_KEY);
  } catch {
    // Nothing to clear.
  }
}

export const newSid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * A stopwatch of visible time: it pauses while the page is hidden, so a child who leaves for five
 * minutes does not count as five minutes of thinking.
 */
export class VisibleClock {
  private startAt = 0;
  private hiddenSince: number | null = null;
  private hiddenMs = 0;
  private readonly onVis = () => {
    if (this.doc.visibilityState === 'hidden') {
      if (this.hiddenSince === null) this.hiddenSince = this.now();
    } else if (this.hiddenSince !== null) {
      this.hiddenMs += this.now() - this.hiddenSince;
      this.hiddenSince = null;
    }
  };

  constructor(
    private readonly now: () => number = () => performance.now(),
    private readonly doc: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'> = document,
  ) {}

  start() {
    this.startAt = this.now();
    this.hiddenMs = 0;
    this.hiddenSince = this.doc.visibilityState === 'hidden' ? this.startAt : null;
    this.doc.addEventListener('visibilitychange', this.onVis);
  }

  elapsed(): number {
    const hiddenNow = this.hiddenSince !== null ? this.now() - this.hiddenSince : 0;
    return Math.max(0, this.now() - this.startAt - this.hiddenMs - hiddenNow);
  }

  stop() {
    this.doc.removeEventListener('visibilitychange', this.onVis);
  }
}

// ---------- analysis ----------

export interface Session {
  sid: string;
  ctx: AttemptCtx;
  at: string;
  /** First appearance of each card only (repeats ignored). */
  attempts: Attempt[];
}

/** Sessions of a context for a pass, oldest first, each with its first appearance per card. */
export function sessions(all: Attempt[], pass: string, ctx: AttemptCtx): Session[] {
  const by = new Map<string, Session>();
  for (const a of all) {
    if (a.pass !== pass || a.ctx !== ctx) continue;
    const s = by.get(a.sid) ?? { sid: a.sid, ctx, at: a.at, attempts: [] };
    if (!s.attempts.some((x) => x.card === a.card)) s.attempts.push(a);
    by.set(a.sid, s);
  }
  return [...by.values()];
}

const complete = (s: Session) => s.attempts.length >= SESSION_SIZE;

/** Day 1: the first complete どのレンズ？ check on this device. */
export function baseline(all: Attempt[], pass: string): Session | null {
  return sessions(all, pass, 'check').find(complete) ?? null;
}

/** Week 4: the latest complete week-4 check. */
export function week4(all: Attempt[], pass: string): Session | null {
  return [...sessions(all, pass, 'week4')].reverse().find(complete) ?? null;
}

export function week4Open(base: Session | null, now = Date.now()): boolean {
  return !!base && now - Date.parse(base.at) >= WEEK4_AFTER_DAYS * DAY;
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export interface SessionStats {
  at: string;
  medianMs: number;
  ok: number;
  total: number;
  /** "want→first" → count. */
  confusions: Record<string, number>;
  /** Per right move (lens): first-pick ms and whether it was right. */
  perLens: Record<string, { ms: number; ok: boolean }>;
}

export function stats(s: Session): SessionStats {
  const confusions: Record<string, number> = {};
  const perLens: Record<string, { ms: number; ok: boolean }> = {};
  for (const a of s.attempts) {
    if (!a.ok) confusions[`${a.want}→${a.first}`] = (confusions[`${a.want}→${a.first}`] ?? 0) + 1;
    perLens[a.want] = { ms: a.ms, ok: a.ok };
  }
  return { at: s.at, medianMs: median(s.attempts.map((a) => a.ms)), ok: s.attempts.filter((a) => a.ok).length, total: s.attempts.length, confusions, perLens };
}

/** Practice volume per week since the baseline (lesson, timer and drill problems), counts only. */
export function weeklyCounts(all: Attempt[], pass: string, from: string, weeks = 4): number[] {
  const t0 = Date.parse(from);
  const out = Array.from({ length: weeks }, () => 0);
  for (const a of all) {
    if (a.pass !== pass || !(a.ctx === 'lesson' || a.ctx === 'drill' || a.ctx === 'timer')) continue;
    const w = Math.floor((Date.parse(a.at) - t0) / (7 * DAY));
    if (w >= 0 && w < weeks) out[w]!++;
  }
  return out;
}

/** The child's median first-pick time for a lens today (lesson summary). */
export function todayMedian(all: Attempt[], pass: string, lens: string, now = new Date()): number | null {
  const day = now.toISOString().slice(0, 10);
  const ms = all.filter((a) => a.pass === pass && a.ctx === 'lesson' && a.want === lens && a.at.slice(0, 10) === day).map((a) => a.ms);
  return ms.length ? median(ms) : null;
}

/**
 * The week-4 check: one problem per lens at the day-1 level, never a card or variant the child saw on
 * day 1. Siblings first (another variant of the same anchor), else another card at the same level.
 */
export function week4Problems(pass: Pass, day1: Attempt[], rand: () => number = Math.random): LensCard[] {
  const seen = new Set(day1.map((a) => a.card));
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
  const out = pass.lessons.flatMap((lesson) => {
    const pool = scenePool(lesson).filter((c) => !seen.has(c.id));
    const before = day1.find((a) => getCard(a.anchor)?.lens === lesson.lens);
    const level = before ? (getCard(before.anchor)?.level ?? 1) : null;
    const atLevel = level === null ? pool.filter((c) => (c.level ?? 1) <= 2) : pool.filter((c) => (c.level ?? 1) === level);
    const siblings = before ? atLevel.filter((c) => anchorOf(c.id) === before.anchor) : [];
    const choice = siblings.length ? siblings : atLevel.length ? atLevel : pool;
    return choice.length ? [pick(choice)] : [];
  });
  return shuffle(out, rand);
}

/** The card as drawn (variants merged), for logging the anchor and the right move. */
export function cardFor(id: string): LensCard | null {
  const a = getCard(anchorOf(id));
  if (!a) return null;
  const v = a.variants.find((x) => x.id === id);
  return v ? withVariant(a, v) : a;
}

/** What a problem appearance logs: its scope and card (the pick step owns one per appearance). */
export interface PickScope {
  ctx: AttemptCtx;
  pass: string;
  sid: string;
}

/**
 * One problem appearance: the first pick appends one record; a later right pick (after a wrong first)
 * adds msRight to it; nothing else is logged. `elapsed` is the visible-time clock.
 */
export class PickLogger {
  private rec: Attempt | null = null;

  constructor(
    private readonly scope: PickScope | null,
    private readonly card: Pick<LensCard, 'id' | 'picker'>,
    private readonly elapsed: () => number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Returns the first pick's ms the first time, else null. */
  pick(option: string): number | null {
    const ms = Math.round(this.elapsed());
    const want = this.card.picker.correct;
    if (!this.rec) {
      this.rec = { at: this.now().toISOString(), pass: this.scope?.pass ?? '', ctx: this.scope?.ctx ?? 'lesson', sid: this.scope?.sid ?? '', card: this.card.id, anchor: anchorOf(this.card.id), want, first: option, ok: option === want, ms };
      if (this.scope) logAttempt(this.rec);
      return ms;
    }
    if (option === want && !this.rec.ok && this.rec.msRight === undefined) {
      this.rec = { ...this.rec, msRight: ms };
      if (this.scope) logRightAfter(this.rec, ms);
    }
    return null;
  }
}
