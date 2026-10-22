// WO-020 keyframes for triangle_cevians (Stage 3 てんびん, mass points). Each reducer sets its end state at t = 1.
import type { LensCard, Step } from '../types';

export interface CeviansState {
  show: number;
  wbc: number;
  wca: number;
  balance: number;
  on: 'AD' | 'BE';
  height: number;
  base: number;
  ghost: number;
  answer: number;
  caption: { step: Step; t: number } | null;
}

type Reducer = (s: CeviansState, t: number, card: LensCard) => CeviansState;

const steps = (card: LensCard) => card.lens_route.steps;
const result = (card: LensCard) => steps(card).find((s) => s.op === 'result');
const caption = (s: Step | undefined, t: number, prev: CeviansState['caption']) => (s ? { step: s, t } : prev);
/** The step where the weights are put on one scale (「A:B:C＝…」), else the CA step. */
const scaleStep = (card: LensCard) => steps(card).find((s) => /A\s*[:：]\s*B\s*[:：]\s*C/.test(s.ja_orig ?? s.ja)) ?? steps(card)[1];
const gatherStep = (card: LensCard) => steps(card).find((s) => /集まる/.test(s.ja_orig ?? s.ja));

export const CEVIANS_KEYFRAMES: Record<string, Reducer> = {
  show_triangle: (s, t) => ({ ...s, show: t }),
  weights_bc: (s, t, card) => ({ ...s, wbc: t, caption: caption(steps(card)[0], t, s.caption) }),
  weights_ca: (s, t, card) => ({ ...s, wca: t, caption: caption(scaleStep(card), t, s.caption) }),
  balance_ad: (s, t, card) => ({ ...s, balance: t, on: 'AD', caption: caption(gatherStep(card), t, s.caption) }),
  balance_be: (s, t, card) => ({ ...s, balance: t, on: 'BE', caption: caption(gatherStep(card), t, s.caption) }),
  same_height: (s, t, card) => ({ ...s, height: t, caption: caption(steps(card)[0], t, s.caption) }),
  base_ratio: (s, t, card) => ({ ...s, base: t, caption: caption(result(card), t, s.caption) }),
  ghost_weights_struck_out: (s, t) => ({ ...s, ghost: t }),
  show_answer: (s, t, card) => ({ ...s, answer: t, caption: caption(result(card), 1, s.caption) }),
};

const warned = new Set<string>();

export function ceviansState(keyframes: string[], k: number, t: number, card: LensCard): CeviansState {
  let state: CeviansState = { show: 0, wbc: 0, wca: 0, balance: 0, on: 'AD', height: 0, base: 0, ghost: 0, answer: 0, caption: null };
  const last = Math.min(Math.max(0, k), keyframes.length - 1);
  for (let i = 0; i <= last; i++) {
    const name = keyframes[i]!;
    const reducer = CEVIANS_KEYFRAMES[name];
    if (!reducer) {
      if (!warned.has(name)) {
        warned.add(name);
        console.warn(`LensScene: unknown cevians keyframe "${name}"; showing the end state of the keyframe before it.`);
      }
      continue;
    }
    state = reducer(state, i === last ? t : 1, card);
  }
  return state;
}
