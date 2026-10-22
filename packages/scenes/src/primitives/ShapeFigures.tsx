import { tc } from '../bundle';
// WO-023: the Stage 3 figures that are not graphs: the cone opened into a sector (展開), two dice as a 6×6
// table (面積図) and a fixed sum as a bar split in two (差一定). Positions come from the figure fields; printed
// numbers from the fields, the steps or the answer. The table's 1–6 headers are its scale (data-tick).
import { answerText } from '../format';
import { diceCells, sectorAngle, sumBar } from '../stage3';
import type { ConeUnfoldFigure, ConstSumFigure, DiceGridFigure, LensCard } from '../types';
import type { CoordPlaneStyle } from './CoordPlaneFigure';

type XY = [number, number];
const pts = (ps: XY[]) => ps.map((q) => q.join(',')).join(' ');
const COPY = { O: 'O', A: 'A', Ar: "A'", Br: "B'", big: '大', small: '小', no: '✕', x: 'x', y: 'y' } as const;

export interface ShapeProps extends CoordPlaneStyle {
  card: LensCard;
  show: number;
  first: number;
  second: number;
  answer: number;
}

function text(s: CoordPlaneStyle, q: XY, body: string, c: string, opts: { anchor?: 'start' | 'middle' | 'end'; size?: number; o?: number; part?: string; tick?: boolean } = {}) {
  if ((opts.o ?? 1) <= 0) return null;
  return (
    <text
      data-part={opts.part}
      data-tick={opts.tick ? '' : undefined}
      x={q[0]}
      y={q[1]}
      fill={c}
      opacity={opts.o ?? 1}
      fontFamily={s.font}
      fontSize={s.labelSize * (opts.size ?? 0.9)}
      fontWeight={s.weight}
      textAnchor={opts.anchor ?? 'middle'}
      dominantBaseline="central"
    >
      {body}
    </text>
  );
}

const dot = (q: XY, c: string, r: number, o = 1) => <circle cx={q[0]} cy={q[1]} r={r} fill={c} opacity={o} />;

// ------------------------------------------------------------------ 展開 ---

export interface ConeProps extends ShapeProps {
  fig: ConeUnfoldFigure;
}

/** Unit-circle points of the sector (centre at the origin, bisector pointing down), for fitting. */
function sectorUnit(theta: number): { a0: number; a1: number; bbox: [number, number, number, number] } {
  const half = (theta * Math.PI) / 360;
  const a0 = Math.PI / 2 - half;
  const a1 = Math.PI / 2 + half;
  const xs = [0];
  const ys = [0];
  for (let i = 0; i <= 48; i++) {
    const a = a0 + ((a1 - a0) * i) / 48;
    xs.push(Math.cos(a));
    ys.push(Math.sin(a));
  }
  return { a0, a1, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}

/**
 * WO-023 cone_unfold: the cone (2D sketch) with r and l; open_sector opens its side into a sector of radius l;
 * draw_straight draws the chord A–A′ (or A–B′ with OB′ = d). Through the apex (sector ≥ 180°) the chord leaves
 * the sector, so it is dashed and the path through O is drawn.
 */
export function ConeFigure(p: ConeProps) {
  const { fig, card } = p;
  if (p.show <= 0) return null;
  const [rx, ry, rw, rh] = p.region;
  const size = p.labelSize;
  const unit = card.problem.unit.replace('²', '') || 'cm';
  // The cone on the left third.
  const cw = rw * 0.32;
  const coneH = Math.sqrt(Math.max(1e-6, fig.l * fig.l - fig.r * fig.r));
  const cs = Math.min((cw - size) / (2 * fig.r), (rh - size * 4) / (coneH + fig.r * 0.35));
  const apex: XY = [rx + cw / 2, ry + size * 1.5];
  const baseY = apex[1] + coneH * cs;
  const br = fig.r * cs;
  const ell = br * 0.32;
  const Ac: XY = [apex[0], baseY + ell];
  // The sector on the right two thirds.
  const theta = sectorAngle(fig);
  const u = sectorUnit(theta);
  const sx = rx + cw + size * 1.5;
  const sw = rw - cw - size * 2;
  const sh = rh - size * 3;
  const R = Math.min(sw / (u.bbox[2] - u.bbox[0]), sh / (u.bbox[3] - u.bbox[1]));
  const O: XY = [sx + sw / 2 - ((u.bbox[0] + u.bbox[2]) / 2) * R, ry + size * 1.2 - u.bbox[1] * R];
  const sideArea = fig.ask === 'side_area';
  const apexPath = fig.expect === 'through_apex';
  // While it opens, the sector grows from a sliver to its full angle (the walkthrough cards show it opened, with the answer).
  const walk = sideArea || apexPath;
  const open = walk ? p.answer : p.first;
  const half = ((theta * Math.PI) / 360) * (walk ? 1 : Math.max(0.02, open));
  const a0 = Math.PI / 2 - half;
  const a1 = Math.PI / 2 + half;
  const at = (a: number, rr = R): XY => [O[0] + Math.cos(a) * rr, O[1] + Math.sin(a) * rr];
  const arc = Array.from({ length: 65 }, (_, i) => at(a1 - ((a1 - a0) * i) / 64));
  const A = at(a1);
  const Ar = at(a0);
  const toPoint = fig.ask === 'to_point';
  const Bp = toPoint ? at(a0, (R * (fig.d ?? 0)) / fig.l) : Ar;
  const st = p.second;
  const end: XY = [A[0] + (Bp[0] - A[0]) * st, A[1] + (Bp[1] - A[1]) * st];
  const r = p.figureStroke * 2.4;
  const len = (v: number) => `${v}${unit}`;
  const showSector = open > 0;
  const sectorO = open;
  return (
    <g opacity={p.show}>
      {/* The cone: slant sides, the base ellipse (back half dashed), r and l. */}
      <g opacity={1 - 0.45 * open}>
        <polyline points={pts([[apex[0] - br, baseY], apex, [apex[0] + br, baseY]])} fill="none" stroke={p.ink} strokeWidth={p.figureStroke * 1.4} strokeLinejoin="round" />
        <path d={`M ${apex[0] - br} ${baseY} A ${br} ${ell} 0 0 0 ${apex[0] + br} ${baseY}`} fill="none" stroke={p.ink} strokeWidth={p.figureStroke * 1.4} />
        <path d={`M ${apex[0] - br} ${baseY} A ${br} ${ell} 0 0 1 ${apex[0] + br} ${baseY}`} fill="none" stroke={p.ink} strokeWidth={p.figureStroke} strokeDasharray={p.dash} />
        <line x1={apex[0]} y1={baseY} x2={apex[0] + br} y2={baseY} stroke={p.ink} strokeWidth={p.figureStroke} strokeDasharray={p.dash} />
        {dot(apex, p.ink, r)}
        {dot(Ac, p.accent, r)}
        {text(p, [apex[0], apex[1] - size * 0.9], COPY.O, p.ink)}
        {text(p, [Ac[0], Ac[1] + size * 0.9], COPY.A, p.accent)}
        {text(p, [apex[0] + br / 2, baseY - size * 0.6], len(fig.r), p.ink, { size: 0.8 })}
        {text(p, [(apex[0] + apex[0] - br) / 2 - size * 1.3, (apex[1] + baseY) / 2], len(fig.l), p.ink, { size: 0.8 })}
      </g>
      {/* The opened side: a sector of radius l. */}
      {showSector && (
        <g data-part="sector" opacity={sectorO}>
          <polygon points={pts([O, ...arc])} fill={p.palette[0]} fillOpacity={p.tint * (sideArea ? 2.4 * Math.max(p.answer, 0.3) : 1.2)} stroke={p.ink} strokeWidth={p.figureStroke * 1.4} strokeLinejoin="round" />
          {dot(O, p.ink, r)}
          {text(p, [O[0], O[1] - size * 0.9], COPY.O, p.ink)}
          {!sideArea && (
            <g>
              {dot(A, p.accent, r)}
              {text(p, [A[0] - size * 0.9, A[1] + size * 0.4], COPY.A, p.accent)}
              {!toPoint && dot(Ar, p.accent, r)}
              {!toPoint && text(p, [Ar[0] + size * 0.9, Ar[1] + size * 0.4], COPY.Ar, p.accent)}
              {toPoint && dot(Bp, p.accent, r)}
              {toPoint && text(p, [Bp[0] + size * 0.9, Bp[1]], COPY.Br, p.accent)}
            </g>
          )}
          {text(p, [(O[0] + A[0]) / 2 - size * 1.2, (O[1] + A[1]) / 2], len(fig.l), p.ink, { size: 0.8 })}
          {toPoint && fig.d !== undefined && text(p, [(O[0] + Bp[0]) / 2 + size * 1.2, (O[1] + Bp[1]) / 2], len(fig.d), p.ink, { size: 0.8 })}
        </g>
      )}
      {/* The chord (the lens), or through the apex when the chord leaves the sector. */}
      {!sideArea && !apexPath && st > 0 && (
        <g data-part="chord">
          {p.glowFilter && <line x1={A[0]} y1={A[1]} x2={end[0]} y2={end[1]} stroke={p.accent} strokeWidth={p.lensStroke} filter={p.glowFilter} opacity={p.glowOpacity ?? 1} />}
          <line x1={A[0]} y1={A[1]} x2={end[0]} y2={end[1]} stroke={p.accent} strokeWidth={p.lensStroke} strokeLinecap="round" />
        </g>
      )}
      {apexPath && p.answer > 0 && (
        <g data-part="apex-path" opacity={p.answer}>
          <line x1={A[0]} y1={A[1]} x2={Bp[0]} y2={Bp[1]} stroke={p.flag} strokeWidth={p.figureStroke * 1.4} strokeDasharray={p.dash} />
          <polyline points={pts([A, O, Bp])} fill="none" stroke={p.accent} strokeWidth={p.lensStroke} strokeLinejoin="round" />
        </g>
      )}
      {p.answer > 0 && text(p, sideArea ? [O[0], O[1] + R * 0.6] : apexPath ? [O[0] + size * 2.6, O[1] + R * 0.35] : [(A[0] + Bp[0]) / 2, (A[1] + Bp[1]) / 2 + size * 1.1], answerText(card), sideArea ? p.ink : p.accent, { o: p.answer, part: 'answer' })}
    </g>
  );
}

// ---------------------------------------------------------------- 面積図 ---

export interface DiceProps extends ShapeProps {
  fig: DiceGridFigure;
}

/**
 * WO-023 dice_grid: the 6×6 table (big die across, small die down), the cells that satisfy the condition
 * shaded (shade_cells), then outlined as one region (count_cells). Three dice (the failure card) do not fit
 * a flat table: it is drawn faded and struck.
 */
export function DiceFigure(p: DiceProps) {
  const { fig, card } = p;
  if (p.show <= 0) return null;
  const [rx, ry, rw, rh] = p.region;
  const size = p.labelSize;
  const three = (fig.dice ?? 2) === 3;
  const cell = Math.min((rw - size * 4) / 6, (rh - size * 4) / 6);
  const x0 = rx + (rw - cell * 6) / 2 + size;
  const y0 = ry + size * 2.6;
  const cells = three ? [] : diceCells(fig);
  // Lens cards shade on shade_cells; the walkthrough cards (show_grid → show_answer) on the answer.
  const shade = Math.max(p.first, p.answer);
  const n = cells.length;
  const at = (b: number, s: number): XY => [x0 + (b - 1) * cell, y0 + (s - 1) * cell];
  return (
    <g opacity={p.show}>
      {text(p, [x0 + cell * 3, y0 - size * 1.9], tc(COPY.big), p.ink, { size: 0.85 })}
      {text(p, [x0 - size * 2.1, y0 + cell * 3], tc(COPY.small), p.ink, { size: 0.85 })}
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i}>
          {text(p, [x0 + (i + 0.5) * cell, y0 - size * 0.75], String(i + 1), p.ink, { size: 0.8, tick: true })}
          {text(p, [x0 - size * 0.8, y0 + (i + 0.5) * cell], String(i + 1), p.ink, { size: 0.8, tick: true })}
        </g>
      ))}
      <g opacity={three ? 0.35 : 1}>
        {cells.map(([b, s], i) => {
          const [x, y] = at(b, s);
          // Shaded one after another while shade_cells plays.
          const o = Math.min(1, Math.max(0, shade * (n + 2) - i));
          return o > 0 ? <rect key={`${b}-${s}`} data-part="cell" x={x} y={y} width={cell} height={cell} fill={p.accent} fillOpacity={p.tint * 3 * o} stroke="none" /> : null;
        })}
        {Array.from({ length: 7 }, (_, i) => (
          <g key={i} stroke={p.ink} strokeWidth={i === 0 || i === 6 ? p.figureStroke * 1.4 : p.figureStroke * 0.6} opacity={i === 0 || i === 6 ? 1 : 0.5}>
            <line x1={x0 + i * cell} y1={y0} x2={x0 + i * cell} y2={y0 + 6 * cell} />
            <line x1={x0} y1={y0 + i * cell} x2={x0 + 6 * cell} y2={y0 + i * cell} />
          </g>
        ))}
        {/* count_cells: each counted cell outlined in the lens colour. */}
        {p.second > 0 &&
          cells.map(([b, s]) => {
            const [x, y] = at(b, s);
            return <rect key={`o${b}-${s}`} x={x + 1.5} y={y + 1.5} width={cell - 3} height={cell - 3} fill="none" stroke={p.accent} strokeWidth={p.figureStroke * 1.2} opacity={p.second} />;
          })}
      </g>
      {three && (
        <g data-part="no-table">
          <line x1={x0} y1={y0} x2={x0 + 6 * cell} y2={y0 + 6 * cell} stroke={p.flag} strokeWidth={p.lensStroke} />
          {text(p, [x0 + 6 * cell + size * 1.2, y0 + size * 0.2], COPY.no, p.flag, { size: 1.3 })}
        </g>
      )}
      {p.answer > 0 && text(p, [x0 + cell * 3, y0 + cell * 6 + size * 1.3], answerText(card), p.accent, { o: p.answer, part: 'answer', size: 1.1 })}
    </g>
  );
}

// ---------------------------------------------------------------- 差一定 ---

export interface SumBarProps extends ShapeProps {
  fig: ConstSumFigure;
}

/** The name of each part of the bar: 「x」 / 「2x」, and with a shift 「x＋2」. */
function partNames(fig: ConstSumFigure): [string, string] {
  const k = (c: number | undefined, v: string) => (c === undefined || c === 1 ? v : `${c}${v}`);
  return [k(fig.p, COPY.x), k(fig.q, COPY.y)];
}

/** The rectangle's sides: the bar's parts with the shift added (「x＋2」, 「y＋3」). */
function sideNames(fig: ConstSumFigure): [string, string] {
  const [u, v] = fig.shift ?? [0, 0];
  const [nx, ny] = partNames(fig);
  return [u ? `${nx}＋${u}` : nx, v ? `${ny}＋${v}` : ny];
}

/**
 * WO-023 const_sum: a bar of fixed length s split in two (px | qy, with the shift's u and v added at the ends);
 * below it, the rectangle (product) or the two squares (sum of squares) the split makes. split_centre moves
 * the split to the middle; the failure card has a wall at x_min that stops it short.
 */
export function SumBarFigure(p: SumBarProps) {
  const { fig, card } = p;
  if (p.show <= 0) return null;
  const [rx, ry, rw, rh] = p.region;
  const size = p.labelSize;
  const bar = sumBar(fig);
  const [u, v] = fig.shift ?? [0, 0];
  const total = bar.total;
  const k = (rw - size * 4) / total;
  const bx = rx + size * 2;
  const by = ry + size * 2.4;
  const bh = size * 1.6;
  const split = bar.start + (bar.end - bar.start) * (fig.ask === 'given_diff' ? 1 : p.first);
  const X = (val: number) => bx + val * k;
  const [nx, ny] = partNames(fig);
  const [sx, sy] = sideNames(fig);
  // Below: the rectangle X × Y (or two squares), scaled to fit under the bar.
  const room = rh - (by - ry) - bh - size * 3.5;
  const wX = split;
  const wY = total - split;
  const squares = fig.ask === 'min_squares';
  const scale = squares ? Math.min((rw - size * 6) / total, room / Math.max(wX, wY)) : Math.min((rw - size * 6) / Math.max(wX, total / 2), room / Math.max(wY, total / 2));
  const top = by + bh + size * 2.6;
  const left = bx;
  const centre = Math.abs(split - total / 2) < 1e-6;
  return (
    <g opacity={p.show}>
      {/* The bar: u | x … | … y | v; s over its middle part. */}
      <rect x={X(0)} y={by} width={X(total) - X(0)} height={bh} fill="none" stroke={p.ink} strokeWidth={p.figureStroke * 1.4} />
      <rect x={X(0)} y={by} width={X(split) - X(0)} height={bh} fill={p.palette[0]} fillOpacity={p.tint * 2.2} stroke="none" />
      <rect x={X(split)} y={by} width={X(total) - X(split)} height={bh} fill={p.palette[1]} fillOpacity={p.tint * 2.2} stroke="none" />
      {u > 0 && <line x1={X(u)} y1={by} x2={X(u)} y2={by + bh} stroke={p.ink} strokeWidth={p.figureStroke} strokeDasharray={p.dash} />}
      {v > 0 && <line x1={X(total - v)} y1={by} x2={X(total - v)} y2={by + bh} stroke={p.ink} strokeWidth={p.figureStroke} strokeDasharray={p.dash} />}
      {u > 0 && text(p, [(X(0) + X(u)) / 2, by + bh / 2], String(u), p.ink, { size: 0.8 })}
      {v > 0 && text(p, [(X(total - v) + X(total)) / 2, by + bh / 2], String(v), p.ink, { size: 0.8 })}
      {text(p, [(X(u) + X(total - v)) / 2, by - size * 0.9], String(fig.s), p.ink, { size: 0.9 })}
      {/* The split. */}
      <line data-part="split" data-x={split} x1={X(split)} y1={by - size * 0.4} x2={X(split)} y2={by + bh + size * 0.4} stroke={p.accent} strokeWidth={p.lensStroke} />
      {text(p, [(X(u) + X(split)) / 2, by + bh / 2], nx, p.ink, { size: 0.85 })}
      {text(p, [(X(split) + X(total - v)) / 2, by + bh / 2], ny, p.ink, { size: 0.85 })}
      {/* The failure card: x cannot go below x_min, so the split stops at the wall (past the centre). */}
      {bar.wall !== undefined && (
        <g data-part="wall">
          <line x1={X(bar.wall)} y1={by - size * 0.8} x2={X(bar.wall)} y2={by + bh + size * 0.8} stroke={p.flag} strokeWidth={p.lensStroke * 1.4} />
          <line x1={X(total / 2)} y1={by + bh} x2={X(total / 2)} y2={by + bh + size * 0.6} stroke={p.ink} strokeWidth={p.figureStroke} strokeDasharray={p.dash} />
        </g>
      )}
      {/* What the split makes: the rectangle (its area is the product) or the two squares. */}
      {squares ? (
        <g data-part="squares">
          <rect x={left} y={top} width={wX * scale} height={wX * scale} fill={p.palette[0]} fillOpacity={p.tint * 1.8} stroke={p.ink} strokeWidth={p.figureStroke} />
          <rect x={left + wX * scale + size} y={top} width={wY * scale} height={wY * scale} fill={p.palette[1]} fillOpacity={p.tint * 1.8} stroke={p.ink} strokeWidth={p.figureStroke} />
          {text(p, [left + (wX * scale) / 2, top + (wX * scale) / 2], `${nx}²`, p.ink, { size: 0.85 })}
          {text(p, [left + wX * scale + size + (wY * scale) / 2, top + (wY * scale) / 2], `${ny}²`, p.ink, { size: 0.85 })}
        </g>
      ) : (
        <g data-part="rect">
          <rect x={left} y={top} width={wX * scale} height={wY * scale} fill={p.accent} fillOpacity={p.tint * (centre ? 2.6 : 1.6)} stroke={centre ? p.accent : p.ink} strokeWidth={centre ? p.lensStroke : p.figureStroke} />
          {text(p, [left + (wX * scale) / 2, top - size * 0.7], sx, p.ink, { size: 0.85 })}
          {text(p, [left - size * 0.8, top + (wY * scale) / 2], sy, p.ink, { size: 0.85, anchor: 'end' })}
        </g>
      )}
      {p.answer > 0 && text(p, squares ? [left + (wX + wY) * scale + size * 3, top + size] : [left + (wX * scale) / 2, top + (wY * scale) / 2], answerText(card), p.accent, { o: p.answer, part: 'answer', size: 1.1, anchor: squares ? 'start' : 'middle' })}
    </g>
  );
}
