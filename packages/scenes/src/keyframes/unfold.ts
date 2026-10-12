// Unfold-lens keyframes for a box_unfold figure (WO-008). Each reducer sets its end state at t = 1.
import type { LensCard, Step } from '../types';

export interface UnfoldState {
  show: number;
  tryPath: number;
  tryDim: number;
  unfold: number;
  straight: number;
  similar: number;
  answer: number;
  caption: { step: Step; t: number } | null;
}

type UnfoldReducer = (s: UnfoldState, t: number, card: LensCard) => UnfoldState;

const step = (card: LensCard, i: number) => card.lens_route.steps[i];
const result = (card: LensCard) => card.lens_route.steps.find((s) => s.op === 'result');
const caption = (s: Step | undefined, t: number, prev: UnfoldState['caption']) => (s ? { step: s, t } : prev);

/** The trap path dims to this once the guess has been shown. */
const TRY_DIM = 0.3;

export const UNFOLD_KEYFRAMES: Record<string, UnfoldReducer> = {
  show_box: (s, t) => ({ ...s, show: t }),
  // Draw the midpoint guess, then fade it to 30% at the end of the keyframe.
  try_midpoint: (s, t) => ({ ...s, tryPath: Math.min(1, t / 0.7), tryDim: t <= 0.7 ? 1 : 1 - ((t - 0.7) / 0.3) * (1 - TRY_DIM) }),
  unfold_faces: (s, t, card) => ({ ...s, unfold: t, caption: caption(step(card, 0), t, s.caption) }),
  draw_straight: (s, t, card) => ({ ...s, straight: t, caption: caption(step(card, 1), t, s.caption) }),
  mark_similar: (s, t, card) => ({ ...s, similar: t, caption: caption(step(card, 2), t, s.caption) }),
  show_answer: (s, t, card) => ({ ...s, answer: t, caption: caption(result(card), 1, s.caption) }),
};

const warned = new Set<string>();

export function unfoldState(keyframes: string[], k: number, t: number, card: LensCard): UnfoldState {
  let state: UnfoldState = { show: 0, tryPath: 0, tryDim: 1, unfold: 0, straight: 0, similar: 0, answer: 0, caption: null };
  const last = Math.min(Math.max(0, k), keyframes.length - 1);
  for (let i = 0; i <= last; i++) {
    const name = keyframes[i]!;
    const reducer = UNFOLD_KEYFRAMES[name];
    if (!reducer) {
      if (!warned.has(name)) {
        warned.add(name);
        console.warn(`LensScene: unknown unfold keyframe "${name}"; showing the end state of the keyframe before it.`);
      }
      continue;
    }
    state = reducer(state, i === last ? t : 1, card);
  }
  return state;
}
