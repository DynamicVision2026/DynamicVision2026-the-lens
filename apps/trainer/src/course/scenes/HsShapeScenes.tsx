// WO-023: the High School drag scenes that are not graphs.
//   展開 (cone_unfold): pull the cone's side open into its sector (snaps fully open), then pull A straight
//     across to A′ (or B′); it snaps only there.
//   面積図 (dice_grid): paint the cells of the 6×6 table that satisfy the condition; a cell that doesn't is
//     refused; it snaps when exactly those cells are painted.
//   差一定 (const_sum): drag the split of the fixed sum; the rectangle (or the two squares) follows, and it
//     snaps at the centre.
//   てんびん (triangle_cevians): slide the fulcrum P along AD (or BE); it balances only where AD and BE cross.
// Positions come from the figure fields; printed values from the card (fields, steps, answer).
import {
  afterEquals,
  answerText,
  diceCells,
  diceMatch,
  sectorAngle,
  sumBar,
  weightsIn,
  type ConeUnfoldFigure,
  type ConstSumFigure,
  type DiceGridFigure,
  type TriangleCeviansFigure,
} from '@lens/scenes';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { sfx, springTo, TACTILE } from '../fx';
import { C, clamp, Knob, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';

type XY = [number, number];
const lerp = (a: XY, b: XY, k: number): XY => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

// ------------------------------------------------------------------ 展開 ---

/** The opened sector: centre, radius and the A end's angle (SVG angles; the bisector points down). */
export function coneLayout(fig: ConeUnfoldFigure) {
  const theta = (sectorAngle(fig) * Math.PI) / 180;
  const half = theta / 2;
  const a1 = Math.PI / 2 + half;
  // Fit the full sector (and its centre) into the right part of the scene.
  const xs = [0];
  const ys = [0];
  for (let i = 0; i <= 48; i++) {
    const a = a1 - (theta * i) / 48;
    xs.push(Math.cos(a));
    ys.push(Math.sin(a));
  }
  const [bx0, by0, bx1, by1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const box = { x: 230, y: 60, w: 350, h: 320 };
  const R = Math.min(box.w / (bx1 - bx0), box.h / (by1 - by0));
  const O: XY = [box.x + box.w / 2 - ((bx0 + bx1) / 2) * R, box.y - by0 * R];
  const at = (ang: number, rr = R): XY => [O[0] + Math.cos(ang) * rr, O[1] + Math.sin(ang) * rr];
  const A = at(a1);
  const Ar = at(a1 - theta);
  const target = fig.ask === 'to_point' ? at(a1 - theta, (R * (fig.d ?? 0)) / fig.l) : Ar;
  return { theta, a1, R, O, at, A, Ar, target };
}

/** Opening snaps once the sector is this far open. */
const OPEN_SNAP = 0.85;
/** The string's end snaps within this many pixels of A′ / B′. */
const CHORD_SNAP_PX = 28;

export function ConeScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as ConeUnfoldFigure;
  const L = coneLayout(fig);
  const color = C.lens(lens);
  const unit = card.problem.unit.replace('²', '') || 'cm';
  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [u, setU] = useState(0.12);
  const uRef = useRef(u);
  uRef.current = u;
  const [phase, setPhase] = useState<1 | 2 | 3>(1);
  const [end, setEnd] = useState<XY>(L.A);
  const endRef = useRef(end);
  endRef.current = end;
  const edge = (k: number) => L.at(L.a1 - L.theta * k);

  useEffect(() => {
    guide.coach({ phase: 'hsopen', text: t('guide.hs.open'), svg, from: () => edge(uRef.current), to: () => edge(Math.min(1, uRef.current + 0.5)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const openDown = drag({
    move: (p) => {
      if (phase !== 1) return;
      let ang = Math.atan2(p.y - L.O[1], p.x - L.O[0]);
      // Measure clockwise from the A side, wrapping past −π.
      let span = L.a1 - ang;
      while (span < -Math.PI / 2) span += 2 * Math.PI;
      while (span > 2 * Math.PI - Math.PI / 2) span -= 2 * Math.PI;
      ang = span;
      setU(clamp(ang / L.theta, 0.05, 1.05));
    },
    end: () => {
      if (phase !== 1) return;
      const cur = uRef.current;
      if (cur > OPEN_SNAP) {
        springTo('cone-open', cur, 1, setU, {
          ...TACTILE.snap,
          done: () => {
            sfx.snap();
            setPhase(2);
            guide.coach({ phase: 'hschord', text: t('guide.hs.chord'), svg, from: L.A, to: L.target });
          },
        });
      } else guide.say(t('guide.hs.open'));
    },
  });

  const chordDown = drag({
    move: (p) => phase === 2 && setEnd([p.x, p.y]),
    end: () => {
      if (phase !== 2) return;
      const cur = endRef.current;
      if (Math.hypot(cur[0] - L.target[0], cur[1] - L.target[1]) < CHORD_SNAP_PX) {
        setEnd(L.target);
        setPhase(3);
        sfx.snap();
        window.setTimeout(onSolved, 600);
      } else {
        setEnd(L.A);
        guide.say(t('guide.hs.chordRetry'));
      }
    },
  });

  const arc = Array.from({ length: 61 }, (_, i) => L.at(L.a1 - (L.theta * u * i) / 60));
  const sector = `${L.O.join(',')} ${arc.map((q) => q.join(',')).join(' ')}`;
  // The cone, small, on the left (r and l from the fields).
  const coneH = Math.sqrt(Math.max(1e-6, fig.l * fig.l - fig.r * fig.r));
  const cs = Math.min(70 / fig.r, 260 / (coneH + fig.r * 0.35));
  const apex: XY = [110, 80];
  const baseY = apex[1] + coneH * cs;
  const br = fig.r * cs;
  const len = (v: number) => `${v}${unit}`;
  const toPoint = fig.ask === 'to_point';
  return (
    <svg ref={svg} viewBox="0 0 600 440" className="fig" data-testid="scene-cone">
      <g opacity={phase === 1 ? 1 : 0.45}>
        <polyline points={`${apex[0] - br},${baseY} ${apex[0]},${apex[1]} ${apex[0] + br},${baseY}`} fill="none" stroke={C.ink} strokeWidth={2.5} strokeLinejoin="round" />
        <ellipse cx={apex[0]} cy={baseY} rx={br} ry={br * 0.32} fill="none" stroke={C.ink} strokeWidth={2} />
        <line x1={apex[0]} y1={baseY} x2={apex[0] + br} y2={baseY} stroke={C.ink} strokeDasharray="5 5" />
        <Txt x={apex[0] + br / 2} y={baseY - 10} size={14} fill={C.quiet}>
          {len(fig.r)}
        </Txt>
        <Txt x={apex[0] - br / 2 - 26} y={(apex[1] + baseY) / 2} size={14} fill={C.quiet}>
          {len(fig.l)}
        </Txt>
        <Txt x={apex[0]} y={apex[1] - 12} size={16} fill={C.quiet}>
          O
        </Txt>
      </g>
      <polygon points={sector} fill={C.palette[0]} fillOpacity={0.22} stroke={C.ink} strokeWidth={2.5} strokeLinejoin="round" />
      <circle cx={L.O[0]} cy={L.O[1]} r={5} fill={C.ink} />
      <Txt x={L.O[0]} y={L.O[1] - 12} size={16} fill={C.quiet}>
        O
      </Txt>
      <Txt x={(L.O[0] + L.A[0]) / 2 - 24} y={(L.O[1] + L.A[1]) / 2} size={14} fill={C.quiet}>
        {len(fig.l)}
      </Txt>
      <circle cx={L.A[0]} cy={L.A[1]} r={6} fill={color} />
      <Txt x={L.A[0] - 16} y={L.A[1] + 6} size={16} fill={color}>
        A
      </Txt>
      {phase >= 2 && (
        <g>
          <circle cx={L.target[0]} cy={L.target[1]} r={6} fill={color} />
          <Txt x={L.target[0] + 18} y={L.target[1] + 6} size={16} fill={color}>
            {toPoint ? 'B′' : 'A′'}
          </Txt>
          {toPoint && fig.d !== undefined && (
            <Txt x={(L.O[0] + L.target[0]) / 2 + 26} y={(L.O[1] + L.target[1]) / 2} size={14} fill={C.quiet}>
              {len(fig.d)}
            </Txt>
          )}
        </g>
      )}
      {phase >= 2 && <line x1={L.A[0]} y1={L.A[1]} x2={end[0]} y2={end[1]} stroke={color} strokeWidth={phase === 3 ? 5 : 3} strokeLinecap="round" />}
      {phase === 3 && (
        <Txt x={(L.A[0] + L.target[0]) / 2} y={(L.A[1] + L.target[1]) / 2 + 28} size={20} fill={color} className="appear">
          {answerText(card)}
        </Txt>
      )}
      {phase === 1 && <Knob x={edge(u)[0]} y={edge(u)[1]} fill={color} r={13} onDown={openDown} />}
      {phase === 2 && <Knob x={end[0]} y={end[1]} fill={color} r={13} onDown={chordDown} />}
    </svg>
  );
}

// ---------------------------------------------------------------- 面積図 ---

const CELL = 50;
const GX = 160;
const GY = 70;

export function DiceScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as DiceGridFigure;
  const cells = diceCells(fig);
  const want = new Set(cells.map(([b, s]) => `${b}-${s}`));
  const color = C.lens(lens);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [painted, setPainted] = useState<Set<string>>(() => new Set());
  const paintedRef = useRef(painted);
  paintedRef.current = painted;
  const [wrong, setWrong] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const centreOf = (b: number, s: number): XY => [GX + (b - 0.5) * CELL, GY + (s - 0.5) * CELL];

  useEffect(() => {
    const first = cells[0]!;
    const lastOfRow = cells.filter((c) => c[1] === first[1]).at(-1)!;
    guide.coach({ phase: 'hspaint', text: t('guide.hs.paint'), svg, from: centreOf(...first), to: centreOf(...(lastOfRow === first ? cells.at(-1)! : lastOfRow)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const cellAt = (x: number, y: number): [number, number] | null => {
    const b = Math.floor((x - GX) / CELL) + 1;
    const s = Math.floor((y - GY) / CELL) + 1;
    return b >= 1 && b <= 6 && s >= 1 && s <= 6 ? [b, s] : null;
  };
  let warned = false;
  const paint = (x: number, y: number) => {
    if (done) return;
    const c = cellAt(x, y);
    if (!c) return;
    const key = `${c[0]}-${c[1]}`;
    if (diceMatch(fig.cond, c[0], c[1])) {
      if (!paintedRef.current.has(key)) {
        const next = new Set(paintedRef.current).add(key);
        paintedRef.current = next;
        setPainted(next);
      }
    } else {
      setWrong(key);
      if (!warned) guide.say(t('guide.hs.paintNo'));
      warned = true;
    }
  };
  const down = drag({
    start: (p) => paint(p.x, p.y),
    move: (p) => paint(p.x, p.y),
    end: () => {
      setWrong(null);
      if (!done && [...want].every((k) => paintedRef.current.has(k))) {
        setDone(true);
        sfx.snap();
        window.setTimeout(onSolved, 600);
      }
    },
  });

  return (
    <svg ref={svg} viewBox="0 0 600 440" className="fig" data-testid="scene-dice">
      <Txt x={GX + CELL * 3} y={GY - 36} size={16} fill={C.ink}>
        大
      </Txt>
      <Txt x={GX - 46} y={GY + CELL * 3 + 6} size={16} fill={C.ink}>
        小
      </Txt>
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i}>
          <Txt className="tick" x={GX + (i + 0.5) * CELL} y={GY - 10} size={14} fill={C.quiet}>
            {String(i + 1)}
          </Txt>
          <Txt className="tick" x={GX - 16} y={GY + (i + 0.5) * CELL + 5} size={14} fill={C.quiet}>
            {String(i + 1)}
          </Txt>
        </g>
      ))}
      {[...painted].map((k) => {
        const [b, s] = k.split('-').map(Number) as [number, number];
        return <rect key={k} data-cell={k} x={GX + (b - 1) * CELL} y={GY + (s - 1) * CELL} width={CELL} height={CELL} fill={color} fillOpacity={done ? 0.6 : 0.42} />;
      })}
      {wrong && (() => {
        const [b, s] = wrong.split('-').map(Number) as [number, number];
        return <rect x={GX + (b - 1) * CELL} y={GY + (s - 1) * CELL} width={CELL} height={CELL} fill={C.flag} fillOpacity={0.45} />;
      })()}
      {Array.from({ length: 7 }, (_, i) => (
        <g key={i} stroke={C.ink} strokeWidth={i === 0 || i === 6 ? 2.5 : 1} opacity={i === 0 || i === 6 ? 1 : 0.5}>
          <line x1={GX + i * CELL} y1={GY} x2={GX + i * CELL} y2={GY + 6 * CELL} />
          <line x1={GX} y1={GY + i * CELL} x2={GX + 6 * CELL} y2={GY + i * CELL} />
        </g>
      ))}
      <rect x={GX} y={GY} width={6 * CELL} height={6 * CELL} fill="transparent" style={{ touchAction: 'none', cursor: 'crosshair' }} onPointerDown={down} data-part="paint" />
      {done && (
        <Txt x={GX + CELL * 3} y={GY + CELL * 6 + 34} size={22} fill={color} className="appear">
          {answerText(card)}
        </Txt>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------- 差一定 ---

/** Snaps within this fraction of the total of the centre. */
const CENTRE_SNAP = 0.05;

export function SumScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as ConstSumFigure;
  const bar = sumBar(fig);
  const T = bar.total;
  const [u, v] = fig.shift ?? [0, 0];
  const squares = fig.ask === 'min_squares';
  const color = C.lens(lens);
  const k = 480 / T;
  const X = (val: number) => 60 + val * k;
  const by = 70;
  const bh = 36;
  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [split, setSplit] = useState(bar.start);
  const splitRef = useRef(split);
  splitRef.current = split;
  const [done, setDone] = useState(false);

  useEffect(() => {
    guide.coach({ phase: 'hssplit', text: t(squares ? 'guide.hs.splitSquares' : 'guide.hs.split'), svg, from: () => [X(splitRef.current), by + bh / 2], to: () => [X(T / 2), by + bh / 2] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const down = drag({
    move: (p) => !done && setSplit(clamp((p.x - 60) / k, T * 0.06, T * 0.94)),
    end: () => {
      if (done) return;
      const cur = splitRef.current;
      if (Math.abs(cur - T / 2) < T * CENTRE_SNAP) {
        setDone(true);
        springTo('sum-split', cur, T / 2, setSplit, {
          ...TACTILE.snap,
          done: () => {
            sfx.snap();
            window.setTimeout(onSolved, 600);
          },
        });
      } else guide.say(t('guide.hs.centre'));
    },
  });

  const name = (c: number | undefined, n: string) => (c === undefined || c === 1 ? n : `${c}${n}`);
  const nx = name(fig.p, 'x');
  const ny = name(fig.q, 'y');
  const sx = u ? `${nx}＋${u}` : nx;
  const sy = v ? `${ny}＋${v}` : ny;
  const wX = split;
  const wY = T - split;
  const top = by + bh + 50;
  const room = 440 - top - 20;
  const scale = squares ? Math.min(420 / T, room / Math.max(wX, wY)) : Math.min(380 / T, room / Math.max(wY, T * 0.94));
  // A meter (no numbers): how close the product (or the sum of squares) is to its best.
  const best = squares ? (T * T) / 2 / (wX * wX + wY * wY) : (wX * wY) / ((T * T) / 4);
  return (
    <svg ref={svg} viewBox="0 0 600 440" className="fig" data-testid="scene-sum">
      <StripeDefs />
      <rect x={X(0)} y={by} width={X(split) - X(0)} height={bh} fill={C.palette[0]} fillOpacity={0.5} />
      <rect x={X(split)} y={by} width={X(T) - X(split)} height={bh} fill={C.palette[1]} fillOpacity={0.5} />
      <rect x={X(0)} y={by} width={X(T) - X(0)} height={bh} fill="none" stroke={C.ink} strokeWidth={2.5} />
      {u > 0 && <line x1={X(u)} y1={by} x2={X(u)} y2={by + bh} stroke={C.ink} strokeDasharray="5 5" />}
      {v > 0 && <line x1={X(T - v)} y1={by} x2={X(T - v)} y2={by + bh} stroke={C.ink} strokeDasharray="5 5" />}
      <Txt x={(X(u) + X(T - v)) / 2} y={by - 12} size={16} fill={C.ink}>
        {String(fig.s)}
      </Txt>
      <Txt x={(X(u) + X(split)) / 2} y={by + bh / 2 + 6} size={16} fill={C.ink}>
        {nx}
      </Txt>
      <Txt x={(X(split) + X(T - v)) / 2} y={by + bh / 2 + 6} size={16} fill={C.ink}>
        {ny}
      </Txt>
      {squares ? (
        <g>
          <rect x={60} y={top} width={wX * scale} height={wX * scale} fill={C.palette[0]} fillOpacity={0.35} stroke={C.ink} strokeWidth={2} />
          <rect x={60 + wX * scale + 16} y={top} width={wY * scale} height={wY * scale} fill={C.palette[1]} fillOpacity={0.35} stroke={C.ink} strokeWidth={2} />
          <Txt x={60 + (wX * scale) / 2} y={top + (wX * scale) / 2 + 6} size={16} fill={C.ink}>{`${nx}²`}</Txt>
          <Txt x={60 + wX * scale + 16 + (wY * scale) / 2} y={top + (wY * scale) / 2 + 6} size={16} fill={C.ink}>{`${ny}²`}</Txt>
        </g>
      ) : (
        <g>
          <rect x={90} y={top} width={wX * scale} height={wY * scale} fill={done ? 'url(#st1)' : C.palette[1]} fillOpacity={done ? 1 : 0.3} stroke={done ? color : C.ink} strokeWidth={done ? 3 : 2} />
          <Txt x={90 + (wX * scale) / 2} y={top - 10} size={16} fill={C.ink}>
            {sx}
          </Txt>
          <Txt x={80} y={top + (wY * scale) / 2 + 6} size={16} fill={C.ink} anchor="end">
            {sy}
          </Txt>
        </g>
      )}
      {/* The meter fills as the split nears the centre. */}
      <rect x={560} y={top} width={18} height={room - 10} rx={9} fill="none" stroke={C.line} strokeWidth={2} />
      <rect x={560} y={top + (room - 10) * (1 - best)} width={18} height={(room - 10) * best} rx={9} fill={color} opacity={0.8} />
      {done && (
        <Txt x={squares ? 300 : 90 + (wX * scale) / 2} y={squares ? top + room - 20 : top + (wY * scale) / 2 + 8} size={24} fill={color} className="appear">
          {answerText(card)}
        </Txt>
      )}
      {!done && <Knob x={X(split)} y={by + bh / 2} fill={color} r={13} onDown={down} />}
      {done && <line x1={X(T / 2)} y1={by - 6} x2={X(T / 2)} y2={by + bh + 6} stroke={color} strokeWidth={4} />}
    </svg>
  );
}

// -------------------------------------------------------------- てんびん ---

/** Where AD and BE cross (drawing only). */
function cross(a: XY, d: XY, b: XY, e: XY): XY {
  const r: XY = [d[0] - a[0], d[1] - a[1]];
  const s: XY = [e[0] - b[0], e[1] - b[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  const k = ((b[0] - a[0]) * s[1] - (b[1] - a[1]) * s[0]) / den;
  return [a[0] + r[0] * k, a[1] + r[1] * k];
}

/** The triangle's corners and the cevians, in scene units (the same shape as the static figure). */
export function ceviansLayout(fig: TriangleCeviansFigure) {
  const A: XY = [230, 56];
  const B: XY = [50, 372];
  const C2: XY = [550, 372];
  const D = lerp(B, C2, fig.bd / (fig.bd + fig.dc));
  const E = lerp(C2, A, fig.ce / (fig.ce + fig.ea));
  const P = cross(A, D, B, E);
  const onBE = fig.ask === 'bp_pe';
  const [L0, L1] = onBE ? [B, E] : [A, D];
  const target = Math.hypot(P[0] - L0[0], P[1] - L0[1]) / Math.hypot(L1[0] - L0[0], L1[1] - L0[1]);
  return { A, B, C: C2, D, E, P, L0, L1, target, onBE };
}

/** The fulcrum snaps within this fraction of the cevian. */
const FULCRUM_SNAP = 0.04;

export function CeviansScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as TriangleCeviansFigure;
  const L = ceviansLayout(fig);
  const color = C.lens(lens);
  const steps = card.lens_route.steps;
  const w = weightsIn(steps.find((s) => weightsIn(s)));
  const gathered = afterEquals(steps.find((s, i) => i > 0 && /集まる/.test(s.ja)));
  // The two weights on the beam (printed from the steps), and their sizes for the tilt (drawing only).
  const w0 = (L.onBE ? w?.B : w?.A) ?? '';
  const w1 = gathered ?? '';
  const n0 = Number(w0) || 1;
  const n1 = Number(w1) || 1;
  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [k, setK] = useState(L.target > 0.5 ? 0.25 : 0.75);
  const kRef = useRef(k);
  kRef.current = k;
  const [done, setDone] = useState(false);
  const dir: XY = [L.L1[0] - L.L0[0], L.L1[1] - L.L0[1]];
  const len2 = dir[0] * dir[0] + dir[1] * dir[1];
  const F = lerp(L.L0, L.L1, k);

  useEffect(() => {
    guide.coach({ phase: 'hsfulcrum', text: t('guide.hs.fulcrum'), svg, from: () => lerp(L.L0, L.L1, kRef.current), to: () => lerp(L.L0, L.L1, L.target) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const down = drag({
    move: (p) => !done && setK(clamp(((p.x - L.L0[0]) * dir[0] + (p.y - L.L0[1]) * dir[1]) / len2, 0.05, 0.95)),
    end: () => {
      if (done) return;
      const cur = kRef.current;
      if (Math.abs(cur - L.target) < FULCRUM_SNAP) {
        setDone(true);
        springTo('cev-fulcrum', cur, L.target, setK, {
          ...TACTILE.snap,
          done: () => {
            sfx.snap();
            window.setTimeout(onSolved, 600);
          },
        });
      } else guide.say(t('guide.hs.fulcrumRetry'));
    },
  });

  // The beam tilts toward the heavier side about the fulcrum (torque: weight × arm); flat at balance.
  const torque = n0 * k - n1 * (1 - k);
  const tilt = done ? 0 : clamp(torque / (n0 + n1), -1, 1) * 0.35;
  const ang = Math.atan2(dir[1], dir[0]) + tilt;
  const half = Math.sqrt(len2) / 2;
  const beam: [XY, XY] = [
    [F[0] - Math.cos(ang) * half * 2 * k, F[1] - Math.sin(ang) * half * 2 * k],
    [F[0] + Math.cos(ang) * half * 2 * (1 - k), F[1] + Math.sin(ang) * half * 2 * (1 - k)],
  ];
  const disc = (q: XY, n: string, dx: number, dy: number) =>
    n ? (
      <g>
        <circle cx={q[0] + dx} cy={q[1] + dy} r={15} fill={color} />
        <Txt x={q[0] + dx} y={q[1] + dy + 5} size={15} fill={C.paper}>
          {n}
        </Txt>
      </g>
    ) : null;
  const tri = `${L.A.join(',')} ${L.B.join(',')} ${L.C.join(',')}`;
  return (
    <svg ref={svg} viewBox="0 0 600 440" className="fig" data-testid="scene-cevians">
      <polygon points={tri} fill={C.palette[0]} fillOpacity={0.08} stroke={C.ink} strokeWidth={2.5} strokeLinejoin="round" />
      <line x1={L.A[0]} y1={L.A[1]} x2={L.D[0]} y2={L.D[1]} stroke={C.quiet} strokeWidth={2} />
      <line x1={L.B[0]} y1={L.B[1]} x2={L.E[0]} y2={L.E[1]} stroke={C.quiet} strokeWidth={2} />
      {/* The beam on the cevian, tilting until it balances. */}
      <line x1={beam[0][0]} y1={beam[0][1]} x2={beam[1][0]} y2={beam[1][1]} stroke={color} strokeWidth={5} strokeLinecap="round" opacity={0.85} />
      {/* The weights beside the beam's ends, clear of the point names. */}
      {disc(L.L0, w0, L.onBE ? -10 : -34, L.onBE ? -30 : 4)}
      {disc(L.L1, w1, L.onBE ? 10 : 30, L.onBE ? -36 : 28)}
      {(
        [
          ['A', L.A, 0, -14],
          ['B', L.B, -16, 8],
          ['C', L.C, 16, 8],
          ['D', L.D, 0, 26],
          ['E', L.E, 18, -6],
        ] as const
      ).map(([n, q, dx, dy]) => (
        <Txt key={n} x={q[0] + dx} y={q[1] + dy} size={16} fill={C.quiet}>
          {n}
        </Txt>
      ))}
      {done && (
        <g className="appear">
          <circle cx={L.P[0]} cy={L.P[1]} r={8} fill={color} />
          <Txt x={L.P[0] + 18} y={L.P[1] - 14} anchor="start" size={20} fill={color}>
            {answerText(card)}
          </Txt>
        </g>
      )}
      {!done && <Knob x={F[0]} y={F[1]} fill={color} r={13} onDown={down} />}
    </svg>
  );
}
