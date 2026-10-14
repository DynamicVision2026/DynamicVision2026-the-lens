import type { PlaneLayout } from '../corner';
import { partialPolyline } from '../geometry';
import type { MirrorCornerFigure as Fig, Point, Tokens } from '../types';
import { Bracket } from './Bracket';

const COPY = { O: 'O', l: 'ℓ', m: 'm', P: 'P', Q: 'Q', Pr: "P'", Qr: "Q'" } as const;

export interface CornerFigureStyle {
  tokens: Tokens;
  ink: string;
  chalk: string;
  accent: string;
  font: string;
  weight: number;
  labelSize: number;
  figureStroke: number;
  lensStroke: number;
  dash: string;
  bracket: { offset: number; tick: number; numberSize: number; strokeWidth: number };
  glowFilter?: string;
  glowOpacity?: number;
}

export interface CornerFigureProps extends CornerFigureStyle {
  fig: Fig;
  layout: PlaneLayout;
  /** The touch point on ℓ, its distance from O, read from the card's answer: never computed. */
  touchX: number;
  answerText: string;
  show: number;
  /** P reflected across m (0–1). */
  first: number;
  /** Q reflected across ℓ (0–1). */
  second: number;
  /** P′→Q′ drawn on; the touch points light where it crosses m and ℓ. */
  straight: number;
  /** The real path P → m → ℓ → Q. */
  touch: number;
  answer: number;
}

type XY = [number, number];

/**
 * WO-018 折り返す L4: two lines at right angles at O (ℓ along, m up); P and Q in the corner. Reflect P
 * across m and Q across ℓ; the straight line P′Q′ touches m, then ℓ.
 */
export function CornerFigure(p: CornerFigureProps) {
  const { fig, layout: L, ink, accent, labelSize: size } = p;
  if (p.show <= 0) return null;
  const [px, py] = fig.P;
  const [qx, qy] = fig.Q;
  const O = L.at(0, 0);
  const P = L.at(px, py);
  const Q = L.at(qx, qy);
  const Pr = L.at(-px, py);
  const Qr = L.at(qx, -qy);
  // Where P′Q′ crosses m and ℓ (drawing only; the touch point on ℓ itself comes from the answer).
  const atM = px / (px + qx);
  const atL = py / (py + qy);
  const Tm = L.at(0, py - (py + qy) * atM);
  const Tl = L.at(p.touchX, 0);
  const lit = (at: number) => (p.straight >= at ? Math.min(1, ((p.straight - at) / Math.max(1e-6, 1 - at)) * 3) : 0);
  const len = (v: number) => `${v}${fig.unit}`;
  const pts = (ps: XY[]) => ps.map((q) => q.join(',')).join(' ');
  const straightPath = partialPolyline([Pr, Qr] as Point[], p.straight) as XY[];
  const top = L.at(0, Math.max(py, qy) + 1)[1];
  const right = L.at(Math.max(px, qx) + 1, 0)[0];
  const bottom = L.at(0, -qy - 0.5)[1];
  const left = L.at(-px - 0.5, 0)[0];
  const dot = (q: XY, c: string, o = 1) => <circle cx={q[0]} cy={q[1]} r={p.figureStroke * 2.2} fill={c} opacity={o} />;
  const label = (q: XY, text: string, dx: number, dy: number, o = 1, c = ink) =>
    o > 0 ? (
      <text x={q[0] + dx * size} y={q[1] + dy * size} fill={c} opacity={o} fontFamily={p.font} fontSize={size} fontWeight={p.weight} textAnchor="middle" dominantBaseline="central">
        {text}
      </text>
    ) : null;
  // The given distances: to m (across) and to ℓ (down), dashed, with their lengths.
  const given = (q: XY, d: [number, number], to: 'm' | 'l') => {
    const foot: XY = to === 'm' ? [O[0], q[1]] : [q[0], O[1]];
    const mid: XY = [(q[0] + foot[0]) / 2, (q[1] + foot[1]) / 2];
    return (
      <g>
        <line x1={q[0]} y1={q[1]} x2={foot[0]} y2={foot[1]} stroke={ink} strokeWidth={p.figureStroke * 0.8} strokeDasharray={p.dash} opacity={0.7} />
        {to === 'm' ? label(mid, len(d[0]), 0, -0.75) : label(mid, len(d[1]), 0.95, 0)}
      </g>
    );
  };

  return (
    <g opacity={p.show}>
      {/* The two lines: solid on the corner's sides, faint where the reflections land. */}
      <g stroke={ink} strokeLinecap="round">
        <line x1={O[0]} y1={O[1]} x2={right} y2={O[1]} strokeWidth={p.figureStroke * 1.5} />
        <line x1={O[0]} y1={O[1]} x2={O[0]} y2={top} strokeWidth={p.figureStroke * 1.5} />
        <line x1={left} y1={O[1]} x2={O[0]} y2={O[1]} strokeWidth={p.figureStroke} strokeDasharray={p.dash} opacity={0.35} />
        <line x1={O[0]} y1={O[1]} x2={O[0]} y2={bottom} strokeWidth={p.figureStroke} strokeDasharray={p.dash} opacity={0.35} />
      </g>
      <text x={right} y={O[1] - size * 0.8} fill={ink} fontFamily={p.font} fontSize={size} fontStyle="italic" textAnchor="end" dominantBaseline="central">
        {COPY.l}
      </text>
      <text x={O[0] + size * 0.8} y={top} fill={ink} fontFamily={p.font} fontSize={size} fontStyle="italic" dominantBaseline="central">
        {COPY.m}
      </text>

      {given(P, fig.P, 'm')}
      {given(P, fig.P, 'l')}
      {given(Q, fig.Q, 'm')}
      {given(Q, fig.Q, 'l')}

      {/* P′: P across m; Q′: Q across ℓ. */}
      {p.first > 0 && (
        <g opacity={p.first}>
          <line x1={P[0]} y1={P[1]} x2={Pr[0]} y2={Pr[1]} stroke={accent} strokeWidth={p.figureStroke} strokeDasharray={p.dash} />
          {dot(Pr, accent)}
          {label(Pr, COPY.Pr, -0.9, -0.8, 1, accent)}
        </g>
      )}
      {p.second > 0 && (
        <g opacity={p.second}>
          <line x1={Q[0]} y1={Q[1]} x2={Qr[0]} y2={Qr[1]} stroke={accent} strokeWidth={p.figureStroke} strokeDasharray={p.dash} />
          {dot(Qr, accent)}
          {label(Qr, COPY.Qr, 0.9, 0.8, 1, accent)}
        </g>
      )}

      {/* The straight line P′→Q′, then the real path P → m → ℓ → Q. */}
      {p.straight > 0 && (
        <g>
          {p.glowFilter && <polyline points={pts(straightPath)} fill="none" stroke={accent} strokeWidth={p.lensStroke} filter={p.glowFilter} opacity={p.glowOpacity ?? 1} />}
          <polyline points={pts(straightPath)} fill="none" stroke={accent} strokeWidth={p.lensStroke} strokeLinecap="round" opacity={1 - 0.6 * p.touch} />
        </g>
      )}
      {p.touch > 0 && <polyline points={pts([P, Tm, Tl, Q])} fill="none" stroke={accent} strokeWidth={p.lensStroke} strokeLinejoin="round" opacity={p.touch} />}
      {dot(Tm, accent, lit(atM))}
      {dot(Tl, accent, lit(atL))}

      {/* The answer: the touch point on ℓ, measured from O. */}
      {p.answer > 0 && (
        <g opacity={p.answer}>
          <Bracket from={O} to={Tl} normal={[0, 1]} label={p.answerText} color={accent} tokens={p.tokens} offset={p.bracket.offset} tick={p.bracket.tick} numberSize={p.bracket.numberSize} strokeWidth={p.bracket.strokeWidth} />
        </g>
      )}

      {dot(P, ink)}
      {dot(Q, ink)}
      {label(P, COPY.P, 0.7, -0.8)}
      {label(Q, COPY.Q, 0.7, -0.8)}
      {label(O, COPY.O, -0.8, 0.8)}
    </g>
  );
}
