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
  /** SVG y of ℓ at an SVG x: lY, or on the tilted ℓ of a non-parallel figure (WO-018). */
  lAt: (sx: number) => number;
}

/** How a band figure reads (the validator's band_mode): WO-018 adds one triangle, a tilted ℓ and the asked gap. */
export type BandMode = 'standard' | 'single' | 'nonparallel' | 'ask_height';

export function bandMode(fig: ParallelBandFigure): BandMode {
  if (fig.apex_heights?.length) return 'nonparallel';
  if (fig.ask === 'band_height') return 'ask_height';
  if (fig.apex_x.length === 1) return 'single';
  return 'standard';
}

/** Uniform scale (so the figure keeps its true shape), centred in the region x, y, w, h. */
export function bandLayout(fig: ParallelBandFigure, x: number, y: number, w: number, h: number, inset: number): BandLayout {
  const xs = [...fig.bottom_x, ...fig.apex_x];
  const minX = Math.min(...xs);
  const span = Math.max(1e-9, Math.max(...xs) - minX);
  const tall = Math.max(fig.band_height, ...(fig.apex_heights ?? []));
  const scale = Math.min((w - 2 * inset) / span, h / tall);
  const left = x + (w - span * scale) / 2;
  const height = tall * scale;
  const lY = y + (h - height) / 2;
  const mY = lY + height;
  const X = (v: number) => left + (v - minX) * scale;
  const hs = fig.apex_heights;
  // A tilted ℓ (WO-018): the straight line through the first and the last apex at their given heights.
  let lAt = (_sx: number) => lY;
  if (hs?.length) {
    const n = Math.min(hs.length, fig.apex_x.length);
    const [x0, y0] = [X(fig.apex_x[0]!), mY - hs[0]! * scale];
    const [x1, y1] = [X(fig.apex_x[n - 1]!), mY - hs[n - 1]! * scale];
    const k = x1 === x0 ? 0 : (y1 - y0) / (x1 - x0);
    lAt = (sx) => y0 + (sx - x0) * k;
  }
  return { x: X, lY, mY, lineLeft: x, lineRight: x + w, scale, lAt };
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
