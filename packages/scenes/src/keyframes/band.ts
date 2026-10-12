// Slide-lens keyframes for a parallel_band figure (WO-004). Each reducer sets its end state at t = 1.
import { bandTriangles } from '../band';
import { stagger } from '../easing';
import type { LensCard, ParallelBandFigure, Step } from '../types';

export interface BandState {
  show: number;
  parallel: number;
  slid: number[];
  merged: number;
  answer: number;
  caption: { step: Step; t: number } | null;
}

type BandReducer = (s: BandState, t: number, card: LensCard, fig: ParallelBandFigure) => BandState;

const result = (card: LensCard) => card.lens_route.steps.find((s) => s.op === 'result');

export const BAND_KEYFRAMES: Record<string, BandReducer> = {
  show_band: (s, t) => ({ ...s, show: t }),
  // A pulse that settles: 0 → 1 → 0.6 at the end, so the highlight stays visible.
  mark_parallel: (s, t) => ({ ...s, parallel: t < 0.5 ? t * 2 : 1 - (t - 0.5) * 0.8 }),
  slide_apexes: (s, t, card, fig) => {
    const n = bandTriangles(fig);
    const step = card.lens_route.steps[0];
    return { ...s, slid: Array.from({ length: n }, (_, i) => stagger(t, i, n)), caption: step ? { step, t } : s.caption };
  },
  merge_triangle: (s, t, card) => {
    const step = card.lens_route.steps[1];
    return { ...s, merged: t, caption: step ? { step, t } : s.caption };
  },
  show_answer: (s, t, card) => {
    const step = result(card);
    return { ...s, answer: t, caption: step ? { step, t: 1 } : s.caption };
  },
};

const warned = new Set<string>();

export function bandState(keyframes: string[], k: number, t: number, card: LensCard, fig: ParallelBandFigure): BandState {
  let state: BandState = { show: 0, parallel: 0, slid: Array.from({ length: bandTriangles(fig) }, () => 0), merged: 0, answer: 0, caption: null };
  const last = Math.min(Math.max(0, k), keyframes.length - 1);
  for (let i = 0; i <= last; i++) {
    const name = keyframes[i]!;
    const reducer = BAND_KEYFRAMES[name];
    if (!reducer) {
      if (!warned.has(name)) {
        warned.add(name);
        console.warn(`LensScene: unknown band keyframe "${name}"; showing the end state of the keyframe before it.`);
      }
      continue;
    }
    state = reducer(state, i === last ? t : 1, card, fig);
  }
  return state;
}
