// Word-problem diagrams (WO-006): which keyframes each diagram has, which lens step each one
// captions, and reading a step's result number from its text. Nothing here computes a printed number.
import type { LensCard, Step, WordDiagramSpec, WordFamily, WordProblemFigure } from './types';

/** The number right after the last 「=」 in a step's text, e.g. "640−200 = 440 が…" → "440". */
export function afterEquals(step: Step | undefined): string | null {
  if (!step) return null;
  const src = step.ja_orig ?? step.ja;
  const i = src.lastIndexOf('=');
  if (i < 0) return null;
  return /[\d.]+(?:\/\d+)?/.exec(src.slice(i + 1))?.[0] ?? null;
}

/** Lens step (index into lens_route.steps) captioned at each diagram keyframe, by diagram family (WO-015). */
export const WORD_CAPTIONS: Partial<Record<WordFamily, Record<string, number>>> = {
  area_two_rect: { draw_rectangles: 0, assume_all_b: 1, show_gap_strip: 2, divide_strip: 3 },
  area_average: { draw_rectangles: 0, draw_average_line: 1, show_excess: 1, fill_dent: 2, divide_dent: 3 },
  area_shortfall: { draw_plan_a: 0, draw_plan_b: 0, show_gap: 1, divide_gap: 2 },
  diff_bars: { mark_difference: 0, grow_bars: 0, shrink_bars: 0, draw_money_bars: 0, split_difference: 1 },
  lever: { place_strengths: 0, mark_arms: 1, invert_ratio: 2 },
  road: { draw_road: 1, freeze_one: 0, combine_speeds: 0 },
};

/**
 * Diagrams the shared scenes can draw today. The water/salt lever (p2 = 0 or 100) and the chase road
 * arrive with WO-017; `steps_only` has no diagram (walkthrough, WO-016).
 */
const DIAGRAM_READY: Partial<Record<WordFamily, (d: WordDiagramSpec) => boolean>> = {
  area_two_rect: () => true,
  area_average: () => true,
  area_shortfall: () => true,
  diff_bars: () => true,
  lever: (d) => d.family === 'lever' && d.p2 > 0 && d.p2 < 100,
  road: (d) => d.family === 'road' && d.mode !== 'chase',
};

/** The figure's diagram family, or null when it has none the shared scenes can draw. */
export function wordFamily(fig: WordProblemFigure): WordFamily | null {
  const d = fig.diagram;
  return d && DIAGRAM_READY[d.family]?.(d) ? d.family : null;
}

/** The captions for a figure's diagram keyframes (empty when it has no drawable diagram). */
export function wordCaptions(fig: WordProblemFigure): Record<string, number> {
  const f = wordFamily(fig);
  return (f && WORD_CAPTIONS[f]) ?? {};
}

/** Every number right after a 「=」, e.g. "8−5 = 3 と 10−8 = 2" → ["3", "2"]. */
export function allAfterEquals(step: Step | undefined): string[] {
  if (!step) return [];
  return [...step.ja.matchAll(/=\s*([\d.]+(?:\/\d+)?)/g)].map((m) => m[1]!);
}

/** The last ratio "a:b" in a step's text, e.g. "…逆の比 2:3" → ["2", "3"]. */
export function ratioIn(step: Step | undefined): [string, string] | null {
  const all = step ? [...step.ja.matchAll(/([\d.]+)\s*[:：]\s*([\d.]+)/g)] : [];
  const m = all[all.length - 1];
  return m ? [m[1]!, m[2]!] : null;
}

/** The first "a+b = c"-style expression in a step's text, e.g. "…1分に 80+70 = 150m…" → "80+70 = 150". */
export function expressionIn(step: Step | undefined): string | null {
  return step ? (/[\d.]+(?:\s*[+−×÷]\s*[\d.]+)+\s*=\s*[\d.]+/.exec(step.ja_orig ?? step.ja)?.[0] ?? null) : null;
}

/** Keyframes that are diagram steps (everything between the story and the answer). */
export function diagramKeyframes(card: LensCard): string[] {
  return (card.animation?.keyframes ?? []).filter((k) => k !== 'show_story' && k !== 'show_answer');
}

/** The answer as a number, for drawing sizes only (it is printed from the bundle, never from this). */
export function answerNumber(card: LensCard): number {
  const v = card.answer.value;
  const [n, d] = v.split('/');
  return Number(n) / (d ? Number(d) : 1);
}
