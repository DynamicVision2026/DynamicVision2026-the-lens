import type { PlaneLayout } from '../corner';
import { partialPolyline } from '../geometry';
import type { Point, RiverBridgeFigure as Fig } from '../types';
import { Bracket } from './Bracket';
import type { CornerFigureStyle } from './CornerFigure';

const COPY = { P: 'P', Q: 'Q', A: 'A', B: 'B', X: 'X', Qr: "Q'", no: '✕' } as const;

export interface BridgeFigureProps extends CornerFigureStyle {
  fig: Fig;
  layout: PlaneLayout;
  /** The bridge's distance from A along the north bank, read from the card's answer: never computed. */
  bridgeX: number;
  answerText: string;
  /** Faint water between the banks. */
  water: string;
  tint: number;
  show: number;
  /** The wrong try: the 折り返す habit, folding Q at the south bank and going straight (drawn on, then dimmed). */
  tryPath: number;
  tryDim: number;
  /** The river width pulsing. */
  first: number;
  /** Q shifted north by the width, to Q′. */
  second: number;
  /** P→Q′ drawn on; X lights on the north bank; then the bridge and the real path. */
  straight: number;
  answer: number;
}

type XY = [number, number];

/**
 * WO-018 折り返す failure card: a bridge across a river of width w. Reflecting does not help; shifting Q
 * north by the width does (the bridge's length is the same wherever it goes).
 */
export function BridgeFigure(p: BridgeFigureProps) {
  const { fig, layout: L, ink, accent, labelSize: size } = p;
  if (p.show <= 0) return null;
  const { pa, qb, ab, w } = fig;
  const P = L.at(0, pa);
  const A = L.at(0, 0);
  const B = L.at(ab, -w);
  const Q = L.at(ab, -w - qb);
  const Qr = L.at(ab, -w - qb + w * p.second);
  const Qend = L.at(ab, -qb);
  const X = L.at(p.bridgeX, 0);
  const Xs = L.at(p.bridgeX, -w);
  // The habit's fold: Q reflected at the south bank (drawing only).
  const Qstar = L.at(ab, -w + qb);
  const [left, right] = [L.at(L.x0, 0)[0], L.at(L.x1, 0)[0]];
  const north = A[1];
  const south = B[1];
  const len = (v: number) => `${v}${fig.unit}`;
  const pts = (ps: XY[]) => ps.map((q) => q.join(',')).join(' ');
  const crossAt = pa / (pa + qb);
  const straightPath = partialPolyline([P, Qend] as Point[], p.straight) as XY[];
  const xLit = p.straight >= crossAt ? Math.min(1, ((p.straight - crossAt) / Math.max(1e-6, 1 - crossAt)) * 2) : 0;
  const dot = (q: XY, c: string, o = 1) => <circle cx={q[0]} cy={q[1]} r={p.figureStroke * 2.2} fill={c} opacity={o} />;
  const label = (q: XY, text: string, dx: number, dy: number, o = 1, c = ink) =>
    o > 0 ? (
      <text x={q[0] + dx * size} y={q[1] + dy * size} fill={c} opacity={o} fontFamily={p.font} fontSize={size} fontWeight={p.weight} textAnchor="middle" dominantBaseline="central">
        {text}
      </text>
    ) : null;
  const bk = { tokens: p.tokens, tick: p.bracket.tick, numberSize: p.bracket.numberSize, strokeWidth: p.bracket.strokeWidth };

  return (
    <g opacity={p.show}>
      {/* The river between its banks. */}
      <rect x={left} y={north} width={right - left} height={south - north} fill={p.water} fillOpacity={p.tint} />
      <g stroke={ink} strokeWidth={p.figureStroke * 1.5} strokeLinecap="round">
        <line x1={left} y1={north} x2={right} y2={north} />
        <line x1={left} y1={south} x2={right} y2={south} />
      </g>
      {/* The width, at the river's left end (clear of P, Q and the bridge), pulsing when the lens points at it. */}
      <Bracket from={[left, north]} to={[left, south]} normal={[1, 0]} label={len(w)} color={p.first > 0 ? accent : ink} offset={size * 0.4} {...bk} strokeWidth={p.bracket.strokeWidth * (1 + p.first)} />

      {/* Drops PA and QB, dashed, with their given lengths; AB along the banks below. */}
      <g stroke={ink} strokeWidth={p.figureStroke} strokeDasharray={p.dash} fill="none">
        <line x1={P[0]} y1={P[1]} x2={A[0]} y2={A[1]} />
        <line x1={Q[0]} y1={Q[1]} x2={B[0]} y2={B[1]} />
      </g>
      {label([(P[0] + A[0]) / 2, (P[1] + A[1]) / 2], len(pa), -1.6, 0)}
      {label([(Q[0] + B[0]) / 2, (Q[1] + B[1]) / 2], len(qb), 1.6, 0)}
      <Bracket from={L.at(0, -w - qb)} to={Q} normal={[0, 1]} label={len(ab)} color={ink} offset={p.bracket.offset} {...bk} />

      {/* The wrong try: fold Q at the bank (the 折り返す habit) and go straight — the river width doesn't fit. */}
      {p.tryPath > 0 && (
        <g opacity={p.tryDim}>
          <polyline points={pts(partialPolyline([Q, Qstar, P] as Point[], p.tryPath) as XY[])} fill="none" stroke={p.chalk} strokeWidth={p.figureStroke * 1.5} strokeDasharray={p.dash} />
          {p.tryPath >= 0.5 && dot(Qstar, p.chalk)}
          {p.tryPath >= 1 && label(Qstar, COPY.no, 1.1, 0, 1, p.chalk)}
        </g>
      )}

      {/* Q shifted north by the width: Q′. */}
      {p.second > 0 && (
        <g>
          <line x1={Q[0]} y1={Q[1]} x2={Qr[0]} y2={Qr[1]} stroke={accent} strokeWidth={p.figureStroke} strokeDasharray={p.dash} />
          {dot(Qr, accent)}
          {label(Qr, COPY.Qr, 1.1, 0, p.second, accent)}
        </g>
      )}

      {/* P→Q′ straight; the bridge at X; the real path P → X → across → Q. */}
      {p.straight > 0 && (
        <g>
          {p.glowFilter && <polyline points={pts(straightPath)} fill="none" stroke={accent} strokeWidth={p.lensStroke} filter={p.glowFilter} opacity={p.glowOpacity ?? 1} />}
          <polyline points={pts(straightPath)} fill="none" stroke={accent} strokeWidth={p.lensStroke} strokeLinecap="round" opacity={p.straight >= 1 ? 0.25 : 1} />
        </g>
      )}
      {p.straight >= 1 && (
        <g>
          <line x1={X[0]} y1={X[1]} x2={Xs[0]} y2={Xs[1]} stroke={accent} strokeWidth={p.lensStroke * 1.6} strokeLinecap="round" />
          <polyline points={pts([P, X, Xs, Q])} fill="none" stroke={accent} strokeWidth={p.lensStroke} strokeLinejoin="round" />
        </g>
      )}
      {xLit > 0 && (
        <g>
          {dot(X, accent, xLit)}
          {label(X, COPY.X, 0.4, -0.9, xLit, accent)}
        </g>
      )}
      {p.answer > 0 && (
        <g opacity={p.answer}>
          <Bracket from={A} to={X} normal={[0, -1]} label={p.answerText} color={accent} offset={size * 0.6} {...bk} />
        </g>
      )}

      {dot(P, ink)}
      {dot(Q, ink)}
      {dot(A, ink)}
      {dot(B, ink)}
      {label(P, COPY.P, -0.9, -0.6)}
      {label(Q, COPY.Q, -0.9, 0.6)}
      {label(A, COPY.A, -0.9, -0.7)}
      {label(B, COPY.B, -0.9, 0.7)}
    </g>
  );
}
