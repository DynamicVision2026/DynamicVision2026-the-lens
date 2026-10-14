import type { PlaneLayout } from '../corner';
import { partialPolyline } from '../geometry';
import type { BoxUnfoldFigure, Point } from '../types';
import { Bracket } from './Bracket';
import type { CornerFigureStyle } from './CornerFigure';

export interface NetThreeFigureProps extends CornerFigureStyle {
  fig: BoxUnfoldFigure;
  /** Figure units: x to the right from A, y up from A. */
  layout: PlaneLayout;
  /** CQ, read from the card's answer: Q is drawn here, never computed. */
  crossY: number;
  answerText: string;
  palette: string[];
  tint: number;
  show: number;
  /** The midpoint guess (to the middle of CG), drawn on then dimmed. */
  tryPath: number;
  tryDim: number;
  /** Faces BCGF and CDHG unrolling beside ABFE: 0 the front face only, 1 all three flat. */
  unfold: number;
  /** A→H drawn on; P and Q light where it crosses BF and CG. */
  straight: number;
  /** Triangles ACQ and ADH in two step colours. */
  similar: number;
  answer: number;
}

type XY = [number, number];

/**
 * WO-018 展開 L4: three faces (ABFE, BCGF, CDHG) opened into one a+b+a wide rectangle; the string
 * A → P (on BF) → Q (on CG) → H is the straight line A→H on it.
 */
export function NetThreeFigure(p: NetThreeFigureProps) {
  const { fig, layout: L, ink, accent, labelSize: size } = p;
  if (p.show <= 0) return null;
  const { a, b, h } = fig;
  const u = p.unfold;
  const xb = a;
  const xc = a + b * u;
  const xd = a + (b + a) * u;
  const A = L.at(0, 0);
  const B = L.at(xb, 0);
  const C = L.at(xc, 0);
  const D = L.at(xd, 0);
  const E = L.at(0, h);
  const F = L.at(xb, h);
  const G = L.at(xc, h);
  const H = L.at(xd, h);
  const lb = fig.point_labels;
  const len = (v: number | string) => `${v}${fig.unit}`;
  const pts = (ps: XY[]) => ps.map((q) => q.join(',')).join(' ');
  const total = 2 * a + b;
  // Where A→H crosses BF and CG on the open net (drawing only; Q itself comes from the answer).
  const atP = a / total;
  const atQ = (a + b) / total;
  const P = L.at(a, h * atP);
  const Q = L.at(a + b, p.crossY);
  const lit = (at: number) => (p.straight >= at ? Math.min(1, ((p.straight - at) / Math.max(1e-6, 1 - at)) * 3) : 0);
  const M = L.at(a + b, h / 2);
  const straightPath = partialPolyline([A, H] as Point[], p.straight) as XY[];
  const bk = { tokens: p.tokens, tick: p.bracket.tick, numberSize: p.bracket.numberSize, strokeWidth: p.bracket.strokeWidth };
  const drop = p.bracket.offset + size * 1.5;
  const dot = (q: XY, c: string, o = 1) => <circle cx={q[0]} cy={q[1]} r={p.figureStroke * 2.2} fill={c} opacity={o} />;
  const label = (q: XY, text: string, dx: number, dy: number, o = 1, c = ink) =>
    o > 0 ? (
      <text x={q[0] + dx * size} y={q[1] + dy * size} fill={c} opacity={o} fontFamily={p.font} fontSize={size} fontWeight={p.weight} textAnchor="middle" dominantBaseline="central">
        {text}
      </text>
    ) : null;
  const tri = (ps: XY[], i: number, tint: number) => <polygon key={i} points={pts(ps)} fill={p.palette[i % p.palette.length]} fillOpacity={tint * p.similar} stroke={p.palette[i % p.palette.length]} strokeWidth={p.figureStroke} strokeOpacity={p.similar} />;
  const opened = u > 0.02;

  return (
    <g opacity={p.show}>
      {p.similar > 0 && tri([A, D, H], 1, p.tint * 0.5)}
      {p.similar > 0 && tri([A, C, Q], 0, p.tint)}

      {/* The three faces; the two that unroll are tinted while they open. */}
      <polygon points={pts([A, B, F, E])} fill="none" stroke={ink} strokeWidth={p.figureStroke} strokeLinejoin="round" />
      {opened && <polygon points={pts([B, C, G, F])} fill={accent} fillOpacity={p.tint * 0.6 * (1 - p.similar)} stroke={ink} strokeWidth={p.figureStroke} strokeLinejoin="round" />}
      {opened && <polygon points={pts([C, D, H, G])} fill={accent} fillOpacity={p.tint * 0.35 * (1 - p.similar)} stroke={ink} strokeWidth={p.figureStroke} strokeLinejoin="round" />}
      {/* The hinges BF and CG in the lens colour while the faces open. */}
      {opened && (
        <g stroke={accent} strokeWidth={p.lensStroke} opacity={Math.min(1, u * 4)}>
          <line x1={B[0]} y1={B[1]} x2={F[0]} y2={F[1]} />
          <line x1={C[0]} y1={C[1]} x2={G[0]} y2={G[1]} />
        </g>
      )}

      {/* Given lengths: AB, BC, CD (= AB) below; AE on the left; AC (net_width) below them. */}
      <Bracket from={A} to={B} normal={[0, 1]} label={len(a)} color={ink} offset={drop} {...bk} />
      {u > 0.6 && (
        <g opacity={(u - 0.6) / 0.4}>
          <Bracket from={B} to={C} normal={[0, 1]} label={len(b)} color={ink} offset={drop} {...bk} />
          <Bracket from={C} to={D} normal={[0, 1]} label={len(a)} color={ink} offset={drop} {...bk} />
          <Bracket from={A} to={C} normal={[0, 1]} label={len(fig.net_width)} color={accent} offset={drop + p.bracket.numberSize * 2.2} {...bk} />
        </g>
      )}
      {label([(A[0] + E[0]) / 2, (A[1] + E[1]) / 2], len(h), -1.6, 0)}

      {/* The trap: the middle of CG. */}
      {p.tryPath > 0 && opened && (
        <g opacity={p.tryDim}>
          <polyline points={pts(partialPolyline([A, M, H] as Point[], p.tryPath) as XY[])} fill="none" stroke={p.chalk} strokeWidth={p.figureStroke * 1.5} strokeDasharray={p.dash} strokeLinejoin="round" />
        </g>
      )}

      {p.straight > 0 && (
        <g>
          {p.glowFilter && <polyline points={pts(straightPath)} fill="none" stroke={accent} strokeWidth={p.lensStroke} filter={p.glowFilter} opacity={p.glowOpacity ?? 1} />}
          <polyline points={pts(straightPath)} fill="none" stroke={accent} strokeWidth={p.lensStroke} strokeLinecap="round" />
        </g>
      )}

      {/* CQ once the answer is shown. */}
      {label([(C[0] + Q[0]) / 2, (C[1] + Q[1]) / 2], p.answerText, 1.9, 0, p.answer, accent)}

      {[A, B, E, F].map((q, i) => (
        <g key={i}>{dot(q, ink)}</g>
      ))}
      {opened && [C, D, G, H].map((q, i) => <g key={`o${i}`}>{dot(q, ink)}</g>)}
      {label(A, lb.A, -0.9, 0)}
      {label(B, lb.B, 0, 0.9)}
      {label(E, lb.E, -0.8, -0.7)}
      {label(F, lb.F, 0, -0.9)}
      {opened && label(C, lb.C, 0, 0.9)}
      {opened && label(D, lb.D, 0.9, 0)}
      {opened && label(G, lb.G, 0, -0.9)}
      {opened && label(H, lb.H, 0.9, -0.7)}
      {dot(P, accent, lit(atP))}
      {label(P, lb.P, 0.8, 0.6, lit(atP), accent)}
      {dot(Q, accent, lit(atQ))}
      {label(Q, 'Q', 0.8, 0.6, lit(atQ), accent)}
    </g>
  );
}
