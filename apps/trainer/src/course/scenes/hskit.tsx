// WO-023: pieces the High School drag scenes share: curves and lines on the coordinate plane (clipped to it)
// and the equation legend. Positions only; printed numbers come from the card.
import { evalQ, fieldNumber, type Point, type Quadratic } from '@lens/scenes';
import type { ReactNode } from 'react';
import type { Plane } from './coordkit';
import { C } from './kit';

/** y = q(x) across the plane, as SVG points. */
export function curvePoints(P: Plane, q: Quadratic, x0 = P.x0, x1 = P.x1, n = 120): string {
  return Array.from({ length: n + 1 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / n;
    return `${P.X(x)},${P.Y(evalQ(q, x))}`;
  }).join(' ');
}

/** The line cx·x + cy·y + cc = 0 across the plane (SVG endpoints), or null. */
export function lineAcross(P: Plane, l: [number, number, number]): [number, number, number, number] | null {
  const [cx, cy, cc] = l;
  if (Math.abs(cy) > 1e-12) return [P.X(P.x0), P.Y(-(cx * P.x0 + cc) / cy), P.X(P.x1), P.Y(-(cx * P.x1 + cc) / cy)];
  if (Math.abs(cx) > 1e-12) return [P.X(-cc / cx), P.Y(P.y0), P.X(-cc / cx), P.Y(P.y1)];
  return null;
}

/** Everything drawn on the plane is clipped to it. */
export function PlaneClip({ P, id, children }: { P: Plane; id: string; children: ReactNode }) {
  return (
    <g>
      <clipPath id={id}>
        <rect x={P.X(P.x0)} y={P.Y(P.y1)} width={P.X(P.x1) - P.X(P.x0)} height={P.Y(P.y0) - P.Y(P.y1)} />
      </clipPath>
      <g clipPath={`url(#${id})`}>{children}</g>
    </g>
  );
}

/** 「x² − 2x − 3」 from coefficients (as the problem prints them). */
export function quad(q: (number | string)[]): string {
  const terms: [string, string][] = [];
  (['x²', 'x', ''] as const).forEach((pw, i) => {
    const c = q[i]!;
    const v = fieldNumber(c);
    if (v === 0) return;
    const abs = String(c).replace('-', '');
    terms.push([v < 0 ? '−' : '+', (abs !== '1' || !pw ? abs : '') + pw]);
  });
  if (terms.length === 0) return '0';
  return terms.map(([sign, body], i) => (i === 0 ? (sign === '−' ? '−' : '') + body : ` ${sign} ${body}`)).join('');
}

/** The equations, top left of the plane, in their curves' colours. */
export function Legend({ P, items }: { P: Plane; items: { text: string; color: string }[] }) {
  return (
    <g className="legend">
      {items.map((it, i) => (
        <text key={i} x={P.X(P.x0) + 8} y={P.Y(P.y1) + 20 + i * 20} fill={it.color} stroke={C.paper} strokeWidth={4} paintOrder="stroke" fontSize={15} fontFamily={C.num} fontStyle="italic" fontWeight={600}>
          {it.text}
        </text>
      ))}
    </g>
  );
}

/** A printed exact value with a true minus (「−3」, 「7/6」). */
export const minusText = (s: string) => (s.startsWith('-') ? `−${s.slice(1)}` : s);

export const near = (a: Point, b: Point, d: number) => Math.hypot(a[0] - b[0], a[1] - b[1]) < d;
