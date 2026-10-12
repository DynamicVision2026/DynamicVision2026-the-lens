// Word-problem keyframes (WO-006): each keyframe is a stage of the diagram, so the state is simply
// the progress of every keyframe so far, plus the story highlight, the caption and the answer.
import type { LensCard, Step, WordProblemFigure } from '../types';
import { WORD_CAPTIONS } from '../wordProblem';

export interface WordState {
  story: number;
  prog: Record<string, number>;
  caption: { step: Step; t: number } | null;
  answer: number;
}

export function wordState(keyframes: string[], k: number, t: number, card: LensCard, fig: WordProblemFigure): WordState {
  const last = Math.min(Math.max(0, k), keyframes.length - 1);
  const state: WordState = { story: 0, prog: {}, caption: null, answer: 0 };
  for (let i = 0; i <= last; i++) {
    const name = keyframes[i]!;
    const p = i === last ? t : 1;
    if (name === 'show_story') state.story = p;
    else if (name === 'show_answer') {
      state.answer = p;
      const result = card.lens_route.steps.find((s) => s.op === 'result');
      if (result) state.caption = { step: result, t: 1 };
    } else {
      state.prog[name] = p;
      const c = WORD_CAPTIONS[fig.kind][name];
      const step = c === undefined ? undefined : card.lens_route.steps[c];
      if (step) state.caption = { step, t: p };
    }
  }
  return state;
}
