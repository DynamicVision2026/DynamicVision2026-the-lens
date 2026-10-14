// WO-020: the coordinate plane the Stage 2 scenes play on. Positions only: the grid fits the given points
// and the origin; the tick numbers are the axes' scale, every printed answer comes from the card.
import type { Point } from '@lens/scenes';
import { C, Txt } from './kit';

export interface Plane {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  s: number;
  X: (x: number) => number;
  Y: (y: number) => number;
  /** Inverse of X / Y, for pointer positions. */
  ux: (px: number) => number;
  uy: (py: number) => number;
}

/** A plane holding every point and the origin with one free cell around, fitted into w × h (y up). */
export function plane(points: Point[], w = 600, h = 440, margin = 36): Plane {
  const xs = [0, ...points.map((p) => p[0])];
  const ys = [0, ...points.map((p) => p[1])];
  const x0 = Math.floor(Math.min(...xs)) - 1;
  const x1 = Math.ceil(Math.max(...xs)) + 1;
  const y0 = Math.floor(Math.min(...ys)) - 1;
  const y1 = Math.ceil(Math.max(...ys)) + 1;
  const s = Math.min((w - 2 * margin) / (x1 - x0), (h - 2 * margin) / (y1 - y0));
  const ox = (w - (x1 - x0) * s) / 2 - x0 * s;
  const oy = (h + (y1 - y0) * s) / 2 + y0 * s;
  return { x0, y0, x1, y1, s, X: (x) => ox + x * s, Y: (y) => oy - y * s, ux: (px) => (px - ox) / s, uy: (py) => (oy - py) / s };
}

const minus = (v: number) => (v < 0 ? `−${-v}` : String(v));

/** 「A(−2, 0)」 */
export const coordLabel = (name: string, p: Point) => `${name}(${minus(p[0])}, ${minus(p[1])})`;

/**
 * Where a vertex label goes: outside the figure (away from `centre`), and never on the tick numbers or
 * the axes (WO-020 polish: 「A(−4, −1)」 sat on the 「−4」 tick).
 */
export function labelAt(P: Plane, q: Point, centre: Point, text: string): { x: number; y: number; anchor: 'start' | 'end' } {
  const w = text.length * 8;
  const right = q[0] >= centre[0];
  let x = P.X(q[0]) + (right ? 10 : -10);
  let y = P.Y(q[1]) + (q[1] >= centre[1] ? -12 : 24);
  const axisY = P.Y(0);
  // Below the x-axis are its tick numbers (to about +24): keep clear of the axis and that band.
  if (y > axisY - 6 && y < axisY + 30) y = q[1] >= 0 ? axisY - 10 : axisY + 42;
  // Left of the y-axis are its tick numbers (about 26 wide): move the label off that column.
  const [x0, x1] = right ? [x, x + w] : [x - w, x];
  const axisX = P.X(0);
  if (x1 > axisX - 28 && x0 < axisX + 4) {
    if (right) x = axisX + 8;
    else x = axisX - 30;
  }
  return { x, y, anchor: right ? 'start' : 'end' };
}

/** Grid lines, the x/y axes through the origin and their tick numbers (every 2 when cells are small; odd ones hide on a phone). */
export function CoordPlane({ P }: { P: Plane }) {
  const { x0, x1, y0, y1, X, Y, s } = P;
  const every = s < 26 ? 2 : 1;
  const xs = Array.from({ length: x1 - x0 + 1 }, (_, i) => x0 + i);
  const ys = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i);
  return (
    <g className="coord-plane">
      {xs.map((x) => (
        <line key={`v${x}`} x1={X(x)} y1={Y(y0)} x2={X(x)} y2={Y(y1)} stroke={C.gridMinor} strokeWidth={1} />
      ))}
      {ys.map((y) => (
        <line key={`h${y}`} x1={X(x0)} y1={Y(y)} x2={X(x1)} y2={Y(y)} stroke={C.gridMinor} strokeWidth={1} />
      ))}
      <line x1={X(x0)} y1={Y(0)} x2={X(x1)} y2={Y(0)} stroke={C.ink} strokeWidth={2} />
      <line x1={X(0)} y1={Y(y0)} x2={X(0)} y2={Y(y1)} stroke={C.ink} strokeWidth={2} />
      {xs
        .filter((x) => x !== 0 && x > x0 && x < x1 && x % every === 0)
        .map((x) => (
          <Txt key={`nx${x}`} className={`tick${x % 2 ? ' odd' : ''}`} x={X(x)} y={Y(0) + 17} size={12} fill={C.quiet} strokeWidth={3} fontWeight={500}>
            {minus(x)}
          </Txt>
        ))}
      {ys
        .filter((y) => y !== 0 && y > y0 && y < y1 && y % every === 0)
        .map((y) => (
          <Txt key={`ny${y}`} className={`tick${y % 2 ? ' odd' : ''}`} x={X(0) - 14} y={Y(y) + 4} size={12} fill={C.quiet} strokeWidth={3} fontWeight={500}>
            {minus(y)}
          </Txt>
        ))}
      <Txt x={X(0) - 12} y={Y(0) + 18} size={14} fill={C.quiet}>
        O
      </Txt>
      <Txt x={X(x1) - 8} y={Y(0) - 10} size={16} fill={C.ink} fontStyle="italic">
        x
      </Txt>
      <Txt x={X(0) + 12} y={Y(y1) + 14} size={16} fill={C.ink} fontStyle="italic">
        y
      </Txt>
    </g>
  );
}
