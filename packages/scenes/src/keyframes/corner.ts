// WO-018 keyframes for the two new 折り返す figures: mirror_corner (reflect twice) and river_bridge
// (shift by the river width). Each reducer sets its end state at t = 1.
import type { LensCard, Step } from '../types';

export interface CornerState {
  show: number;
  /** river_bridge: the wrong try (reflecting), drawn on then dimmed. */
  tryPath: number;
  tryDim: number;
  /** mirror_corner: P across m; river_bridge: the river width pulses. */
  first: number;
  /** mirror_corner: Q across ℓ; river_bridge: Q shifted north by the width. */
  second: number;
  /** The straight line; the touch point(s) light where it crosses. */
  straight: number;
  /** mirror_corner: the touch points and the real path. */
  touch: number;
  answer: number;
  caption: { step: Step; t: number } | null;
}

type Reducer = (s: CornerState, t: number, card: LensCard) => CornerState;

const step = (card: LensCard, i: number) => card.lens_route.steps[i];
const result = (card: LensCard) => card.lens_route.steps.find((s) => s.op === 'result');
const caption = (s: Step | undefined, t: number, prev: CornerState['caption']) => (s ? { step: s, t } : prev);
const TRY_DIM = 0.3;

export const CORNER_KEYFRAMES: Record<string, Reducer> = {
  // mirror_corner
  show_points: (s, t) => ({ ...s, show: t }),
  reflect_p: (s, t, card) => ({ ...s, first: t, caption: caption(step(card, 0), t, s.caption) }),
  reflect_q: (s, t, card) => ({ ...s, second: t, caption: caption(step(card, 1), t, s.caption) }),
  mark_touch: (s, t, card) => ({ ...s, touch: t, caption: caption(step(card, 3), t, s.caption) }),
  // river_bridge
  show_river: (s, t) => ({ ...s, show: t }),
  try_reflect: (s, t) => ({ ...s, tryPath: Math.min(1, t / 0.7), tryDim: t <= 0.7 ? 1 : 1 - ((t - 0.7) / 0.3) * (1 - TRY_DIM) }),
  // A pulse that settles at 0.6, so the width stays marked.
  flash_double_width: (s, t) => ({ ...s, first: t < 0.5 ? t * 2 : 1 - (t - 0.5) * 0.8 }),
  shift_q: (s, t, card) => ({ ...s, second: t, caption: caption(step(card, 0), t, s.caption) }),
  // both
  draw_straight: (s, t, card) => ({ ...s, straight: t, caption: caption(step(card, card.problem.figure.type === 'mirror_corner' ? 2 : 1), t, s.caption) }),
  show_answer: (s, t, card) => ({ ...s, touch: Math.max(s.touch, t), answer: t, caption: caption(result(card), 1, s.caption) }),
};

const warned = new Set<string>();

export function cornerState(keyframes: string[], k: number, t: number, card: LensCard): CornerState {
  let state: CornerState = { show: 0, tryPath: 0, tryDim: 1, first: 0, second: 0, straight: 0, touch: 0, answer: 0, caption: null };
  const last = Math.min(Math.max(0, k), keyframes.length - 1);
  for (let i = 0; i <= last; i++) {
    const name = keyframes[i]!;
    const reducer = CORNER_KEYFRAMES[name];
    if (!reducer) {
      if (!warned.has(name)) {
        warned.add(name);
        console.warn(`LensScene: unknown corner/bridge keyframe "${name}"; showing the end state of the keyframe before it.`);
      }
      continue;
    }
    state = reducer(state, i === last ? t : 1, card);
  }
  return state;
}
