// WO-023 keyframes for the Stage 3 figure types. Every type has the same shape: show the figure, a first lens
// move, a second lens move, the answer. Each reducer sets its end state at t = 1.
import type { LensCard, Step } from '../types';

export interface Stage3State {
  show: number;
  /** mark_crossings, draw_parallel, reflect_point, freeze_param, open_sector, shade_cells, split_centre. */
  first: number;
  /** shade_region, slide_vertex, draw_straight, solve_both, count_cells. */
  second: number;
  answer: number;
  caption: { step: Step; t: number } | null;
}

type Reducer = (s: Stage3State, t: number, card: LensCard) => Stage3State;

const steps = (card: LensCard) => card.lens_route.steps;
const result = (card: LensCard) => steps(card).find((s) => s.op === 'result');
const caption = (s: Step | undefined, t: number, prev: Stage3State['caption']) => (s ? { step: s, t } : prev);
const show: Reducer = (s, t) => ({ ...s, show: t });
const first: Reducer = (s, t, card) => ({ ...s, first: t, caption: caption(steps(card)[0], t, s.caption) });
const second: Reducer = (s, t, card) => ({ ...s, second: t, caption: caption(steps(card)[1], t, s.caption) });

export const STAGE3_KEYFRAMES: Record<string, Reducer> = {
  show_graph: show,
  show_family: show,
  show_cone: show,
  show_grid: show,
  show_sum: show,
  mark_crossings: first,
  draw_parallel: first,
  reflect_point: first,
  freeze_param: first,
  open_sector: first,
  shade_cells: first,
  split_centre: first,
  shade_region: second,
  slide_vertex: second,
  draw_straight: second,
  solve_both: second,
  count_cells: second,
  show_answer: (s, t, card) => ({ ...s, answer: t, caption: caption(result(card), 1, s.caption) }),
};

const warned = new Set<string>();

export function stage3State(keyframes: string[], k: number, t: number, card: LensCard): Stage3State {
  let state: Stage3State = { show: 0, first: 0, second: 0, answer: 0, caption: null };
  const last = Math.min(Math.max(0, k), keyframes.length - 1);
  for (let i = 0; i <= last; i++) {
    const name = keyframes[i]!;
    const reducer = STAGE3_KEYFRAMES[name];
    if (!reducer) {
      if (!warned.has(name)) {
        warned.add(name);
        console.warn(`LensScene: unknown Stage 3 keyframe "${name}"; showing the end state of the keyframe before it.`);
      }
      continue;
    }
    state = reducer(state, i === last ? t : 1, card);
  }
  return state;
}
