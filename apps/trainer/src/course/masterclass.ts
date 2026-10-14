// Step 1 さわって学ぶ (WO-014): the 6-minute masterclass. Content from passes[].lessons[].masterclass,
// timings from tokens.motion.masterclass; nothing here is per lens.
import { getCard, tokens, type LensCard, type Lesson, type Masterclass, type MasterclassToken } from '@lens/scenes';
import { isBoundary } from './Walkthrough';
import type { LessonProblem } from './lessons';

export function masterToken(): MasterclassToken {
  const m = tokens.motion.masterclass;
  if (!m) throw new Error('tokens.motion.masterclass missing (tokens 1.8)');
  return m;
}

export interface MasterCards {
  mc: Masterclass;
  example1: LensCard;
  example2: LensCard;
  boundary: LensCard;
  try: LensCard;
}

/** The lesson's masterclass with its four cards, or null when it has none (or a card is missing). */
export function masterCards(lesson: Lesson): MasterCards | null {
  const mc = lesson.masterclass;
  if (!mc) return null;
  const [example1, example2, boundary, tryCard] = [mc.example1, mc.example2, mc.boundary, mc.try].map((id) => getCard(id));
  if (!example1 || !example2 || !boundary || !tryCard) return null;
  return { mc, example1, example2, boundary, try: tryCard };
}

/** Beat 4's heading: this lens's own failure / no-lens card, or a card where another tool is right. */
export function boundaryHeading(card: LensCard): { kind: 'own' } | { kind: 'other'; lens: string } {
  return isBoundary(card) ? { kind: 'own' } : { kind: 'other', lens: card.picker.correct };
}

/**
 * The 5-segment bar: each finished beat is full; the current one fills at its target pace (capped at
 * full, never advancing the beat). Returns fractions 0..1, one per beat.
 */
export function barFill(beat: number, beatElapsedSec: number, m: MasterclassToken = masterToken()): number[] {
  return m.beats.map((b, i) => (i < beat ? 1 : i > beat ? 0 : Math.min(1, Math.max(0, beatElapsedSec / b.sec))));
}

/** 「m:ss」 */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The lens_route captions shown as the scene reaches them: one per interaction phase the scene has coached. */
export function captionsShown(card: LensCard, phases: number, solved: boolean): number {
  const steps = card.lens_route.steps;
  const result = steps.findIndex((st) => st.op === 'result');
  const before = result < 0 ? steps.length : result;
  return solved ? steps.length : Math.min(phases, before);
}

/** Step 3's problems never include the masterclass's own example1, example2 or try cards. */
export function withoutMasterCards(problems: LessonProblem[], lesson: Lesson): LessonProblem[] {
  const mc = lesson.masterclass;
  if (!mc) return problems;
  const own = new Set([mc.example1, mc.example2, mc.try]);
  return problems.filter((p) => !own.has(p.card.id));
}

/** Where a lesson opens from the case: Step 1 until its masterclass has been seen, then Step 2. */
export function lessonEntry(passId: string, lesson: Lesson, seen: boolean): string {
  return `/lesson/${passId}/${lesson.lens}${lesson.masterclass && !seen ? '/master' : ''}`;
}
