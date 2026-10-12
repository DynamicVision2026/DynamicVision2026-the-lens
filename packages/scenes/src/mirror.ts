// Drawing geometry for a mirror_path figure: positions only. Printed lengths come from the figure
// fields (pa, qb, ab) and the steps; the touch point X is placed at the card's answer value.
import { approxNumber } from './format';
import type { LensCard, MirrorPathFigure } from './types';

export interface MirrorLayout {
  /** SVG coordinates for a point (x along the river from A, y above the river). */
  at: (x: number, y: number) => [number, number];
  /** SVG y of the river, and where it is drawn (full width). */
  riverY: number;
  left: number;
  right: number;
  scale: number;
}

/** Uniform scale (true shape) for A..B horizontally, from the higher of P/Q down to Q′ vertically. */
export function mirrorLayout(fig: MirrorPathFigure, x: number, y: number, w: number, h: number, inset: number): MirrorLayout {
  const above = Math.max(fig.pa, fig.qb);
  const below = fig.qb;
  const scale = Math.min((w - 2 * inset) / fig.ab, h / (above + below));
  const left = x + (w - fig.ab * scale) / 2;
  const top = y + (h - (above + below) * scale) / 2;
  const riverY = top + above * scale;
  return { at: (px, py) => [left + px * scale, riverY - py * scale], riverY, left: x, right: x + w, scale };
}

/** AX from the card's answer (the validator proves it is the shortest-path touch point). */
export function touchX(card: LensCard): number {
  return approxNumber(card.answer.value) ?? 0;
}
