// WO-023: drawing geometry for the Stage 3 figure types (tools/stage3.py). Positions only: every printed
// number comes from the problem text, the figure fields, the lens steps or the answer.
import type { ConeUnfoldFigure, ConstSumFigure, DiceGridFigure, LineMirrorFigure, ParabolaAreaFigure, ParabolaTriFigure, ParamFamilyFigure, Point, Quadratic } from './types';

/** A field number: 2, -1 or "1/2". */
export function fieldNumber(v: number | string): number {
  if (typeof v === 'number') return v;
  const [n, d] = v.split('/').map(Number);
  return d ? n! / d : n!;
}

export const evalQ = (q: Quadratic, x: number) => fieldNumber(q[0]) * x * x + fieldNumber(q[1]) * x + fieldNumber(q[2]);

/** f − g as a quadratic (g absent: the x-axis). */
export function diffQ(f: Quadratic, g?: Quadratic): Quadratic {
  const gg = g ?? [0, 0, 0];
  return [fieldNumber(f[0]) - fieldNumber(gg[0]), fieldNumber(f[1]) - fieldNumber(gg[1]), fieldNumber(f[2]) - fieldNumber(gg[2])];
}

/** Real roots of a quadratic (or a line), sorted. */
export function rootsQ(q: Quadratic): number[] {
  const [a, b, c] = q.map(fieldNumber) as [number, number, number];
  if (Math.abs(a) < 1e-12) return Math.abs(b) < 1e-12 ? [] : [-c / b];
  const D = b * b - 4 * a * c;
  if (D < 0) return [];
  const r = [(-b - Math.sqrt(D)) / (2 * a), (-b + Math.sqrt(D)) / (2 * a)];
  return r.sort((u, v) => u - v);
}

/** The x-range the region spans: the crossings, or the given bounds. */
export function areaSpan(fig: ParabolaAreaFigure): [number, number] {
  if (fig.bounds) return [fig.bounds[0], fig.bounds[1]];
  const r = rootsQ(diffQ(fig.f, fig.g));
  return [r[0] ?? -1, r[1] ?? 1];
}

/** Points the plane must hold for a parabola_area figure. */
export function areaPoints(fig: ParabolaAreaFigure): Point[] {
  const [p, q] = areaSpan(fig);
  const curves = [fig.f, ...(fig.g ? [fig.g] : [])];
  const pts: Point[] = [];
  for (const c of curves) {
    pts.push([p, evalQ(c, p)], [q, evalQ(c, q)], [(p + q) / 2, evalQ(c, (p + q) / 2)]);
    const a = fieldNumber(c[0]);
    if (Math.abs(a) > 1e-12) {
      const vx = -fieldNumber(c[1]) / (2 * a);
      if (vx > p - 2 && vx < q + 2) pts.push([vx, evalQ(c, vx)]);
    }
  }
  pts.push([p - 1, 0], [q + 1, 0]);
  return pts;
}

/** parabola_tri: A, B, the tangent point (the middle), and P as the card places it (`px` from the answer). */
export function triPoints(fig: ParabolaTriFigure, answerX?: number) {
  const a = fieldNumber(fig.a);
  const at = (x: number): Point => [x, a * x * x];
  const A = at(fig.alpha);
  const B = at(fig.beta);
  const mid = (fig.alpha + fig.beta) / 2;
  let px = mid;
  if (fig.ask === 'equal_o') px = answerX ?? fig.alpha + fig.beta;
  else if (fig.ask === 'range_max' && fig.range) px = Math.abs(fig.range[0] - mid) < Math.abs(fig.range[1] - mid) ? fig.range[0] : fig.range[1];
  else if (fig.ask === 'px' && answerX !== undefined) px = answerX;
  return { a, at, A, B, P: at(px), mid: at(mid), slope: a * (fig.alpha + fig.beta) };
}

/** Reflection of p across y = mx + k. */
export function reflectAcross(line: [number, number], p: Point): Point {
  const [m, k] = line;
  const d = (m * p[0] - p[1] + k) / (m * m + 1);
  return [p[0] - 2 * m * d, p[1] + 2 * d];
}

const side = (line: [number, number], p: Point) => line[0] * p[0] - p[1] + line[1];

/** line_mirror: B′ (or B itself when no reflection is needed) and P where A→B′ (or line AB) meets ℓ. */
export function mirrorPoints(fig: LineMirrorFigure): { T: Point; P: Point; reflect: boolean } {
  const { A, B } = fig;
  const [m, k] = fig.line;
  const reflect = fig.ask !== 'max_diff' && side(fig.line, A) * side(fig.line, B) > 0;
  const T = reflect ? reflectAcross(fig.line, B) : B;
  const t = (m * A[0] + k - A[1]) / (T[1] - A[1] - m * (T[0] - A[0]));
  return { T, P: [A[0] + t * (T[0] - A[0]), A[1] + t * (T[1] - A[1])], reflect };
}

/** param_family at a given a: a line as [cx, cy, cc] (cx·x + cy·y + cc = 0), or a parabola as a Quadratic. */
export function familyMember(fig: ParamFamilyFigure, a: number): { line?: [number, number, number]; parabola?: Quadratic } {
  const lin = (c: number[]) => c[0]! * a + c[1]!;
  if (fig.family === 'line') return { line: [lin(fig.c[0]!), lin(fig.c[1]!), lin(fig.c[2]!)] };
  return { parabola: [1, lin(fig.c[0]!), lin(fig.c[1]!)] };
}

/** The two brackets of a(…) + (…) = 0: the a-part and the rest, each as a line or a curve (the fixed point is where they meet). */
export function familyBrackets(fig: ParamFamilyFigure): { aPart: { line?: [number, number, number]; parabola?: Quadratic }; rest: { line?: [number, number, number]; parabola?: Quadratic } } {
  if (fig.family === 'line') {
    const [c1, c2, c3] = fig.c as [number[], number[], number[]];
    return { aPart: { line: [c1[0]!, c2[0]!, c3[0]!] }, rest: { line: [c1[1]!, c2[1]!, c3[1]!] } };
  }
  const [cb, cc] = fig.c as [number[], number[]];
  // a(p·x + r) + (x² + q·x + s − y) = 0: the vertical line p·x + r = 0, and the parabola y = x² + q·x + s.
  return { aPart: { line: [cb[0]!, 0, cc[0]!] }, rest: { parabola: [1, cb[1]!, cc[1]!] } };
}

/** The fixed point (drawing only; it is printed from the answer). */
export function familyPoint(fig: ParamFamilyFigure): Point | null {
  if (fig.family === 'line') {
    const [[p1, q1], [p2, q2], [p3, q3]] = fig.c as [[number, number], [number, number], [number, number]];
    const det = p1 * q2 - p2 * q1;
    if (det === 0) return null;
    return [(-p3 * q2 + p2 * q3) / det, (-p1 * q3 + p3 * q1) / det];
  }
  const [[p, q], [r, s]] = fig.c as [[number, number], [number, number]];
  if (p === 0) return null;
  const x = -r / p;
  return [x, x * x + q * x + s];
}

/** The sector's central angle in degrees, 360·r/l (drawing only; the steps print it). */
export const sectorAngle = (fig: ConeUnfoldFigure) => (360 * fig.r) / fig.l;

/** dice_grid: does the outcome (big, small) satisfy the condition? (Shading positions; the count comes from the steps.) */
export function diceMatch(cond: DiceGridFigure['cond'], big: number, small: number): boolean {
  const k = cond.k ?? 0;
  switch (cond.op) {
    case 'sum_le':
      return big + small <= k;
    case 'sum_eq':
      return big + small === k;
    case 'diff_ge':
      return Math.abs(big - small) >= k;
    case 'prod_le':
      return big * small <= k;
    case 'prod_mult':
      return (big * small) % k === 0;
    case 'both_even':
      return big % 2 === 0 && small % 2 === 0;
    case 'both_le':
      return big <= k && small <= k;
    case 'both_ge':
      return big >= k && small >= k;
    case 'even_le':
      return big % 2 === 0 && small <= k;
  }
}

/** Every cell of the 6×6 table that satisfies the condition, as [big, small]. */
export function diceCells(fig: DiceGridFigure): [number, number][] {
  const out: [number, number][] = [];
  for (let b = 1; b <= 6; b++) for (let s = 1; s <= 6; s++) if (diceMatch(fig.cond, b, s)) out.push([b, s]);
  return out;
}

/**
 * const_sum as a bar: its total length (s, or s + u + v with a shift), where the split ends up (the centre,
 * or x_min / the given difference), and the bar's two parts' scale factors (p, q).
 */
export function sumBar(fig: ConstSumFigure): { total: number; end: number; start: number; wall?: number } {
  const [u, v] = fig.shift ?? [0, 0];
  const total = fig.s + u + v;
  if (fig.ask === 'given_diff') return { total, end: (fig.s + (fig.d ?? 0)) / 2, start: (fig.s + (fig.d ?? 0)) / 2 };
  // The failure card: x ≧ x_min, so the split rests at the wall (as close to the centre as it may go).
  if (fig.x_min !== undefined) return { total, end: fig.x_min * (fig.p ?? 1), start: fig.x_min * (fig.p ?? 1), wall: fig.x_min * (fig.p ?? 1) };
  return { total, end: total / 2, start: total * 0.22 };
}
