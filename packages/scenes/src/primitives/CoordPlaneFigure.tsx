import { coordFrame, coordText, crossXAxis, type CoordFrame } from '../coord';
import { formatExact } from '../format';
import { counterClockwise, enclosureGaps, partialPolyline } from '../geometry';
import type { RenderMode } from '../tokens';
import type { CoordEqualAreaFigure, CoordMirrorAreaFigure, LensCard, Point, Tokens } from '../types';
import { answerNumber } from '../wordProblem';
import { CoordAxes } from './CoordAxes';
import { GridLayer } from './GridLayer';
import { RegionShade } from './RegionShade';

const COPY = { P: 'P', Br: "B'", no: '✕' } as const;

export interface CoordPlaneStyle {
  tokens: Tokens;
  mode: RenderMode;
  ink: string;
  chalk: string;
  flag: string;
  accent: string;
  palette: string[];
  font: string;
  weight: number;
  labelSize: number;
  figureStroke: number;
  lensStroke: number;
  dash: string;
  tint: number;
  glowFilter?: string;
  glowOpacity?: number;
  /** The figure region in SVG units. */
  region: [number, number, number, number];
}

type XY = [number, number];
const pts = (ps: XY[]) => ps.map((q) => q.join(',')).join(' ');
/** A printed coordinate from the answer (exact string, true minus). */
const fromAnswer = (v: string) => (v.startsWith('-') ? `−${formatExact(v.slice(1))}` : formatExact(v));

function Plane({ cf, s, points, labels, children, t }: { cf: CoordFrame; s: CoordPlaneStyle; points: Point[]; labels: string[]; children: React.ReactNode; t: number }) {
  const origin = cf.g([0, 0]);
  return (
    <g opacity={t}>
      <GridLayer frame={cf.frame} tokens={s.tokens} mode={s.mode} />
      <CoordAxes part="lines" frame={cf.frame} origin={origin} tokens={s.tokens} mode={s.mode} />
      {children}
      <CoordAxes part="labels" frame={cf.frame} origin={origin} tokens={s.tokens} mode={s.mode} points={points.map(cf.g)} labels={labels} />
    </g>
  );
}

function dot(q: XY, c: string, r: number, o = 1) {
  return <circle cx={q[0]} cy={q[1]} r={r} fill={c} opacity={o} />;
}

export interface EqualAreaFigureProps extends CoordPlaneStyle {
  card: LensCard;
  fig: CoordEqualAreaFigure;
  show: number;
  /** The line through C parallel to AB. */
  parallel: number;
  /** C sliding along it to P on the y-axis. */
  slide: number;
  answer: number;
}

/**
 * WO-020 等積変形 on the plane: △ABC, the line through C parallel to AB, and C sliding along it to P on
 * the y-axis (△ABP = △ABC). P is drawn at the answer (its y), never computed.
 */
export function EqualAreaFigure(p: EqualAreaFigureProps) {
  const { fig, card } = p;
  if (p.show <= 0) return null;
  const Py = answerNumber(card);
  const cf = coordFrame([fig.A, fig.B, fig.C, [0, Py]], ...p.region);
  const A = cf.at(fig.A);
  const B = cf.at(fig.B);
  const C = cf.at(fig.C);
  const P = cf.at([0, Py]);
  const Cs: XY = [C[0] + (P[0] - C[0]) * p.slide, C[1] + (P[1] - C[1]) * p.slide];
  // The parallel, long enough to cross the whole grid, clipped to it.
  const d: XY = [B[0] - A[0], B[1] - A[1]];
  const k = (cf.frame.cell * (cf.frame.grid.width + cf.frame.grid.height)) / Math.hypot(d[0], d[1]);
  const L1: XY = [C[0] - d[0] * k, C[1] - d[1] * k];
  const L2: XY = [C[0] + d[0] * k, C[1] + d[1] * k];
  const clip = `${card.id}-coord-clip`;
  const r = p.figureStroke * 2.4;
  const labels = [`A${coordText(fig.A)}`, `B${coordText(fig.B)}`, `C${coordText(fig.C)}`];
  return (
    <Plane cf={cf} s={p} points={[fig.A, fig.B, fig.C]} labels={labels} t={p.show}>
      <defs>
        <clipPath id={clip}>
          <rect x={cf.frame.left} y={cf.frame.top} width={cf.frame.grid.width * cf.frame.cell} height={cf.frame.grid.height * cf.frame.cell} />
        </clipPath>
      </defs>
      <polygon points={pts([A, B, C])} fill={p.palette[0]} fillOpacity={p.tint * (1 - 0.6 * p.slide)} stroke={p.palette[0]} strokeWidth={p.figureStroke} strokeOpacity={1 - 0.6 * p.slide} />
      {p.parallel > 0 && (
        <g clipPath={`url(#${clip})`} opacity={p.parallel}>
          <line x1={L1[0]} y1={L1[1]} x2={L2[0]} y2={L2[1]} stroke={p.accent} strokeWidth={p.figureStroke * 1.4} strokeDasharray={p.dash} />
        </g>
      )}
      {p.slide > 0 && <polygon points={pts([A, B, Cs])} fill={p.palette[1]} fillOpacity={p.tint} stroke={p.accent} strokeWidth={p.lensStroke} strokeLinejoin="round" />}
      <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={p.ink} strokeWidth={p.figureStroke * 1.6} />
      {dot(A, p.ink, r)}
      {dot(B, p.ink, r)}
      {dot(C, p.ink, r)}
      {p.slide > 0 && dot(Cs, p.accent, r * 1.2)}
      {p.slide >= 1 && (
        <text x={P[0] + p.labelSize * 0.5} y={P[1] - p.labelSize * 0.9} fill={p.accent} fontFamily={p.font} fontSize={p.labelSize * 0.9} fontWeight={p.weight} dominantBaseline="central">
          {p.answer > 0 ? `${COPY.P}(0, ${fromAnswer(card.answer.value)})` : COPY.P}
        </text>
      )}
    </Plane>
  );
}

export interface MirrorAreaFigureProps extends CoordPlaneStyle {
  card: LensCard;
  fig: CoordMirrorAreaFigure;
  show: number;
  /** B reflected across the x-axis to B′. */
  reflect: number;
  /** The straight line A→B′ (A→B when they are already on opposite sides). */
  straight: number;
  /** P on the x-axis and the real path A→P→B. */
  mark: number;
  /** Chained stage 2: the box around △ABP, then its corners. */
  box: number;
  corners: number;
  /** The no-lens card: the reflection that isn't needed, struck out. */
  ghost: number;
  answer: number;
  /** Stage 2 of the chain: the triangle △ABP is the figure (P drawn solid). */
  idPrefix: string;
}

/** Where P is drawn: at the answer when the card asks for its x, else where A→B′ meets the x-axis (drawing only). */
export function mirrorAreaP(card: LensCard, fig: CoordMirrorAreaFigure): Point {
  if (fig.ask === 'p_x') return [answerNumber(card), 0];
  const Bt: Point = fig.side === 'opposite' ? fig.B : [fig.B[0], -fig.B[1]];
  return [crossXAxis(fig.A, Bt), 0];
}

/**
 * WO-020 折り返す on the plane: B across the x-axis to B′, the straight line A→B′, P on the axis; for the
 * chained card, the box and corners around △ABP (Enclose).
 */
export function MirrorAreaFigure(p: MirrorAreaFigureProps) {
  const { fig, card } = p;
  if (p.show <= 0) return null;
  const opposite = fig.side === 'opposite';
  const Bt: Point = opposite ? fig.B : [fig.B[0], -fig.B[1]];
  const Pp = mirrorAreaP(card, fig);
  const ghostB: Point = [fig.B[0], -fig.B[1]];
  const cf = coordFrame([fig.A, fig.B, Bt, Pp, ...(opposite ? [ghostB] : [])], ...p.region);
  const A = cf.at(fig.A);
  const B = cf.at(fig.B);
  const Br = cf.at(Bt);
  const P = cf.at(Pp);
  const G = cf.at(ghostB);
  const r = p.figureStroke * 2.4;
  const size = p.labelSize;
  const [ax0, ay] = cf.at([cf.x0, 0]);
  const ax1 = cf.at([cf.x0 + cf.frame.grid.width, 0])[0];
  const straight = partialPolyline([A, Br] as Point[], p.straight) as XY[];
  // △ABP counter-clockwise (A → P → B), as enclosureGaps expects.
  const tri = counterClockwise([fig.A, Pp, fig.B].map(cf.g));
  const xs = tri.map((q) => q[0]);
  const ys = tri.map((q) => q[1]);
  const box = [cf.at([Math.min(...xs) + cf.x0, Math.min(...ys) + cf.y0]), cf.at([Math.max(...xs) + cf.x0, Math.max(...ys) + cf.y0])];
  const gaps = enclosureGaps(tri);
  const labels = [`A${coordText(fig.A)}`, `B${coordText(fig.B)}`];
  const pLabel = fig.ask === 'p_x' && p.answer > 0 ? `${COPY.P}(${fromAnswer(card.answer.value)}, 0)` : COPY.P;
  return (
    <Plane cf={cf} s={p} points={[fig.A, fig.B]} labels={labels} t={p.show}>
      {/* The x-axis is the mirror: it lights while B folds across. */}
      {p.reflect > 0 && <line x1={ax0} y1={ay} x2={ax1} y2={ay} stroke={p.accent} strokeWidth={p.lensStroke} opacity={p.reflect * (1 - 0.5 * p.box)} />}
      {/* Chained stage 2: the corners and the box around △ABP. */}
      {gaps.map((g, i) => (
        <RegionShade key={i} frame={cf.frame} points={g} lens={card.chain?.[1]?.lens ?? card.lens} tokens={p.tokens} mode={p.mode} t={p.corners} />
      ))}
      {p.box > 0 && <rect x={box[0]![0]} y={box[1]![1]} width={box[1]![0] - box[0]![0]} height={box[0]![1] - box[1]![1]} fill="none" stroke={p.accent} strokeWidth={p.lensStroke} strokeDasharray={p.dash} opacity={p.box} />}
      {p.box > 0 && <polygon points={pts([A, B, P])} fill="none" stroke={p.ink} strokeWidth={p.figureStroke} opacity={p.box} />}
      {/* B → B′ across the mirror. */}
      {!opposite && p.reflect > 0 && (
        <g opacity={p.reflect}>
          <line x1={B[0]} y1={B[1]} x2={Br[0]} y2={Br[1]} stroke={p.accent} strokeWidth={p.figureStroke} strokeDasharray={p.dash} />
          {dot(Br, p.accent, r)}
          <text x={Br[0] + size * 0.9} y={Br[1]} fill={p.accent} fontFamily={p.font} fontSize={size * 0.9} fontWeight={p.weight} dominantBaseline="central">
            {COPY.Br}
          </text>
        </g>
      )}
      {/* The no-lens card: a reflection that isn't needed, struck out. */}
      {opposite && p.ghost > 0 && (
        <g opacity={p.ghost}>
          <line x1={B[0]} y1={B[1]} x2={G[0]} y2={G[1]} stroke={p.chalk} strokeWidth={p.figureStroke} strokeDasharray={p.dash} />
          {dot(G, p.chalk, r)}
          <text x={G[0] + size * 0.9} y={G[1]} fill={p.flag} fontFamily={p.font} fontSize={size} fontWeight={p.weight} dominantBaseline="central">
            {COPY.no}
          </text>
        </g>
      )}
      {p.straight > 0 && (
        <g>
          {p.glowFilter && <polyline points={pts(straight)} fill="none" stroke={p.accent} strokeWidth={p.lensStroke} filter={p.glowFilter} opacity={p.glowOpacity ?? 1} />}
          <polyline points={pts(straight)} fill="none" stroke={p.accent} strokeWidth={p.lensStroke} strokeLinecap="round" opacity={p.mark > 0 && !opposite ? 0.45 : 1} />
        </g>
      )}
      {p.mark > 0 && !opposite && <polyline points={pts([A, P, B])} fill="none" stroke={p.accent} strokeWidth={p.lensStroke} strokeLinejoin="round" opacity={p.mark} />}
      {dot(A, p.ink, r)}
      {dot(B, p.ink, r)}
      {p.mark > 0 && (
        <g opacity={p.mark}>
          {dot(P, p.accent, r * 1.2)}
          <text x={P[0]} y={P[1] + size * 1.1} fill={p.accent} fontFamily={p.font} fontSize={size * 0.9} fontWeight={p.weight} textAnchor="middle" dominantBaseline="central">
            {pLabel}
          </text>
        </g>
      )}
    </Plane>
  );
}
