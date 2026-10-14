// Drawing geometry derived from a figure's lattice points. Shapes only: no area is computed here;
// every number a scene shows comes from a route step in the bundle.
import type { Point } from './types';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function boundingBox(points: Point[]): Box {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

export function boxCorners(b: Box): Point[] {
  return [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]];
}

const onBoundary = (p: Point, b: Box) => p[0] === b.x0 || p[0] === b.x1 || p[1] === b.y0 || p[1] === b.y1;

/** Position along the box perimeter, counter-clockwise from (x0, y0). */
function perimeterPos(p: Point, b: Box): number {
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  if (p[1] === b.y0) return p[0] - b.x0;
  if (p[0] === b.x1) return w + (p[1] - b.y0);
  if (p[1] === b.y1) return w + h + (b.x1 - p[0]);
  return 2 * w + h + (b.y1 - p[1]);
}

/**
 * The gaps between the figure and its enclosing box, in drawing order starting from the chain that
 * leaves vertex A. Each gap is the chain of figure vertices between two consecutive box-boundary
 * vertices, closed along the box (through any box corners in between). Edges lying on the box are
 * not gaps. For a standard Enclose card each gap is one corner right triangle.
 */
export function enclosureGaps(points: Point[]): Point[][] {
  const b = boundingBox(points);
  const n = points.length;
  const perimeter = 2 * (b.x1 - b.x0 + b.y1 - b.y0);
  const boundaryIdx = points.map((_, i) => i).filter((i) => onBoundary(points[i]!, b));
  if (boundaryIdx.length === 0 || perimeter === 0) return [];
  const corners = boxCorners(b).map((c) => ({ c, s: perimeterPos(c, b) }));
  const gaps: Point[][] = [];
  for (let k = 0; k < boundaryIdx.length; k++) {
    const i = boundaryIdx[k]!;
    const j = boundaryIdx[(k + 1) % boundaryIdx.length]!;
    const chain: Point[] = [points[i]!];
    for (let m = (i + 1) % n; m !== j; m = (m + 1) % n) chain.push(points[m]!);
    chain.push(points[j]!);
    const sA = perimeterPos(points[i]!, b);
    let d = (perimeterPos(points[j]!, b) - sA + perimeter) % perimeter;
    if (d === 0 && boundaryIdx.length === 1) d = perimeter;
    const between = corners
      .map(({ c, s }) => ({ c, off: (s - sA + perimeter) % perimeter }))
      .filter(({ off }) => off > 0 && off < d)
      .sort((p, q) => q.off - p.off)
      .map(({ c }) => c);
    if (chain.length === 2 && between.length === 0) continue; // edge lies on the box
    gaps.push([...chain, ...between]);
  }
  // Start from the chain leaving the first boundary vertex at or after A (already the order above).
  return gaps;
}

/**
 * Pieces for a notch figure (enclose_failure_notch): the first four points are the box corners
 * A, B, C, D and the last two (E, F) form the notch; the cut is the vertical line through F.
 * Returns [rectangle right of the cut, triangle A-cut-F, triangle F-cut-E, triangle cut-D-E] in the
 * order of the lens route's start and add steps, or null when the figure has another shape.
 */
export function notchPieces(points: Point[]): Point[][] | null {
  if (points.length !== 6) return null;
  const b = boundingBox(points);
  const [A, B, C, D, E, F] = points as [Point, Point, Point, Point, Point, Point];
  const isBox =
    A[0] === b.x0 && A[1] === b.y0 && B[0] === b.x1 && B[1] === b.y0 &&
    C[0] === b.x1 && C[1] === b.y1 && D[0] === b.x0 && D[1] === b.y1;
  if (!isBox || onBoundary(E, b) || onBoundary(F, b)) return null;
  const m = cutX(points);
  return [
    [[m, b.y0], B, C, [m, b.y1]],
    [A, [m, b.y0], F],
    [F, [m, b.y1], E],
    [[m, b.y1], D, E],
  ];
}

/** x of the vertical cut for a notch figure: the last point (the deepest notch vertex). */
export function cutX(points: Point[]): number {
  return points[points.length - 1]![0];
}

/** An edge lying on a horizontal grid line at the figure's lowest y (the base for No-lens cards). */
export function horizontalBase(points: Point[]): [Point, Point] | null {
  const b = boundingBox(points);
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % points.length]!;
    if (p[1] === b.y0 && q[1] === b.y0 && p[0] !== q[0]) return [p, q];
  }
  return null;
}

/** The vertex farthest from the base line (the apex of a triangle). */
export function apexFor(points: Point[], base: [Point, Point]): Point {
  return points.reduce((best, p) => (Math.abs(p[1] - base[0][1]) > Math.abs(best[1] - base[0][1]) ? p : best));
}

/**
 * Unit vector pointing out of the figure at vertex i (lattice coordinates, y up), from the outward
 * normals of its two edges. Works at reflex vertices too. Points are counter-clockwise.
 */
export function outwardDirection(points: Point[], i: number): Point {
  const n = points.length;
  const prev = points[(i - 1 + n) % n]!;
  const cur = points[i]!;
  const next = points[(i + 1) % n]!;
  const normal = (a: Point, b: Point): Point => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [dy / len, -dx / len];
  };
  const n1 = normal(prev, cur);
  const n2 = normal(cur, next);
  const sx = n1[0] + n2[0];
  const sy = n1[1] + n2[1];
  const len = Math.hypot(sx, sy);
  return len === 0 ? n1 : [sx / len, sy / len];
}

export function centroid(points: Point[]): Point {
  const sx = points.reduce((s, p) => s + p[0], 0);
  const sy = points.reduce((s, p) => s + p[1], 0);
  return [sx / points.length, sy / points.length];
}

export function polylineLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
  }
  return len;
}

/** The first `t` fraction (by length) of a polyline, for draw-on animation with dashed strokes. */
export function partialPolyline(points: Point[], t: number): Point[] {
  if (points.length < 2 || t >= 1) return points;
  if (t <= 0) return [points[0]!];
  let remaining = polylineLength(points) * t;
  const out: Point[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (seg >= remaining) {
      const f = seg === 0 ? 0 : remaining / seg;
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      return out;
    }
    out.push(b);
    remaining -= seg;
  }
  return out;
}

/** The points in counter-clockwise order (reversed when clockwise), as enclosureGaps expects. */
export function counterClockwise(points: Point[]): Point[] {
  const a2 = points.reduce((a, p, i) => a + p[0] * points[(i + 1) % points.length]![1] - points[(i + 1) % points.length]![0] * p[1], 0);
  return a2 < 0 ? [...points].reverse() : points;
}
