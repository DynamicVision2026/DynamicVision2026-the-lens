// Drawing geometry for the Stage 2 coordinate figures (WO-020): positions only. Printed numbers come
// from the figure fields (the given coordinates), the steps or the answer.
import { makeFrame, type Frame } from './primitives/frame';
import type { Point } from './types';

export interface CoordFrame {
  frame: Frame;
  /** Lattice x0, y0 of the grid's bottom-left corner (the grid is drawn from 0). */
  x0: number;
  y0: number;
  /** A coordinate point in grid units (what the grid primitives expect). */
  g: (p: Point) => Point;
  /** A coordinate point in SVG units. */
  at: (p: Point) => [number, number];
}

/** A grid that holds every point and the origin, with `pad` free lattice cells around them. */
export function coordFrame(points: Point[], x: number, y: number, w: number, h: number, pad = 1): CoordFrame {
  const xs = [0, ...points.map((p) => p[0])];
  const ys = [0, ...points.map((p) => p[1])];
  const x0 = Math.floor(Math.min(...xs)) - pad;
  const y0 = Math.floor(Math.min(...ys)) - pad;
  const x1 = Math.ceil(Math.max(...xs)) + pad;
  const y1 = Math.ceil(Math.max(...ys)) + pad;
  const frame = makeFrame({ width: x1 - x0, height: y1 - y0, cell_cm: 1 }, x, y, w, h);
  const g = (p: Point): Point => [p[0] - x0, p[1] - y0];
  const at = (p: Point): [number, number] => {
    const [gx, gy] = g(p);
    return [frame.left + gx * frame.cell, frame.top + (frame.grid.height - gy) * frame.cell];
  };
  return { frame, x0, y0, g, at };
}

/** A coordinate as printed in the problem: 「(−2, 0)」, with a true minus sign. */
export function coordText(p: Point): string {
  const n = (v: number) => (v < 0 ? `−${-v}` : String(v));
  return `(${n(p[0])}, ${n(p[1])})`;
}

/** Where the line through a and b crosses y = 0 (drawing only). */
export function crossXAxis(a: Point, b: Point): number {
  return a[0] + ((b[0] - a[0]) * a[1]) / (a[1] - b[1]);
}

/** Where the line through c with the direction of a→b crosses x = 0 (drawing only). */
export function parallelAtYAxis(a: Point, b: Point, c: Point): number {
  return b[0] === a[0] ? c[1] : c[1] - ((b[1] - a[1]) / (b[0] - a[0])) * c[0];
}
