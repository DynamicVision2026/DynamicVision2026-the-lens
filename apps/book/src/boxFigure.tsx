// WO-026 §7 MUST 5: the problem figure of a three-face 展開 card (box_unfold, route three_faces). The
// scene's first frame shows only face ABFE, but the question needs the whole cuboid: C, G, H, P on BF, Q on
// CG and the three given lengths. Cabinet projection (receding edges at half length, 35°), hidden edges
// dashed; the lens side keeps the scene's opened net. Printed numbers are the figure fields a, b, h only;
// P and Q are placed for the drawing (Q at the card's answer, as the scene does), never labelled with a length.
import { unfoldP, type BoxUnfoldFigure, type LensCard } from '@lens/scenes';
import type { BookTokens } from './types';

const DEPTH_SCALE = 0.5;
const DEPTH_ANGLE = (35 * Math.PI) / 180;
/** Drawing size in SVG units (the book crops and scales it). */
const UNIT = 24;
const LABEL = 20;

type XY = [number, number];

export function isThreeFaceBox(card: LensCard): boolean {
  const f = card.problem.figure as { type: string; route?: string };
  return f.type === 'box_unfold' && f.route === 'three_faces';
}

export function BoxThreeFaces({ card, tokens: t }: { card: LensCard; tokens: BookTokens }) {
  const fig = card.problem.figure as BoxUnfoldFigure;
  const { a, b, h } = fig;
  const ink = t.color.ink.value;
  const quiet = t.color.ink_quiet.value;
  const paper = t.color.paper.value;
  const font = `"${t.type.family_num}", "${t.type.family_ja}", sans-serif`;
  const stroke = t.stroke.figure.width * 1.4;
  const dash = '6 5';
  const dx = b * DEPTH_SCALE * Math.cos(DEPTH_ANGLE);
  const dy = b * DEPTH_SCALE * Math.sin(DEPTH_ANGLE);
  // x to the right, y up, in figure units; SVG y grows down.
  const at = (x: number, y: number): XY => [x * UNIT, -y * UNIT];
  const A = at(0, 0);
  const B = at(a, 0);
  const C = at(a + dx, dy);
  const D = at(dx, dy);
  const E = at(0, h);
  const F = at(a, h);
  const G = at(a + dx, h + dy);
  const H = at(dx, h + dy);
  // The string's points on the edges: P where the straight A→H on the opened net crosses BF, Q at CQ.
  const lerp = (p: XY, q: XY, s: number): XY => [p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s];
  const P = lerp(B, F, a / (2 * a + b));
  const Q = lerp(C, G, Math.min(1, Math.max(0, unfoldP(card) / h)));
  const lb = fig.point_labels;
  const line = (p: XY, q: XY, hidden = false, w = stroke, c = ink) => <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={c} strokeWidth={w} strokeDasharray={hidden ? dash : undefined} strokeLinecap="round" />;
  const text = (q: XY, s: string, ox: number, oy: number, anchor: 'start' | 'middle' | 'end' = 'middle', fill = ink) => (
    <text x={q[0] + ox} y={q[1] + oy} fill={fill} fontFamily={font} fontSize={LABEL} fontWeight={700} textAnchor={anchor} dominantBaseline="central" paintOrder="stroke" stroke={paper} strokeWidth={4} strokeLinejoin="round">
      {s}
    </text>
  );
  const dot = (q: XY) => <circle cx={q[0]} cy={q[1]} r={3.6} fill={ink} />;
  const mid = (p: XY, q: XY): XY => lerp(p, q, 0.5);
  const len = (v: number) => `${v}${fig.unit}`;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-200 -800 1200 1000" role="img" aria-label={card.problem.text_ja}>
      <g fill="none">
        {/* Hidden edges (behind the box) first, dashed. */}
        {line(A, D, true, stroke * 0.8, quiet)}
        {line(D, C, true, stroke * 0.8, quiet)}
        {line(D, H, true, stroke * 0.8, quiet)}
        {/* The string A → P → Q (on visible faces), Q → H across the back face (hidden). */}
        {line(A, P, false, stroke * 0.9, quiet)}
        {line(P, Q, false, stroke * 0.9, quiet)}
        {line(Q, H, true, stroke * 0.9, quiet)}
        {/* Visible edges. */}
        {line(A, B)}
        {line(B, F)}
        {line(F, E)}
        {line(E, A)}
        {line(B, C)}
        {line(C, G)}
        {line(G, F)}
        {line(E, H)}
        {line(H, G)}
      </g>
      {dot(P)}
      {dot(Q)}
      {text(A, lb.A, -14, 12, 'end')}
      {text(B, lb.B, 6, 16, 'start')}
      {text(C, lb.C, 14, 6, 'start')}
      {text(D, lb.D, -12, -12, 'end', quiet)}
      {text(E, lb.E, -14, -8, 'end')}
      {text(F, lb.F, -8, 16, 'end')}
      {text(G, lb.G, 14, -8, 'start')}
      {text(H, lb.H, -6, -16, 'end')}
      {text(P, lb.P, -12, 0, 'end')}
      {text(Q, 'Q', 14, 0, 'start')}
      {text(mid(A, B), len(a), 0, 22)}
      {text(mid(B, C), len(b), 16, 14, 'start')}
      {text(mid(A, E), len(h), -16, 0, 'end')}
    </svg>
  );
}
