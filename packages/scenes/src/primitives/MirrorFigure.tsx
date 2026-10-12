import { partialPolyline } from '../geometry';
import type { MirrorLayout } from '../mirror';
import type { MirrorPathFigure, Point, Tokens } from '../types';
import { Bracket } from './Bracket';

export interface MirrorFigureProps {
  fig: MirrorPathFigure;
  layout: MirrorLayout;
  /** AX, read from the card's answer: X is drawn here, never computed. */
  touchX: number;
  tokens: Tokens;
  ink: string;
  chalk: string;
  accent: string;
  palette: string[];
  font: string;
  weight: number;
  labelSize: number;
  figureStroke: number;
  lensStroke: number;
  dash: string;
  bracket: { offset: number; tick: number; numberSize: number; strokeWidth: number };
  show: number;
  /** The midpoint guess: drawn on (0–1), then dimmed to `tryDim`. */
  tryPath: number;
  tryDim: number;
  /** Q′ with its fold line and equal marks. */
  reflect: number;
  /** P→Q′ drawn on; X lights where it crosses the river; the real path glows after. */
  straight: number;
  /** Triangles PAX and Q′BX in two step colours. */
  similar: number;
  tint: number;
  stripes?: { angle_deg: number; stripe_px: number; period_px: number; opacity: number };
  idPrefix: string;
  glowFilter?: string;
  glowOpacity?: number;
}

/** The shortest-path figure: river ℓ, P and Q on one side, and the reflection that solves it. */
export function MirrorFigure(p: MirrorFigureProps) {
  const { fig, layout: L, ink, accent, labelSize: size } = p;
  if (p.show <= 0) return null;
  const P = L.at(0, fig.pa);
  const Q = L.at(fig.ab, fig.qb);
  const A = L.at(0, 0);
  const B = L.at(fig.ab, 0);
  const Qr = L.at(fig.ab, -fig.qb);
  const X = L.at(p.touchX, 0);
  const M = L.at(fig.ab / 2, 0);
  const pts = (ps: [number, number][]) => ps.map((q) => q.join(',')).join(' ');
  const labels = fig.point_labels;
  const len = (v: number) => `${v}${fig.unit}`;
  // Where P→Q′ crosses the river, as a fraction of the segment (drawing only: X itself comes from the answer).
  const crossAt = fig.pa / (fig.pa + fig.qb);
  const straightPath = partialPolyline([P, Qr] as Point[], p.straight) as [number, number][];
  const xLit = p.straight >= crossAt ? Math.min(1, (p.straight - crossAt) / Math.max(1e-6, 1 - crossAt) * 2) : 0;
  const tri = (ps: [number, number][], i: number) => {
    const c = p.palette[i % p.palette.length]!;
    const id = `${p.idPrefix}-mirror-${i}`;
    return (
      <g key={i} opacity={p.similar}>
        {p.stripes && (
          <defs>
            <pattern id={id} patternUnits="userSpaceOnUse" width={p.stripes.period_px} height={p.stripes.period_px} patternTransform={`rotate(${p.stripes.angle_deg})`}>
              <rect x={0} y={0} width={p.stripes.stripe_px} height={p.stripes.period_px} fill={c} />
            </pattern>
          </defs>
        )}
        <polygon points={pts(ps)} fill={c} fillOpacity={p.tint} stroke="none" />
        {p.stripes && <polygon points={pts(ps)} fill={`url(#${id})`} opacity={p.stripes.opacity} stroke="none" />}
        <polygon points={pts(ps)} fill="none" stroke={c} strokeWidth={p.figureStroke} strokeLinejoin="round" />
      </g>
    );
  };
  const dot = (q: [number, number], c: string, o = 1) => <circle cx={q[0]} cy={q[1]} r={p.figureStroke * 2.2} fill={c} opacity={o} />;
  const label = (q: [number, number], text: string, dx: number, dy: number, o = 1, c = ink) => (
    <text x={q[0] + dx * size} y={q[1] + dy * size} fill={c} opacity={o} fontFamily={p.font} fontSize={size} fontWeight={p.weight} textAnchor="middle" dominantBaseline="central">
      {text}
    </text>
  );
  const tick = (a: [number, number], b: [number, number]) => {
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const t = size * 0.3;
    return (
      <g stroke={accent} strokeWidth={p.figureStroke}>
        <line x1={mx - t} y1={my - t * 0.6} x2={mx + t} y2={my - t * 0.6} />
        <line x1={mx - t} y1={my + t * 0.6} x2={mx + t} y2={my + t * 0.6} />
      </g>
    );
  };

  return (
    <g opacity={p.show}>
      {/* Similar triangles first, under the lines. */}
      {tri([P, A, X], 0)}
      {tri([Qr, B, X], 1)}

      {/* River ℓ, full width. */}
      <line x1={L.left} y1={L.riverY} x2={L.right} y2={L.riverY} stroke={ink} strokeWidth={p.figureStroke * 1.5} strokeLinecap="round" />
      <text x={L.right - size * 0.4} y={L.riverY - size * 0.8} fill={ink} fontFamily={p.font} fontSize={size} fontStyle="italic" textAnchor="end" dominantBaseline="central">
        ℓ
      </text>

      {/* Drops PA and QB, dashed, with their given lengths. */}
      <g stroke={ink} strokeWidth={p.figureStroke} strokeDasharray={p.dash} fill="none">
        <line x1={P[0]} y1={P[1]} x2={A[0]} y2={A[1]} />
        <line x1={Q[0]} y1={Q[1]} x2={B[0]} y2={B[1]} />
      </g>
      {label([(P[0] + A[0]) / 2, (P[1] + A[1]) / 2], len(fig.pa), -1.6, 0)}
      {label([(Q[0] + B[0]) / 2, (Q[1] + B[1]) / 2], len(fig.qb), 1.6, 0)}
      {/* AB below Q′, clear of the reflection and the similar triangles. */}
      <Bracket from={A} to={B} normal={[0, 1]} label={len(fig.ab)} color={ink} tokens={p.tokens} offset={Qr[1] - L.riverY + p.bracket.offset} tick={p.bracket.tick} numberSize={p.bracket.numberSize} strokeWidth={p.bracket.strokeWidth} />

      {/* The trap: halfway. */}
      {p.tryPath > 0 && (
        <g opacity={p.tryDim}>
          <polyline points={pts(partialPolyline([P, M, Q] as Point[], p.tryPath) as [number, number][])} fill="none" stroke={p.chalk} strokeWidth={p.figureStroke * 1.5} strokeDasharray={p.dash} strokeLinejoin="round" />
          {p.tryPath >= 0.5 && (
            <g>
              <circle cx={M[0]} cy={M[1] - size * 1.4} r={size * 0.75} fill="none" stroke={p.chalk} strokeWidth={p.figureStroke} />
              {label([M[0], M[1] - size * 1.4], '?', 0, 0, 1, p.chalk)}
            </g>
          )}
        </g>
      )}

      {/* Q′: the reflection, with the fold line and equal-length marks. */}
      {p.reflect > 0 && (
        <g opacity={p.reflect}>
          <line x1={Q[0]} y1={Q[1]} x2={Qr[0]} y2={Qr[1]} stroke={accent} strokeWidth={p.figureStroke} strokeDasharray={p.dash} />
          {tick(Q, B)}
          {tick(B, Qr)}
          {dot(Qr, accent)}
          {label(Qr, labels.Q_reflected, 1.2, 0.4, 1, accent)}
        </g>
      )}

      {/* The straight line P→Q′, X where it meets the river, and the real path P→X→Q. */}
      {p.straight > 0 && (
        <g>
          {p.glowFilter && (
            <polyline points={pts(straightPath)} fill="none" stroke={accent} strokeWidth={p.lensStroke} filter={p.glowFilter} opacity={p.glowOpacity ?? 1} />
          )}
          <polyline points={pts(straightPath)} fill="none" stroke={accent} strokeWidth={p.lensStroke} strokeLinecap="round" />
          {p.straight >= 1 && <polyline points={pts([P, X, Q])} fill="none" stroke={accent} strokeWidth={p.lensStroke} strokeLinejoin="round" opacity={0.85} />}
        </g>
      )}

      {/* Points and their labels. */}
      {dot(P, ink)}
      {dot(Q, ink)}
      {dot(A, ink)}
      {dot(B, ink)}
      {label(P, labels.P, -0.9, -0.8)}
      {label(Q, labels.Q, 0.9, -0.8)}
      {label(A, labels.A, -0.9, 0.9)}
      {label(B, labels.B, 0.9, 0.9)}
      {xLit > 0 && (
        <g>
          {dot(X, accent, xLit)}
          {label(X, labels.X, 0, -1.1, xLit, accent)}
        </g>
      )}
    </g>
  );
}
