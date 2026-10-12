// The study-pace motion preview for a standard Enclose card (docs/work-orders/WO-003-motion.md v2).
// One beat per calculation step; the number of corner beats follows the card's `sub` steps.
import { enclosureGaps } from '../geometry';
import type { LensCard, Tokens } from '../types';

export type BeatName = 'trap' | 'lens_activate' | 'box_step' | 'corner_step' | 'subtract' | 'answer';

export interface Beat {
  name: BeatName;
  durationMs: number;
  /** For corner_step: index of the corner (0-based, in step order). */
  index?: number;
}

/** Beat-sheet windows that have no token of their own. */
const BEAT_MS = { trap: 4000, lens_activate: 1500, subtract: 3000 } as const;

/** Length of one calculation step: focus + base/height + formula + hold. */
export function studyStepMs(tokens: Tokens): number {
  const s = tokens.motion.study;
  return s.step_focus_ms + s.legs_draw_ms + s.formula_ms + s.step_hold_ms;
}

/**
 * The study-pace beats for a card, or null unless it is a standard Enclose card whose box and
 * corner steps all carry their verified `detail` and match the figure's corner gaps.
 */
export function motionPreviewTimeline(card: LensCard, tokens: Tokens): Beat[] | null {
  if (card.kind !== 'standard' || card.lens !== 'enclose') return null;
  const steps = card.lens_route.steps;
  const start = steps.find((s) => s.op === 'start');
  const subs = steps.filter((s) => s.op === 'sub');
  if (start?.detail?.kind !== 'box' || subs.length === 0 || subs.some((s) => s.detail?.kind !== 'corner')) return null;
  if (enclosureGaps(card.problem.figure.points).length !== subs.length) return null;
  const step = studyStepMs(tokens);
  return [
    { name: 'trap', durationMs: BEAT_MS.trap },
    { name: 'lens_activate', durationMs: BEAT_MS.lens_activate },
    { name: 'box_step', durationMs: step },
    ...subs.map((_, index): Beat => ({ name: 'corner_step', durationMs: step, index })),
    { name: 'subtract', durationMs: BEAT_MS.subtract },
    { name: 'answer', durationMs: 500 + tokens.motion.study.final_hold_ms },
  ];
}

export function timelineDuration(beats: Beat[]): number {
  return beats.reduce((sum, b) => sum + b.durationMs, 0);
}

/** Maps a time on the timeline to (beat index, t within that beat). Past the end: last beat, t = 1. */
export function beatAt(beats: Beat[], ms: number): { index: number; t: number } {
  let start = 0;
  for (let i = 0; i < beats.length; i++) {
    const d = beats[i]!.durationMs;
    if (ms < start + d) return { index: i, t: Math.max(0, (ms - start) / d) };
    start += d;
  }
  return { index: beats.length - 1, t: 1 };
}

/** Short label for a beat, e.g. "corner_step 2". */
export function beatLabel(beat: Beat): string {
  return beat.index === undefined ? beat.name : `${beat.name} ${beat.index + 1}`;
}
