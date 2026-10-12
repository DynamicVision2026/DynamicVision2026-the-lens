// Mirror-lens keyframes for a mirror_path figure (WO-005). Each reducer sets its end state at t = 1.
import type { LensCard, Step } from '../types';

export interface MirrorState {
  show: number;
  tryPath: number;
  tryDim: number;
  reflect: number;
  straight: number;
  similar: number;
  answer: number;
  caption: { step: Step; t: number } | null;
}

type MirrorReducer = (s: MirrorState, t: number, card: LensCard) => MirrorState;

const step = (card: LensCard, i: number) => card.lens_route.steps[i];
const result = (card: LensCard) => card.lens_route.steps.find((s) => s.op === 'result');
const caption = (s: Step | undefined, t: number, prev: MirrorState['caption']) => (s ? { step: s, t } : prev);

/** The trap path dims to this once the guess has been shown. */
const TRY_DIM = 0.3;

export const MIRROR_KEYFRAMES: Record<string, MirrorReducer> = {
  show_river: (s, t) => ({ ...s, show: t }),
  // Draw the halfway guess, then fade it to 30% at the end of the keyframe.
  try_midpoint: (s, t) => ({ ...s, tryPath: Math.min(1, t / 0.7), tryDim: t <= 0.7 ? 1 : 1 - ((t - 0.7) / 0.3) * (1 - TRY_DIM) }),
  reflect_point: (s, t, card) => ({ ...s, reflect: t, caption: caption(step(card, 0), t, s.caption) }),
  draw_straight: (s, t, card) => ({ ...s, straight: t, caption: caption(step(card, 1), t, s.caption) }),
  mark_similar: (s, t, card) => ({ ...s, similar: t, caption: caption(step(card, 2), t, s.caption) }),
  show_answer: (s, t, card) => ({ ...s, answer: t, caption: caption(result(card), 1, s.caption) }),
};

const warned = new Set<string>();

export function mirrorState(keyframes: string[], k: number, t: number, card: LensCard): MirrorState {
  let state: MirrorState = { show: 0, tryPath: 0, tryDim: 1, reflect: 0, straight: 0, similar: 0, answer: 0, caption: null };
  const last = Math.min(Math.max(0, k), keyframes.length - 1);
  for (let i = 0; i <= last; i++) {
    const name = keyframes[i]!;
    const reducer = MIRROR_KEYFRAMES[name];
    if (!reducer) {
      if (!warned.has(name)) {
        warned.add(name);
        console.warn(`LensScene: unknown mirror keyframe "${name}"; showing the end state of the keyframe before it.`);
      }
      continue;
    }
    state = reducer(state, i === last ? t : 1, card);
  }
  return state;
}
