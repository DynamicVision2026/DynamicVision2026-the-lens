import { afterEquals } from '../wordProblem';
import type { LensCard, Step, TriangleCeviansFigure } from '../types';

const COPY = { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', P: 'P', no: '✕' } as const;

type XY = [number, number];
const pts = (ps: XY[]) => ps.map((q) => q.join(',')).join(' ');
const lerp = (a: XY, b: XY, t: number): XY => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** 「A:B:C＝1:3:2」 in a step → { A: '1', B: '3', C: '2' } (printed as written; nothing is scaled here). */
export function weightsIn(step: Step | undefined): Record<'A' | 'B' | 'C', string> | null {
  const m = step && /A\s*[:：]\s*B\s*[:：]\s*C\s*＝\s*([\d.]+)\s*[:：]\s*([\d.]+)\s*[:：]\s*([\d.]+)/.exec(step.ja);
  return m ? { A: m[1]!, B: m[2]!, C: m[3]! } : null;
}

/** Where AD and BE cross (drawing only). */
function cross(a: XY, d: XY, b: XY, e: XY): XY {
  const r: XY = [d[0] - a[0], d[1] - a[1]];
  const s: XY = [e[0] - b[0], e[1] - b[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  const u = ((b[0] - a[0]) * s[1] - (b[1] - a[1]) * s[0]) / den;
  return [a[0] + r[0] * u, a[1] + r[1] * u];
}

export interface CeviansFigureProps {
  card: LensCard;
  fig: TriangleCeviansFigure;
  region: [number, number, number, number];
  ink: string;
  chalk: string;
  flag: string;
  accent: string;
  palette: string[];
  paper: string;
  font: string;
  weight: number;
  labelSize: number;
  figureStroke: number;
  lensStroke: number;
  dash: string;
  tint: number;
  show: number;
  /** Weights at B and C from BD:DC. */
  wbc: number;
  /** Weights at C and A from CE:EA, then all three on one scale (as the step writes them). */
  wca: number;
  /** The balance on AD (or BE): the weight that gathers at D (or E), and P. */
  balance: number;
  /** Which cevian balances. */
  on: 'AD' | 'BE';
  /** The no-lens card: △ABD and its height from A; then BD and BC. */
  height: number;
  base: number;
  ghost: number;
  answer: number;
}

/**
 * WO-020 Stage 3 てんびん (mass points): a fixed △ABC, D on BC and E on CA at their given ratios, AD and
 * BE crossing at P. Weights are printed only from the figure fields and the steps.
 */
export function CeviansFigure(p: CeviansFigureProps) {
  const { fig, card } = p;
  if (p.show <= 0) return null;
  const [x, y, w, h] = p.region;
  const A: XY = [x + w * 0.36, y + h * 0.1];
  const B: XY = [x + w * 0.06, y + h * 0.82];
  const C: XY = [x + w * 0.94, y + h * 0.82];
  const D = lerp(B, C, fig.bd / (fig.bd + fig.dc));
  const E = lerp(C, A, fig.ce / (fig.ce + fig.ea));
  const P = cross(A, D, B, E);
  const steps = card.lens_route.steps;
  const size = p.labelSize;
  const r = p.figureStroke * 2.2;
  const scaled = weightsIn(steps.find((s) => weightsIn(s)));
  const gathered = afterEquals(steps.find((s, i) => i > 0 && /集まる/.test(s.ja)));
  const label = (q: XY, text: string, dx: number, dy: number, c = p.ink, o = 1) => (
    <text x={q[0] + dx * size} y={q[1] + dy * size} fill={c} opacity={o} fontFamily={p.font} fontSize={size} fontWeight={p.weight} textAnchor="middle" dominantBaseline="central">
      {text}
    </text>
  );
  // A weight: a filled disc with its number, beside its point.
  const weightAt = (q: XY, n: string | number, dx: number, dy: number, o: number, c = p.accent) =>
    o > 0 ? (
      <g opacity={o}>
        <circle cx={q[0] + dx * size} cy={q[1] + dy * size} r={size * 0.85} fill={c} />
        <text x={q[0] + dx * size} y={q[1] + dy * size} fill={p.paper} fontFamily={p.font} fontSize={size * 0.95} fontWeight={p.weight} textAnchor="middle" dominantBaseline="central">
          {String(n)}
        </text>
      </g>
    ) : null;
  const ratio = (a: XY, b: XY, n: number, nx: number, ny: number) => label(lerp(a, b, 0.5), String(n), nx, ny, p.ink);
  // Weights on screen: B, C from BD:DC; then C, A from CE:EA; then the three on one scale when the step gives them.
  const wB = p.wca > 0 && scaled ? scaled.B : fig.dc;
  const wC = p.wca > 0 ? (scaled ? scaled.C : fig.ea) : fig.bd;
  const wA = scaled ? scaled.A : fig.ce;
  const cev = p.on === 'AD' ? [A, D] : [B, E];
  const foot: XY = [A[0], B[1]];
  const askPbc = fig.ask === 'area_pbc';

  return (
    <g opacity={p.show}>
      {/* The no-lens card: △ABD with A's height to BC (shared with △ABC). */}
      {p.height > 0 && (
        <g opacity={p.height}>
          <polygon points={pts([A, B, D])} fill={p.palette[0]} fillOpacity={p.tint} stroke="none" />
          <line x1={A[0]} y1={A[1]} x2={foot[0]} y2={foot[1]} stroke={p.accent} strokeWidth={p.figureStroke} strokeDasharray={p.dash} />
        </g>
      )}
      {askPbc && p.answer > 0 && <polygon points={pts([P, B, C])} fill={p.palette[1]} fillOpacity={p.tint * p.answer} stroke={p.palette[1]} strokeWidth={p.figureStroke} opacity={p.answer} />}

      <polygon points={pts([A, B, C])} fill="none" stroke={p.ink} strokeWidth={p.figureStroke * 1.3} strokeLinejoin="round" />
      <g stroke={p.ink} strokeWidth={p.figureStroke}>
        <line x1={A[0]} y1={A[1]} x2={D[0]} y2={D[1]} />
        <line x1={B[0]} y1={B[1]} x2={E[0]} y2={E[1]} />
      </g>
      {/* The balancing cevian in the lens colour. */}
      {p.balance > 0 && <line x1={cev[0]![0]} y1={cev[0]![1]} x2={cev[1]![0]} y2={cev[1]![1]} stroke={p.accent} strokeWidth={p.lensStroke} opacity={p.balance} />}
      {/* BD and BC, for the base ratio. */}
      {p.base > 0 && (
        <g opacity={p.base}>
          <line x1={B[0]} y1={B[1] + size * 0.4} x2={D[0]} y2={D[1] + size * 0.4} stroke={p.palette[0]} strokeWidth={p.lensStroke} />
          <line x1={B[0]} y1={B[1] + size * 0.75} x2={C[0]} y2={C[1] + size * 0.75} stroke={p.accent} strokeWidth={p.lensStroke} />
        </g>
      )}

      {/* The given ratios on the sides. */}
      {ratio(B, D, fig.bd, 0, 1.6)}
      {ratio(D, C, fig.dc, 0, 1.6)}
      {ratio(C, E, fig.ce, 0.9, -0.5)}
      {ratio(E, A, fig.ea, 0.9, -0.5)}

      {/* Weights: B and C; then C and A (one scale); then the gathered weight at D or E. */}
      {weightAt(B, wB, -1.1, -1.2, Math.max(p.wbc, p.wca))}
      {weightAt(C, wC, 1.1, -1.2, Math.max(p.wbc, p.wca))}
      {weightAt(A, wA, -1.6, -0.3, p.wca)}
      {gathered && weightAt(p.on === 'AD' ? D : E, gathered, p.on === 'AD' ? 0 : 1.2, p.on === 'AD' ? 2.9 : 0.6, p.balance, p.palette[2])}
      {/* The no-lens card: weights that aren't needed, struck out. */}
      {p.ghost > 0 && (
        <g opacity={p.ghost * 0.6}>
          {weightAt(B, fig.dc, -1.1, -1.2, 1, p.chalk)}
          {weightAt(C, fig.bd, 1.1, -1.2, 1, p.chalk)}
          {label(lerp(B, C, 0.5), COPY.no, 0, -1.4, p.flag)}
        </g>
      )}

      {[A, B, C, D, E].map((q, i) => (
        <circle key={i} cx={q[0]} cy={q[1]} r={r} fill={p.ink} />
      ))}
      {label(A, COPY.A, 0, -1)}
      {label(B, COPY.B, -0.9, 0.5)}
      {label(C, COPY.C, 0.9, 0.5)}
      {label(D, COPY.D, 0, 0.9)}
      {label(E, COPY.E, 0.9, -0.2)}
      <circle cx={P[0]} cy={P[1]} r={r * 1.2} fill={p.balance > 0 || p.answer > 0 ? p.accent : p.ink} />
      {label(P, COPY.P, 0.9, 0.2, p.balance > 0 || p.answer > 0 ? p.accent : p.ink)}
    </g>
  );
}
