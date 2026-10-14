// WO-023: the Stage 3 graph figures (囲む, 等積変形, 折り返す, 止める on y = f(x)). Positions are computed from the
// figure fields; every printed number comes from the figure fields (equations, given points), the steps or
// the answer (answerText). Crossings, tangent points and reflections are drawn, named, never numbered.
import type { ReactNode } from 'react';
import { coordFrame, coordText, type CoordFrame } from '../coord';
import { color } from '../tokens';
import { answerText } from '../format';
import { areaPoints, areaSpan, evalQ, familyBrackets, familyMember, familyPoint, fieldNumber, mirrorPoints, triPoints } from '../stage3';
import type { LensCard, LineMirrorFigure, ParabolaAreaFigure, ParabolaTriFigure, ParamFamilyFigure, Point, Quadratic } from '../types';
import { answerNumber } from '../wordProblem';
import { CoordAxes } from './CoordAxes';
import type { CoordPlaneStyle } from './CoordPlaneFigure';
import { GridLayer } from './GridLayer';

type XY = [number, number];
const pts = (ps: XY[]) => ps.map((q) => q.join(',')).join(' ');
const COPY = { P: 'P', O: 'O', A: 'A', B: 'B', Br: "B'", alpha: 'α', beta: 'β', ell: 'ℓ', no: '✕', y: 'y' } as const;

/** A field number as printed: 「−2」, 「1/2」. */
function fieldText(v: number | string): string {
  const s = String(v);
  return s.startsWith('-') ? `−${s.slice(1)}` : s;
}

/** 「x² − 2x − 3」 from the figure's coefficients (as stage3.py's poly). */
export function quadText(q: (number | string)[]): string {
  const terms: [string, string][] = [];
  (['x²', 'x', ''] as const).forEach((pw, i) => {
    const c = q[i]!;
    const v = fieldNumber(c);
    if (v === 0) return;
    const abs = fieldText(c).replace('−', '');
    terms.push([v < 0 ? '−' : '+', (abs !== '1' || !pw ? abs : '') + pw]);
  });
  if (terms.length === 0) return '0';
  return terms.map(([sign, body], i) => (i === 0 ? (sign === '−' ? '−' : '') + body : ` ${sign} ${body}`)).join('');
}

export interface GraphProps extends CoordPlaneStyle {
  card: LensCard;
  show: number;
  first: number;
  second: number;
  answer: number;
}

/** The plane, clipped: grid, axes, then the figure, then the tick numbers. */
function GraphPlane({ cf, s, id, children, labels, t }: { cf: CoordFrame; s: CoordPlaneStyle; id: string; children: ReactNode; labels?: { points: Point[]; text: string[] }; t: number }) {
  const origin = cf.g([0, 0]);
  const { frame } = cf;
  return (
    <g opacity={t}>
      <defs>
        <clipPath id={id}>
          <rect x={frame.left} y={frame.top} width={frame.grid.width * frame.cell} height={frame.grid.height * frame.cell} />
        </clipPath>
      </defs>
      <GridLayer frame={frame} tokens={s.tokens} mode={s.mode} />
      <CoordAxes part="lines" frame={frame} origin={origin} tokens={s.tokens} mode={s.mode} />
      {children}
      <CoordAxes part="labels" frame={frame} origin={origin} tokens={s.tokens} mode={s.mode} points={labels?.points.map(cf.g)} labels={labels?.text} />
    </g>
  );
}

/** The x-range of the grid. */
const xSpan = (cf: CoordFrame): [number, number] => [cf.x0, cf.x0 + cf.frame.grid.width];

/** y = q(x) sampled across [x0, x1] (SVG points). */
function curve(cf: CoordFrame, q: Quadratic, x0: number, x1: number, n = 96): XY[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / n;
    return cf.at([x, evalQ(q, x)]);
  });
}

/** The line cx·x + cy·y + cc = 0 across the grid (SVG endpoints). */
function lineAcross(cf: CoordFrame, l: [number, number, number]): [XY, XY] | null {
  const [cx, cy, cc] = l;
  const [x0, x1] = xSpan(cf);
  if (Math.abs(cy) > 1e-12) return [cf.at([x0, -(cx * x0 + cc) / cy]), cf.at([x1, -(cx * x1 + cc) / cy])];
  if (Math.abs(cx) > 1e-12) {
    const x = -cc / cx;
    return [cf.at([x, cf.y0]), cf.at([x, cf.y0 + cf.frame.grid.height])];
  }
  return null;
}

/** The plane's y-range clamped to a sensible window around the points that matter (tall parabolas). */
function planeFor(points: Point[], region: CoordPlaneStyle['region']): CoordFrame {
  return coordFrame(points, ...region);
}

function dot(q: XY, c: string, r: number, o = 1) {
  return <circle cx={q[0]} cy={q[1]} r={r} fill={c} opacity={o} />;
}

function tag(s: CoordPlaneStyle, q: XY, text: string, dx: number, dy: number, c: string, anchor: 'start' | 'middle' | 'end' = 'start', o = 1, part?: string) {
  if (o <= 0) return null;
  return (
    <text data-part={part} x={q[0] + dx * s.labelSize} y={q[1] + dy * s.labelSize} fill={c} opacity={o} fontFamily={s.font} fontSize={s.labelSize * 0.9} fontWeight={s.weight} textAnchor={anchor} dominantBaseline="central">
      {text}
    </text>
  );
}

/** The equations, stacked in the plane's top-left corner in their curves' colours, on a paper halo. */
function Legend({ s, cf, items }: { s: CoordPlaneStyle; cf: CoordFrame; items: { text: string; color: string; o?: number }[] }) {
  const paper = color(s.tokens.color.paper, s.mode);
  const size = s.labelSize * 0.82;
  return (
    <g data-part="legend">
      {items.map((it, i) =>
        (it.o ?? 1) > 0 ? (
          <text key={i} x={cf.frame.left + size * 0.5} y={cf.frame.top + size * (0.9 + i * 1.35)} fill={it.color} opacity={it.o ?? 1} stroke={paper} strokeWidth={size * 0.28} paintOrder="stroke" strokeLinejoin="round" fontFamily={s.font} fontSize={size} fontWeight={s.weight} dominantBaseline="central" fontStyle="italic">
            {it.text}
          </text>
        ) : null,
      )}
    </g>
  );
}

// ------------------------------------------------------------------ 囲む ---

export interface ParabolaAreaProps extends GraphProps {
  fig: ParabolaAreaFigure;
}

/** WO-023 parabola_area: both graphs, the crossings α, β marked on the x-axis, the region shaded. */
export function ParabolaAreaGraph(p: ParabolaAreaProps) {
  const { fig, card } = p;
  if (p.show <= 0) return null;
  const cf = planeFor(areaPoints(fig), p.region);
  const [x0, x1] = xSpan(cf);
  const [lo, hi] = areaSpan(fig);
  const g: Quadratic = fig.g ?? [0, 0, 0];
  const bounded = !!fig.bounds;
  // The region between the curves on [lo, hi], filled left to right as `second` grows.
  const fillTo = lo + (hi - lo) * (bounded ? 1 : p.second);
  const region = [...curve(cf, fig.f, lo, fillTo, 64), ...curve(cf, g, lo, fillTo, 64).reverse()];
  const r = p.figureStroke * 2.4;
  const id = `${card.id}-pa-clip`;
  const [ax, ay] = cf.at([lo, 0]);
  const [bx] = cf.at([hi, 0]);
  const shade = bounded ? 1 : p.second;
  // Where each crossing is on the curves (the dashed drop to the x-axis).
  const ca = cf.at([lo, evalQ(fig.f, lo)]);
  const cb = cf.at([hi, evalQ(fig.f, hi)]);
  return (
    <GraphPlane cf={cf} s={p} id={id} t={p.show}>
      <g clipPath={`url(#${id})`}>
        {shade > 0 && <polygon data-part="region" points={pts(region)} fill={p.accent} fillOpacity={p.tint * 2.2 * Math.max(shade, 0.001)} stroke="none" />}
        {fig.g && <polyline points={pts(curve(cf, fig.g, x0, x1))} fill="none" stroke={p.palette[1]} strokeWidth={p.figureStroke * 1.6} />}
        <polyline points={pts(curve(cf, fig.f, x0, x1))} fill="none" stroke={p.palette[0]} strokeWidth={p.figureStroke * 1.6} />
        {/* The no-lens / failure cards: the bounds x = p, x = q as given lines. */}
        {bounded && (
          <g stroke={p.ink} strokeWidth={p.figureStroke} strokeDasharray={p.dash}>
            <line x1={ax} y1={cf.frame.top} x2={ax} y2={cf.frame.top + cf.frame.grid.height * cf.frame.cell} />
            <line x1={bx} y1={cf.frame.top} x2={bx} y2={cf.frame.top + cf.frame.grid.height * cf.frame.cell} />
          </g>
        )}
      </g>
      {/* The crossings α, β, dropped to the x-axis. */}
      {!bounded && p.first > 0 && (
        <g data-part="crossings" opacity={p.first}>
          {fig.g && (
            <g stroke={p.accent} strokeWidth={p.figureStroke} strokeDasharray={p.dash}>
              <line x1={ca[0]} y1={ca[1]} x2={ax} y2={ay} />
              <line x1={cb[0]} y1={cb[1]} x2={bx} y2={ay} />
            </g>
          )}
          {dot(ca, p.accent, r * 1.15)}
          {dot(cb, p.accent, r * 1.15)}
          {dot([ax, ay], p.accent, r)}
          {dot([bx, ay], p.accent, r)}
          {tag(p, [ax, ay], COPY.alpha, 0, -1.1, p.accent, 'middle')}
          {tag(p, [bx, ay], COPY.beta, 0, -1.1, p.accent, 'middle')}
        </g>
      )}
      <Legend s={p} cf={cf} items={[{ text: `y = ${quadText(fig.f)}`, color: p.palette[0]! }, ...(fig.g ? [{ text: `y = ${quadText(fig.g)}`, color: p.palette[1]! }] : [])]} />
      {p.answer > 0 && tag(p, cf.at([(lo + hi) / 2, (evalQ(fig.f, (lo + hi) / 2) + evalQ(g, (lo + hi) / 2)) / 2]), answerText(card), 0, 0, p.ink, 'middle', p.answer, 'answer')}
    </GraphPlane>
  );
}

// -------------------------------------------------------------- 等積変形 ---

export interface ParabolaTriProps extends GraphProps {
  fig: ParabolaTriFigure;
}

/**
 * WO-023 parabola_tri: y = ax², A, B and chord AB; the line parallel to AB that touches the parabola (or, for
 * equal_o, passes through O); P sliding there; △ABP shaded. The no-lens card draws △OAB.
 */
export function ParabolaTriGraph(p: ParabolaTriProps) {
  const { fig, card } = p;
  if (p.show <= 0) return null;
  const ax = fig.ask === 'px' || fig.ask === 'equal_o' ? answerNumber(card) : undefined;
  const T = triPoints(fig, ax);
  const q: Quadratic = [T.a, 0, 0];
  const O: Point = [0, 0];
  const cf = planeFor([T.A, T.B, T.P, O, T.mid], p.region);
  const [x0, x1] = xSpan(cf);
  const A = cf.at(T.A);
  const B = cf.at(T.B);
  const P = cf.at(T.P);
  const Oo = cf.at(O);
  const id = `${card.id}-pt-clip`;
  const r = p.figureStroke * 2.4;
  const oab = fig.ask === 'oab';
  // The parallel to AB: through the touching point (or through O for equal_o), across the grid.
  const through = fig.ask === 'equal_o' ? O : T.P;
  const par = lineAcross(cf, [T.slope, -1, through[1] - T.slope * through[0]]);
  // P slides from A along the parabola to its place (the failure card, a walkthrough, shows it with the answer).
  const slid = fig.ask === 'range_max' ? Math.max(p.second, p.answer) : p.second;
  const sx = T.A[0] + (T.P[0] - T.A[0]) * slid;
  const Ps = cf.at([sx, T.a * sx * sx]);
  const apex = oab ? Oo : slid > 0 ? Ps : null;
  // P's x is the answer for px / equal_o.
  const pText = (fig.ask === 'px' || fig.ask === 'equal_o') && p.answer > 0 ? `${COPY.P}（x＝${answerText(card)}）` : COPY.P;
  return (
    <GraphPlane cf={cf} s={p} id={id} t={p.show}>
      <g clipPath={`url(#${id})`}>
        <polyline points={pts(curve(cf, q, x0, x1))} fill="none" stroke={p.palette[0]} strokeWidth={p.figureStroke * 1.6} />
        {/* The failure card: P is held to its range (bold arc), which stops short of the touching point. */}
        {fig.range && <polyline data-part="range" points={pts(curve(cf, q, fig.range[0], fig.range[1], 32))} fill="none" stroke={p.flag} strokeWidth={p.lensStroke * 1.4} strokeLinecap="round" />}
        {par && !oab && p.first > 0 && <line data-part="parallel" x1={par[0][0]} y1={par[0][1]} x2={par[1][0]} y2={par[1][1]} stroke={p.accent} strokeWidth={p.figureStroke * 1.4} strokeDasharray={p.dash} opacity={p.first} />}
      </g>
      {apex && <polygon data-part="triangle" points={pts([A, B, apex])} fill={p.palette[1]} fillOpacity={p.tint * 1.6} stroke={p.accent} strokeWidth={p.lensStroke} strokeLinejoin="round" />}
      <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={p.ink} strokeWidth={p.figureStroke * 1.6} />
      {dot(A, p.ink, r)}
      {dot(B, p.ink, r)}
      {tag(p, A, COPY.A, -0.8, -0.2, p.ink, 'end')}
      {tag(p, B, COPY.B, 0.8, -0.2, p.ink, 'start')}
      {(fig.ask === 'equal_o' || oab) && dot(Oo, p.ink, r)}
      {!oab && slid > 0 && dot(Ps, p.accent, r * 1.2)}
      {!oab && slid >= 1 && tag(p, P, pText, 0, 1.2, p.accent, 'middle', 1, 'p')}
      <Legend s={p} cf={cf} items={[{ text: `y = ${quadText([fig.a, 0, 0])}`, color: p.palette[0]! }]} />
      {p.answer > 0 && fig.ask !== 'px' && fig.ask !== 'equal_o' && apex && tag(p, [(A[0] + B[0] + apex[0]) / 3, (A[1] + B[1] + apex[1]) / 3], answerText(card), 0, 0, p.ink, 'middle', p.answer, 'answer')}
    </GraphPlane>
  );
}

// -------------------------------------------------------------- 折り返す ---

export interface LineMirrorProps extends GraphProps {
  fig: LineMirrorFigure;
}

/**
 * WO-023 line_mirror: the slanted mirror ℓ, A, B; B reflected across ℓ to B′; the straight A–B′; P on ℓ.
 * The failure card (max_diff) extends line AB to P without reflecting; the no-lens card joins A–B directly.
 */
export function LineMirrorGraph(p: LineMirrorProps) {
  const { fig, card } = p;
  if (p.show <= 0) return null;
  const M = mirrorPoints(fig);
  const cf = planeFor([fig.A, fig.B, M.T, M.P], p.region);
  const A = cf.at(fig.A);
  const B = cf.at(fig.B);
  const T = cf.at(M.T);
  const P = cf.at(M.P);
  const id = `${card.id}-lm-clip`;
  const r = p.figureStroke * 2.4;
  const [m, k] = fig.line;
  const ell = lineAcross(cf, [m, -1, k])!;
  const Bs: XY = [B[0] + (T[0] - B[0]) * p.first, B[1] + (T[1] - B[1]) * p.first];
  const st = p.second;
  const end: XY = [A[0] + (T[0] - A[0]) * st, A[1] + (T[1] - A[1]) * st];
  const maxDiff = fig.ask === 'max_diff';
  const answerOn = p.answer > 0;
  // P's label: its x for p_x / max_diff; the length of A–B′ (the minimum) for min_len.
  const pText = fig.ask === 'min_len' ? COPY.P : answerOn ? `${COPY.P}（x＝${answerText(card)}）` : COPY.P;
  const ellText = `${COPY.ell}: y = ${quadText([0, m, k])}`;
  return (
    <GraphPlane cf={cf} s={p} id={id} t={p.show} labels={{ points: [fig.A, fig.B], text: [`A${coordText(fig.A)}`, `B${coordText(fig.B)}`] }}>
      <g clipPath={`url(#${id})`}>
        <line data-part="mirror" x1={ell[0][0]} y1={ell[0][1]} x2={ell[1][0]} y2={ell[1][1]} stroke={p.accent} strokeWidth={p.lensStroke} opacity={0.75} />
        {/* The failure card: line AB extended to ℓ. */}
        {maxDiff && <line x1={A[0]} y1={A[1]} x2={P[0]} y2={P[1]} stroke={p.ink} strokeWidth={p.figureStroke} strokeDasharray={p.dash} opacity={answerOn ? 1 : 0} />}
      </g>
      {M.reflect && p.first > 0 && (
        <g data-part="reflect" opacity={p.first}>
          <line x1={B[0]} y1={B[1]} x2={Bs[0]} y2={Bs[1]} stroke={p.accent} strokeWidth={p.figureStroke} strokeDasharray={p.dash} />
          {dot(Bs, p.accent, r)}
          {p.first >= 1 && tag(p, T, COPY.Br, 0.7, 0.6, p.accent)}
        </g>
      )}
      {st > 0 && (
        <g data-part="straight">
          {p.glowFilter && <line x1={A[0]} y1={A[1]} x2={end[0]} y2={end[1]} stroke={p.accent} strokeWidth={p.lensStroke} filter={p.glowFilter} opacity={p.glowOpacity ?? 1} />}
          <line x1={A[0]} y1={A[1]} x2={end[0]} y2={end[1]} stroke={p.accent} strokeWidth={p.lensStroke} strokeLinecap="round" opacity={M.reflect && answerOn ? 0.45 : 1} />
        </g>
      )}
      {/* The real path A → P → B once P is found. */}
      {answerOn && !maxDiff && <polyline data-part="path" points={pts([A, P, B])} fill="none" stroke={p.accent} strokeWidth={p.lensStroke} strokeLinejoin="round" opacity={p.answer} />}
      {/* The no-lens card: A and B already on opposite sides; A–B is straight already. */}
      {!M.reflect && !maxDiff && st <= 0 && answerOn && <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={p.accent} strokeWidth={p.lensStroke} />}
      {dot(A, p.ink, r)}
      {dot(B, p.ink, r)}
      {(answerOn || (st >= 1 && !maxDiff)) && (
        <g opacity={answerOn ? p.answer : 1}>
          {dot(P, p.accent, r * 1.2)}
          {tag(p, P, pText, 0.7, 0.9, p.accent, 'start', 1, 'p')}
        </g>
      )}
      {fig.ask === 'min_len' && answerOn && tag(p, [(A[0] + T[0]) / 2, (A[1] + T[1]) / 2], answerText(card), -0.6, -0.6, p.accent, 'end', p.answer, 'answer')}
      <Legend s={p} cf={cf} items={[{ text: ellText, color: p.accent }]} />
    </GraphPlane>
  );
}

// ---------------------------------------------------------------- 止める ---

export interface ParamFamilyProps extends GraphProps {
  fig: ParamFamilyFigure;
}

const FAMILY_A = [-2, -1, 0, 1, 2];

/**
 * WO-023 param_family: members of the family for a = −2…2 (faint); 止める freezes a (one member stays bold);
 * the two brackets of a(…) + (…) = 0 light up as two graphs; the fixed point where they meet. The failure card
 * highlights the member through the given point, the no-lens card the member at a0.
 */
export function ParamFamilyGraph(p: ParamFamilyProps) {
  const { fig, card } = p;
  if (p.show <= 0) return null;
  const ask = fig.ask ?? 'point';
  const F = familyPoint(fig);
  const given = ask === 'a_for_point' ? fig.point : undefined;
  const centre: Point = F ?? given ?? [0, 0];
  const box: Point[] = [centre, [centre[0] - 4, centre[1] - 4], [centre[0] + 4, centre[1] + 4], ...(given ? [given] : [])];
  const cf = planeFor(box, p.region);
  const [x0, x1] = xSpan(cf);
  const id = `${card.id}-pf-clip`;
  const r = p.figureStroke * 2.4;
  const draw = (m: { line?: [number, number, number]; parabola?: Quadratic }, c: string, w: number, o: number, dash?: string, part?: string) => {
    if (o <= 0) return null;
    if (m.parabola) return <polyline data-part={part} points={pts(curve(cf, m.parabola, x0, x1))} fill="none" stroke={c} strokeWidth={w} opacity={o} strokeDasharray={dash} />;
    const l = m.line ? lineAcross(cf, m.line) : null;
    return l ? <line data-part={part} x1={l[0][0]} y1={l[0][1]} x2={l[1][0]} y2={l[1][1]} stroke={c} strokeWidth={w} opacity={o} strokeDasharray={dash} /> : null;
  };
  // Which member stays when a is frozen: a = 0 for the lens; the answer's a (failure) or a0 (no-lens).
  const frozenA = ask === 'a_for_point' ? answerNumber(card) : ask === 'slope_at' ? (fig.a0 ?? 0) : 0;
  const br = familyBrackets(fig);
  const lens = ask === 'point';
  const fade = lens ? 1 - 0.75 * p.first : 1 - 0.6 * p.answer;
  return (
    <GraphPlane cf={cf} s={p} id={id} t={p.show}>
      <g clipPath={`url(#${id})`}>
        {FAMILY_A.map((a, i) => (
          <g key={a}>{draw(familyMember(fig, a), p.palette[i % p.palette.length]!, p.figureStroke * 1.2, 0.55 * fade)}</g>
        ))}
        {lens && draw(familyMember(fig, frozenA), p.ink, p.figureStroke * 1.8, p.first * (1 - 0.6 * p.second), undefined, 'frozen')}
        {!lens && draw(familyMember(fig, frozenA), p.accent, p.lensStroke, p.answer, undefined, 'member')}
        {lens && draw(br.aPart, p.palette[0]!, p.lensStroke, p.second, undefined, 'bracket-a')}
        {lens && draw(br.rest, p.palette[1]!, p.lensStroke, p.second, undefined, 'bracket-rest')}
      </g>
      {given && (
        <g>
          {dot(cf.at(given), p.ink, r)}
          {tag(p, cf.at(given), coordText(given), 0.6, -0.8, p.ink)}
        </g>
      )}
      {lens && F && p.second > 0 && (
        <g data-part="fixed" opacity={p.second}>
          <circle cx={cf.at(F)[0]} cy={cf.at(F)[1]} r={r * 2.2} fill="none" stroke={p.accent} strokeWidth={p.figureStroke * 1.5} />
          {dot(cf.at(F), p.accent, r * 1.2)}
          {p.answer > 0 && tag(p, cf.at(F), answerText(card), 0.9, -0.9, p.accent, 'start', p.answer, 'answer')}
        </g>
      )}
    </GraphPlane>
  );
}
