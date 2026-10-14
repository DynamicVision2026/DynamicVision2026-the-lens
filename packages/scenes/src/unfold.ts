// Drawing geometry for a box_unfold figure: positions only. Printed lengths come from the figure
// fields (a, b, h, net_width) and the steps; P is placed at the card's answer value (BP).
import { touchX } from './mirror';
import type { BoxUnfoldFigure, LensCard } from './types';

/**
 * Where P sits on BF (BP): the card's answer, except when the card asks for the string's length
 * (`ask: length`, WO-023), where P is just where the straight A→G crosses BF on the net (drawing only).
 */
export function unfoldP(card: LensCard): number {
  const fig = card.problem.figure as BoxUnfoldFigure;
  return fig.ask === 'length' ? (fig.h * fig.a) / (fig.a + fig.b) : touchX(card);
}

/** The receding edges of the cabinet projection: half length, at this angle. */
const DEPTH_SCALE = 0.5;
const DEPTH_ANGLE = (35 * Math.PI) / 180;

export interface UnfoldLayout {
  /** SVG coordinates for a point (x to the right from A, y up from A) in figure units. */
  at: (x: number, y: number) => [number, number];
  /** The receding direction (figure units per unit of depth) with face BCGF opened by u (0 box – 1 flat net). */
  depth: (u: number) => [number, number];
  scale: number;
}

/**
 * One uniform scale that fits both the box and the flat net (a + b wide), so nothing jumps while
 * the face swings open. `bottomRoom` is kept free below AB for the brackets.
 */
export function unfoldLayout(fig: BoxUnfoldFigure, x: number, y: number, w: number, h: number, inset: number, bottomRoom: number): UnfoldLayout {
  const rise = fig.b * DEPTH_SCALE * Math.sin(DEPTH_ANGLE);
  const width = Math.max(fig.a + fig.b, fig.a + fig.b * DEPTH_SCALE * Math.cos(DEPTH_ANGLE));
  const scale = Math.min((w - 2 * inset) / width, (h - bottomRoom - inset) / (fig.h + rise));
  const left = x + (w - width * scale) / 2;
  const top = y + inset + (h - bottomRoom - inset - (fig.h + rise) * scale) / 2;
  const base = top + (fig.h + rise) * scale;
  return {
    at: (px, py) => [left + px * scale, base - py * scale],
    depth: (u) => {
      const k = DEPTH_SCALE + (1 - DEPTH_SCALE) * u;
      const angle = DEPTH_ANGLE * (1 - u);
      return [k * Math.cos(angle), k * Math.sin(angle)];
    },
    scale,
  };
}
