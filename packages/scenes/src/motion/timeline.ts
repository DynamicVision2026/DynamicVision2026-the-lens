// The ~10 s motion preview for a standard Enclose card (docs/work-orders/WO-003-motion.md).
// Beat windows follow the beat sheet; element timings inside each beat come from motion tokens.
import { enclosureGaps } from '../geometry';
import type { LensCard, Tokens } from '../types';

export type BeatName =
  | 'trap_state'
  | 'lens_activate'
  | 'laser_wipe'
  | 'light_corners'
  | 'collapse'
  | 'core_isolated'
  | 'answer';

export interface Beat {
  name: BeatName;
  durationMs: number;
}

/** Beat-sheet windows that have no token of their own. */
const BEAT_MS = {
  trap_state: 1500,
  lens_activate: 700,
  light_corners: 1500,
  collapse: 2200,
  core_isolated: 800,
  answer: 2600,
} as const;

/**
 * The preview beats for a card, or null when the card is not a standard Enclose card whose corner
 * gaps match its `sub` steps (the preview is the Enclose collapse sequence).
 */
export function motionPreviewTimeline(card: LensCard, tokens: Tokens): Beat[] | null {
  if (card.kind !== 'standard' || card.lens !== 'enclose') return null;
  const subs = card.lens_route.steps.filter((s) => s.op === 'sub');
  if (subs.length === 0 || enclosureGaps(card.problem.figure.points).length !== subs.length) return null;
  return [
    { name: 'trap_state', durationMs: BEAT_MS.trap_state },
    { name: 'lens_activate', durationMs: BEAT_MS.lens_activate },
    { name: 'laser_wipe', durationMs: tokens.motion.duration_ms.laser_wipe },
    { name: 'light_corners', durationMs: BEAT_MS.light_corners },
    { name: 'collapse', durationMs: BEAT_MS.collapse },
    { name: 'core_isolated', durationMs: BEAT_MS.core_isolated },
    { name: 'answer', durationMs: BEAT_MS.answer },
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
