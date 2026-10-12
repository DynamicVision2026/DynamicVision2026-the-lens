// Drawing geometry for a parallel_band figure: positions only. Lengths shown on screen come from
// the bundle (figure.total_base, figure.band_height); nothing here measures or subtracts them.
import type { ParallelBandFigure } from './types';

export interface BandLayout {
  /** SVG x for a figure x. */
  x: (v: number) => number;
  /** SVG y of ℓ (top) and m (bottom). */
  lY: number;
  mY: number;
  /** Where the two lines are drawn (full width of the region). */
  lineLeft: number;
  lineRight: number;
  scale: number;
}

/** Uniform scale (so the figure keeps its true shape), centred in the region x, y, w, h. */
export function bandLayout(fig: ParallelBandFigure, x: number, y: number, w: number, h: number, inset: number): BandLayout {
  const xs = [...fig.bottom_x, ...fig.apex_x];
  const minX = Math.min(...xs);
  const span = Math.max(1e-9, Math.max(...xs) - minX);
  const scale = Math.min((w - 2 * inset) / span, h / fig.band_height);
  const left = x + (w - span * scale) / 2;
  const height = fig.band_height * scale;
  const lY = y + (h - height) / 2;
  return { x: (v) => left + (v - minX) * scale, lY, mY: lY + height, lineLeft: x, lineRight: x + w, scale };
}

/** Where every apex slides to: the first apex (the spec's default meeting point). */
export function meetingX(fig: ParallelBandFigure): number {
  return fig.apex_x[0]!;
}

/** Apex i's x after sliding a fraction `slid` of the way to the meeting point. */
export function apexXAt(fig: ParallelBandFigure, i: number, slid: number): number {
  const from = fig.apex_x[i]!;
  return from + (meetingX(fig) - from) * slid;
}

/** Number of triangles in the band (one per apex). */
export function bandTriangles(fig: ParallelBandFigure): number {
  return Math.min(fig.apex_x.length, fig.bottom_x.length - 1);
}
