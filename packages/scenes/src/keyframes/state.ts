import type { LensCard, Point, Step } from '../types';

/**
 * Everything a scene can show. Keyframes are reducers over this state, so the frame at
 * (keyframe k, t) is: every keyframe before k at t = 1, then keyframe k at t.
 */
export interface SceneState {
  shape: number;
  box: number;
  boxFade: number;
  gapShade: number[];
  gapLabel: number[];
  irregularGap: number;
  cut: number;
  pieces: number[];
  answerTint: number;
  base: number;
  height: number;
  ghostBox: number;
  /** Caption shown in the text band under the figure, with its fade-in progress. */
  caption: { text: string; t: number; size: 'step' | 'title' } | null;
  answer: number;
}

export function initialState(): SceneState {
  return {
    shape: 0,
    box: 0,
    boxFade: 1,
    gapShade: [],
    gapLabel: [],
    irregularGap: 0,
    cut: 0,
    pieces: [],
    answerTint: 0,
    base: 0,
    height: 0,
    ghostBox: 0,
    caption: null,
    answer: 0,
  };
}

/** Card data a keyframe may read, already derived once per render. */
export interface SceneContext {
  card: LensCard;
  points: Point[];
  gaps: Point[][];
  /** `sub` steps of the lens route, matched to gaps in order. */
  gapSteps: Step[];
  pieces: Point[][] | null;
  /** start/add steps of the lens route, matched to pieces in order. */
  pieceSteps: Step[];
}

export type KeyframeReducer = (state: SceneState, t: number, ctx: SceneContext) => SceneState;
