// Enclose keyframes (WO-002). Each reducer sets its own end state at t = 1.
import { stagger } from '../easing';
import type { Step } from '../types';
import { initialState, type KeyframeReducer, type SceneContext, type SceneState } from './state';

export * from './state';

const firstStep = (steps: Step[], op: Step['op']) => steps.find((s) => s.op === op);

function caption(step: Step | undefined, t: number, size: 'step' | 'title' = 'step'): SceneState['caption'] {
  return step ? { text: step.ja, t, size } : null;
}

const fill = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i));

const boxCaption = (ctx: SceneContext) =>
  ctx.card.kind === 'failure' ? firstStep(ctx.card.trap_route.steps, 'start') : firstStep(ctx.card.lens_route.steps, 'start');

export const KEYFRAMES: Record<string, KeyframeReducer> = {
  show_shape: (s, t) => ({ ...s, shape: t }),

  draw_box: (s, t, ctx) => ({ ...s, box: t, boxFade: 1, caption: caption(boxCaption(ctx), t) }),

  shade_corners: (s, t, ctx) => ({ ...s, gapShade: fill(ctx.gaps.length, (i) => stagger(t, i, ctx.gaps.length)) }),

  label_corners: (s, t, ctx) => ({
    ...s,
    gapLabel: fill(ctx.gaps.length, (i) => stagger(t, i, ctx.gaps.length)),
    caption: null,
  }),

  subtract: (s, t, ctx) => ({ ...s, caption: caption(firstStep(ctx.card.lens_route.steps, 'result'), t) }),

  show_answer: (s, t, ctx) => ({
    ...s,
    answerTint: t,
    answer: t,
    caption: caption(firstStep(ctx.card.lens_route.steps, 'result'), 1),
  }),

  flash_irregular_gap: (s, t, ctx) => ({
    ...s,
    irregularGap: t,
    caption: caption(ctx.card.trap_route.steps.find((step) => step.op === 'note'), t),
  }),

  undo_box: (s, t) => ({ ...s, boxFade: 1 - t, caption: s.caption && { ...s.caption, t: 1 - t } }),

  draw_cut_line: (s, t, ctx) => ({ ...s, cut: t, caption: caption(firstStep(ctx.card.lens_route.steps, 'start'), t) }),

  shade_pieces: (s, t, ctx) => {
    const n = ctx.pieces?.length ?? 0;
    return { ...s, pieces: fill(n, (i) => stagger(t, i, n)), caption: null };
  },

  highlight_base: (s, t, ctx) => ({ ...s, base: t, caption: caption(ctx.card.lens_route.steps[0], t) }),

  drop_height: (s, t, ctx) => ({ ...s, height: t, caption: caption(ctx.card.lens_route.steps[1], t) }),

  ghost_box_struck_out: (s, t) => ({ ...s, ghostBox: t }),
  // WO-020 coord_polygon (axis_base, the no-lens card): the same beats under their Stage 2 names.
  show_grid: (s, t) => ({ ...s, shape: t }),
  base_on_axis: (s, t, ctx) => ({ ...s, base: t, caption: caption(ctx.card.lens_route.steps[0], t) }),
  height: (s, t, ctx) => ({ ...s, height: t, caption: caption(ctx.card.lens_route.steps[1], t) }),
};

const warned = new Set<string>();

/** Warns once per unknown keyframe name. Output never depends on this. */
function warnUnknown(name: string) {
  if (warned.has(name)) return;
  warned.add(name);
  console.warn(`LensScene: unknown keyframe "${name}"; showing the end state of the keyframe before it.`);
}

/** The scene state at keyframe index `k` and progress `t` (already eased). */
export function sceneState(keyframes: string[], k: number, t: number, ctx: SceneContext): SceneState {
  let state = initialState();
  const last = Math.min(Math.max(0, k), keyframes.length - 1);
  for (let i = 0; i <= last; i++) {
    const name = keyframes[i]!;
    const reducer = KEYFRAMES[name];
    if (!reducer) {
      warnUnknown(name);
      continue;
    }
    state = reducer(state, i === last ? t : 1, ctx);
  }
  return state;
}
