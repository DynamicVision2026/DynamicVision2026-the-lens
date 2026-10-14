// WO-020 keyframes for coord_equal_area (Slide on the plane) and coord_mirror_area (Mirror, then the
// chained Enclose). Each reducer sets its end state at t = 1.
import type { LensCard, Step } from '../types';

export interface CoordPlaneState {
  show: number;
  /** coord_equal_area: the parallel through C; coord_mirror_area: B reflected to B′. */
  first: number;
  /** coord_equal_area: C sliding to P; coord_mirror_area: the straight line A→B′. */
  second: number;
  /** coord_mirror_area: P marked and the real path A→P→B. */
  mark: number;
  /** coord_mirror_area (chained): the enclosing box and its corners on △ABP. */
  box: number;
  corners: number;
  /** The no-lens card's struck-out reflection. */
  ghost: number;
  answer: number;
  caption: { step: Step; t: number } | null;
}

type Reducer = (s: CoordPlaneState, t: number, card: LensCard) => CoordPlaneState;

const steps = (card: LensCard) => card.lens_route.steps;
const result = (card: LensCard) => steps(card).find((s) => s.op === 'result');
const caption = (s: Step | undefined, t: number, prev: CoordPlaneState['caption']) => (s ? { step: s, t } : prev);
/** The step that says where the straight line meets the axis: the last note before the box / the result. */
const straightStep = (card: LensCard) => steps(card).filter((s) => s.op === 'note').slice(-1)[0];

export const COORD_KEYFRAMES: Record<string, Reducer> = {
  show_shape: (s, t) => ({ ...s, show: t }),
  show_points: (s, t) => ({ ...s, show: t }),
  // coord_equal_area
  draw_parallel: (s, t, card) => ({ ...s, first: t, caption: caption(steps(card)[0], t, s.caption) }),
  slide_vertex: (s, t, card) => ({ ...s, second: t, caption: caption(straightStep(card), t, s.caption) }),
  // coord_mirror_area
  reflect_b: (s, t, card) => ({ ...s, first: t, caption: caption(steps(card)[0], t, s.caption) }),
  draw_straight: (s, t, card) => ({ ...s, second: t, caption: caption(steps(card)[card.problem.figure.type === 'coord_mirror_area' && (card.problem.figure as { side?: string }).side === 'opposite' ? 0 : 1], t, s.caption) }),
  mark_p: (s, t) => ({ ...s, mark: t }),
  draw_box: (s, t, card) => ({ ...s, box: t, caption: caption(steps(card).find((x) => x.op === 'start'), t, s.caption) }),
  shade_corners: (s, t, card) => ({ ...s, corners: t, caption: caption(steps(card).filter((x) => x.op === 'sub').slice(-1)[0], t, s.caption) }),
  ghost_reflect_struck_out: (s, t) => ({ ...s, ghost: t }),
  show_answer: (s, t, card) => ({ ...s, mark: Math.max(s.mark, t), answer: t, caption: caption(result(card), 1, s.caption) }),
};

const warned = new Set<string>();

export function coordPlaneState(keyframes: string[], k: number, t: number, card: LensCard): CoordPlaneState {
  let state: CoordPlaneState = { show: 0, first: 0, second: 0, mark: 0, box: 0, corners: 0, ghost: 0, answer: 0, caption: null };
  const last = Math.min(Math.max(0, k), keyframes.length - 1);
  for (let i = 0; i <= last; i++) {
    const name = keyframes[i]!;
    const reducer = COORD_KEYFRAMES[name];
    if (!reducer) {
      if (!warned.has(name)) {
        warned.add(name);
        console.warn(`LensScene: unknown coordinate keyframe "${name}"; showing the end state of the keyframe before it.`);
      }
      continue;
    }
    state = reducer(state, i === last ? t : 1, card);
  }
  return state;
}
