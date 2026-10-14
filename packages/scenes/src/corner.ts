// Drawing geometry for the WO-018 折り返す figures (mirror_corner, river_bridge): positions only.
// Printed lengths come from the figure fields; the touch point / the bridge is placed at the card's
// answer, never computed.
import type { MirrorCornerFigure, RiverBridgeFigure } from './types';

export interface PlaneLayout {
  /** SVG coordinates for a figure point (y up). */
  at: (x: number, y: number) => [number, number];
  scale: number;
  /** The region's edges in figure units, for lines drawn across it. */
  x0: number;
  x1: number;
}

/** Uniform scale (true shape) fitting [xmin, xmax] × [ymin, ymax], centred in the region. */
export function planeLayout(xmin: number, xmax: number, ymin: number, ymax: number, x: number, y: number, w: number, h: number, inset: number): PlaneLayout {
  const scale = Math.min((w - 2 * inset) / Math.max(1e-9, xmax - xmin), (h - 2 * inset) / Math.max(1e-9, ymax - ymin));
  const left = x + (w - (xmax - xmin) * scale) / 2;
  const top = y + (h - (ymax - ymin) * scale) / 2;
  return { at: (px, py) => [left + (px - xmin) * scale, top + (ymax - py) * scale], scale, x0: xmin - (left - x) / scale, x1: xmin + (x + w - left) / scale };
}

/** mirror_corner: O at the origin, m up the y-axis, ℓ along the x-axis; room for P′ (left) and Q′ (below). */
export function cornerLayout(fig: MirrorCornerFigure, x: number, y: number, w: number, h: number, inset: number): PlaneLayout {
  const [px, py] = fig.P;
  const [qx, qy] = fig.Q;
  return planeLayout(-px, Math.max(px, qx), -qy, Math.max(py, qy), x, y, w, h, inset);
}

/** river_bridge: north bank y = 0, south bank y = −w; A at x = 0, B at x = ab. */
export function bridgeLayout(fig: RiverBridgeFigure, x: number, y: number, w: number, h: number, inset: number): PlaneLayout {
  return planeLayout(0, fig.ab, -fig.w - fig.qb, fig.pa, x, y, w, h, inset);
}
