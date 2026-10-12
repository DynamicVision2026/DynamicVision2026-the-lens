// The study-pace motion preview for a standard Enclose card (docs/work-orders/WO-003-motion.md v2).
// One beat per calculation step; the number of corner beats follows the card's `sub` steps.
import { bandTriangles } from '../band';
import { enclosureGaps } from '../geometry';
import type { LensCard, Tokens } from '../types';

export type BeatName =
  | 'hook'
  | 'trap'
  | 'freeze'
  | 'lens_activate'
  | 'box_step'
  | 'corner_step'
  | 'subtract'
  | 'mark_parallel'
  | 'slide_apex'
  | 'merge_triangle'
  | 'reflect_point'
  | 'draw_straight'
  | 'mark_similar'
  | 'answer'
  | 'end_card';

export interface Beat {
  name: BeatName;
  durationMs: number;
  /** For corner_step / slide_apex: index of the corner or apex (0-based, in order). */
  index?: number;
}

/** Beat-sheet windows that have no token of their own. */
const BEAT_MS = { hook: 3000, trap: 4000, freeze: 3500, lens_activate: 1500, subtract: 3000, end_card: 3500 } as const;

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
  if (card.kind !== 'standard') return null;
  const figure = card.problem.figure;
  if (figure.type === 'parallel_band') return bandTimeline(card, tokens);
  if (figure.type === 'mirror_path') return mirrorTimeline(card, tokens);
  if (figure.type !== 'grid_polygon') return null;
  const steps = card.lens_route.steps;
  const start = steps.find((s) => s.op === 'start');
  const subs = steps.filter((s) => s.op === 'sub');
  if (start?.detail?.kind !== 'box' || subs.length === 0 || subs.some((s) => s.detail?.kind !== 'corner')) return null;
  if (enclosureGaps(figure.points).length !== subs.length) return null;
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

/**
 * The full Short (WO-003 step 2): the approved study-pace walkthrough, framed by the WO-003 beats.
 * hook (question) → trap (+ time strip) → freeze (four lens buttons) → lens activates (correct
 * button lights) → box → one beat per corner → subtract → answer → end card (trigger, time saved,
 * series card). Null for cards the study walkthrough does not cover.
 */
export function shortTimeline(card: LensCard, tokens: Tokens): Beat[] | null {
  const study = motionPreviewTimeline(card, tokens);
  if (!study) return null;
  const [trap, ...rest] = study;
  return [
    { name: 'hook', durationMs: BEAT_MS.hook },
    trap!,
    { name: 'freeze', durationMs: BEAT_MS.freeze },
    ...rest,
    { name: 'end_card', durationMs: BEAT_MS.end_card },
  ];
}

/**
 * Study pace on a parallel band (WO-004): trap → lens activates → the parallel lines → one beat per
 * apex sliding along ℓ → the merged triangle → answer. Driven by the number of apexes.
 */
function bandTimeline(card: LensCard, tokens: Tokens): Beat[] | null {
  const figure = card.problem.figure;
  if (figure.type !== 'parallel_band' || !card.lens_route.steps.some((s) => s.op === 'result')) return null;
  const study = tokens.motion.study;
  const n = bandTriangles(figure);
  return [
    { name: 'trap', durationMs: BEAT_MS.trap },
    { name: 'lens_activate', durationMs: BEAT_MS.lens_activate },
    { name: 'mark_parallel', durationMs: studyStepMs(tokens) },
    ...Array.from({ length: n }, (_, index): Beat => ({ name: 'slide_apex', durationMs: study.step_focus_ms + study.legs_draw_ms, index })),
    { name: 'merge_triangle', durationMs: study.formula_ms + study.step_hold_ms },
    { name: 'answer', durationMs: 500 + study.final_hold_ms },
  ];
}

/**
 * Study pace on a shortest-path figure (WO-005): trap (the midpoint guess) → lens activates →
 * reflect Q → the straight line P→Q′ → the similar triangles, held long enough to read the ratio →
 * answer.
 */
function mirrorTimeline(card: LensCard, tokens: Tokens): Beat[] | null {
  if (!card.lens_route.steps.some((s) => s.op === 'result')) return null;
  const study = tokens.motion.study;
  const step = studyStepMs(tokens);
  return [
    { name: 'trap', durationMs: BEAT_MS.trap },
    { name: 'lens_activate', durationMs: BEAT_MS.lens_activate },
    { name: 'reflect_point', durationMs: step },
    { name: 'draw_straight', durationMs: step },
    { name: 'mark_similar', durationMs: step + study.step_hold_ms },
    { name: 'answer', durationMs: 500 + study.final_hold_ms },
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
