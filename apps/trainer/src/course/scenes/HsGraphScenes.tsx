// WO-023: the High School drag scenes on the coordinate plane.
//   囲む (parabola_area): two fences slide along the x-axis and snap at the crossings α, β; the region fills.
//   等積変形 (parabola_tri): a line kept parallel to AB slides; it snaps where it touches the parabola
//     (or, for equal_o, through O); P appears there.
//   折り返す (line_mirror): drag B across the slanted mirror ℓ; it snaps at B′; tap to draw A–B′.
//   止める (param_family): a runs back and forth; tap to freeze it; the two brackets light up and the fixed
//     point appears where they meet.
// Snap points are computed from the figure fields (drawing positions); printed values come from the card.
import {
  answerNumber,
  answerText,
  areaPoints,
  areaSpan,
  evalQ,
  familyBrackets,
  familyMember,
  familyPoint,
  mirrorPoints,
  triPoints,
  type LineMirrorFigure,
  type ParabolaAreaFigure,
  type ParabolaTriFigure,
  type ParamFamilyFigure,
  type Point,
  type Quadratic,
} from '@lens/scenes';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { everyFrame, reducedMotion, sfx, springTo, TACTILE } from '../fx';
import { coordLabel, CoordPlane, labelAt, plane } from './coordkit';
import { curvePoints, Legend, lineAcross, PlaneClip, quad } from './hskit';
import { C, clamp, Knob, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';

/** Fences snap within this many grid units of a crossing. */
const FENCE_SNAP = 0.35;

// ------------------------------------------------------------------ 囲む ---

export function ParabolaAreaScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as ParabolaAreaFigure;
  const [lo, hi] = areaSpan(fig);
  const P = plane(areaPoints(fig));
  const { X, Y } = P;
  const g: Quadratic = fig.g ?? [0, 0, 0];
  const color = C.lens(lens);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const mid = (lo + hi) / 2;
  const w = hi - lo;
  const [xs, setXs] = useState<[number, number]>([mid - w * 0.15, mid + w * 0.15]);
  const xsRef = useRef(xs);
  xsRef.current = xs;
  const [at, setAt] = useState<[number | null, number | null]>([null, null]);
  const atRef = useRef(at);
  atRef.current = at;
  const [fill, setFill] = useState(0);

  useEffect(() => {
    guide.coach({ phase: 'hsfence', text: t('guide.hs.fence'), svg, from: () => [X(xsRef.current[0]), Y(0)], to: () => [X(lo), Y(0)] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const setOne = (i: 0 | 1, v: number) => setXs((cur) => (i === 0 ? [v, cur[1]] : [cur[0], v]));
  const knob = (i: 0 | 1) =>
    drag({
      move: (p) => atRef.current[i] === null && setOne(i, clamp(P.ux(p.x), P.x0 + 0.1, P.x1 - 0.1)),
      end: () => {
        if (atRef.current[i] !== null) return;
        const cur = xsRef.current[i];
        const other = atRef.current[1 - i];
        const free = [lo, hi].filter((c) => c !== other);
        const target = free.reduce((best, c) => (Math.abs(c - cur) < Math.abs(best - cur) ? c : best), free[0]!);
        if (Math.abs(cur - target) < FENCE_SNAP) {
          const next: [number | null, number | null] = i === 0 ? [target, atRef.current[1]] : [atRef.current[0], target];
          setAt(next);
          springTo(`pa-fence-${i}`, cur, target, (v) => setOne(i, v), {
            ...TACTILE.snap,
            done: () => {
              sfx.snap();
              if (next[0] !== null && next[1] !== null) {
                springTo('pa-fill', 0, 1, setFill, {
                  ...TACTILE.snap,
                  done: () => window.setTimeout(onSolved, 450),
                });
              } else guide.coach({ phase: 'hsfence2', text: t('guide.hs.fence'), svg, from: () => [X(xsRef.current[1 - i]!), Y(0)], to: () => [X(next[0] === null ? lo : hi), Y(0)] });
            },
          });
        } else guide.say(t('guide.hs.fenceRetry'));
      },
    });
  const downs = [knob(0), knob(1)];
  const fillTo = lo + w * fill;
  const region = fill > 0 ? `${curvePoints(P, fig.f, lo, fillTo, 60)} ${curvePoints(P, g, lo, fillTo, 60).split(' ').reverse().join(' ')}` : '';
  const done = at[0] !== null && at[1] !== null;
  const cx = (lo + hi) / 2;
  return (
    <svg ref={svg} viewBox="0 0 600 440" className="fig" data-testid="scene-parabola-area">
      <StripeDefs />
      <CoordPlane P={P} />
      <PlaneClip P={P} id="pa-clip">
        {fill > 0 && <polygon points={region} fill={color} fillOpacity={0.35} stroke="none" />}
        {fig.g && <polyline points={curvePoints(P, fig.g)} fill="none" stroke={C.palette[1]} strokeWidth={3} />}
        <polyline points={curvePoints(P, fig.f)} fill="none" stroke={C.palette[0]} strokeWidth={3} />
        {xs.map((x, i) => (
          <line key={i} x1={X(x)} y1={Y(P.y0)} x2={X(x)} y2={Y(P.y1)} stroke={at[i] !== null ? color : C.quiet} strokeWidth={at[i] !== null ? 3 : 2} strokeDasharray={at[i] !== null ? undefined : '6 6'} />
        ))}
      </PlaneClip>
      <Legend P={P} items={[{ text: `y = ${quad(fig.f)}`, color: C.palette[0]! }, ...(fig.g ? [{ text: `y = ${quad(fig.g)}`, color: C.palette[1]! }] : [])]} />
      {at.map((a, i) =>
        a !== null ? (
          <Txt key={i} x={X(a)} y={Y(0) - 14} size={18} fill={color}>
            {a === lo ? 'α' : 'β'}
          </Txt>
        ) : null,
      )}
      {done && fill >= 1 && (
        <Txt x={X(cx)} y={Y((evalQ(fig.f, cx) + evalQ(g, cx)) / 2) + 6} size={22} fill={C.ink} className="appear">
          {answerText(card)}
        </Txt>
      )}
      {xs.map((x, i) => (at[i] === null ? <Knob key={i} x={X(x)} y={Y(0)} fill={color} r={13} onDown={downs[i]!} /> : null))}
    </svg>
  );
}

// -------------------------------------------------------------- 等積変形 ---

/** The parallel line snaps within this many pixels of its target. */
const LINE_SNAP_PX = 16;

export function ParabolaTriScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as ParabolaTriFigure;
  const T = triPoints(fig, fig.ask === 'equal_o' || fig.ask === 'px' ? answerNumber(card) : undefined);
  const O: Point = [0, 0];
  const P = plane([T.A, T.B, T.P, O, T.mid]);
  const { X, Y } = P;
  const color = C.lens(lens);
  const q: Quadratic = [T.a, 0, 0];
  const kx = T.mid[0];
  const chord = T.A[1] - T.slope * T.A[0];
  const target = fig.ask === 'equal_o' ? 0 : T.mid[1] - T.slope * T.mid[0];
  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [c, setC] = useState(chord);
  const cRef = useRef(c);
  cRef.current = c;
  const [done, setDone] = useState(false);
  const yAt = (cc: number) => T.slope * kx + cc;

  useEffect(() => {
    guide.coach({ phase: 'hsparallel', text: t('guide.hs.parallel'), svg, from: () => [X(kx), Y(yAt(cRef.current))], to: () => [X(kx), Y(yAt(target))] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const down = drag({
    move: (p) => !done && setC(clamp(P.uy(p.y), P.y0 + 0.2, P.y1 - 0.2) - T.slope * kx),
    end: () => {
      if (done) return;
      const cur = cRef.current;
      if (Math.abs(Y(yAt(cur)) - Y(yAt(target))) < LINE_SNAP_PX) {
        setDone(true);
        springTo('pt-line', cur, target, setC, {
          ...TACTILE.snap,
          done: () => {
            sfx.snap();
            window.setTimeout(onSolved, 600);
          },
        });
      } else guide.say(t(fig.ask === 'equal_o' ? 'guide.hs.throughO' : 'guide.hs.touch'));
    },
  });

  const line = lineAcross(P, [T.slope, -1, c]);
  const pts = (ps: Point[]) => ps.map(([a, b]) => `${X(a)},${Y(b)}`).join(' ');
  const pText = fig.ask === 'px' || fig.ask === 'equal_o' ? `P（x＝${answerText(card)}）` : 'P';
  return (
    <svg ref={svg} viewBox="0 0 600 440" className="fig" data-testid="scene-parabola-tri">
      <StripeDefs />
      <CoordPlane P={P} />
      <PlaneClip P={P} id="pt-clip">
        <polyline points={curvePoints(P, q)} fill="none" stroke={C.palette[0]} strokeWidth={3} />
        {line && <line x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} stroke={color} strokeWidth={2.5} strokeDasharray={done ? undefined : '8 6'} />}
      </PlaneClip>
      <Legend P={P} items={[{ text: `y = ${quad([fig.a, 0, 0])}`, color: C.palette[0]! }]} />
      {done && <polygon points={pts([T.A, T.B, T.P])} fill="url(#st1)" stroke={color} strokeWidth={2.5} strokeLinejoin="round" className="appear" />}
      <line x1={X(T.A[0])} y1={Y(T.A[1])} x2={X(T.B[0])} y2={Y(T.B[1])} stroke={C.ink} strokeWidth={3} />
      {(
        [
          ['A', T.A],
          ['B', T.B],
        ] as const
      ).map(([n, p]) => (
        <g key={n}>
          <circle cx={X(p[0])} cy={Y(p[1])} r={6} fill={C.ink} />
          <Txt x={X(p[0]) + (n === 'A' ? -14 : 14)} y={Y(p[1]) - 10} size={16} fill={C.quiet}>
            {n}
          </Txt>
        </g>
      ))}
      {fig.ask === 'equal_o' && <circle cx={X(0)} cy={Y(0)} r={6} fill={C.ink} />}
      {done && (
        <g className="appear">
          <circle cx={X(T.P[0])} cy={Y(T.P[1])} r={8} fill={color} />
          <Txt x={X(T.P[0])} y={Y(T.P[1]) + 28} size={18} fill={color}>
            {pText}
          </Txt>
          {fig.ask === 'max_area' && (
            <Txt x={(X(T.A[0]) + X(T.B[0]) + X(T.P[0])) / 3} y={(Y(T.A[1]) + Y(T.B[1]) + Y(T.P[1])) / 3 + 6} size={20} fill={C.ink}>
              {answerText(card)}
            </Txt>
          )}
        </g>
      )}
      {!done && <Knob x={X(kx)} y={Y(yAt(c))} fill={color} r={13} onDown={down} />}
    </svg>
  );
}

// -------------------------------------------------------------- 折り返す ---

export function LineMirrorScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as LineMirrorFigure;
  const { A, B } = fig;
  const M = mirrorPoints(fig);
  const P = plane([A, B, M.T, M.P]);
  const { X, Y } = P;
  const color = C.lens(lens);
  const dir: Point = [M.T[0] - B[0], M.T[1] - B[1]];
  const len = Math.hypot(dir[0], dir[1]);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [s, setS] = useState(0);
  const sRef = useRef(s);
  sRef.current = s;
  const [phase, setPhase] = useState<1 | 2 | 3>(1);
  const at = (k: number): Point => [B[0] + dir[0] * k, B[1] + dir[1] * k];
  const centre: Point = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];

  useEffect(() => {
    guide.coach({ phase: 'hsflip', text: t('guide.hs.flip'), svg, from: [X(B[0]), Y(B[1])], to: [X(M.T[0]), Y(M.T[1])] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const down = drag({
    move: (p) => {
      if (phase !== 1) return;
      const u: Point = [P.ux(p.x) - B[0], P.uy(p.y) - B[1]];
      setS(clamp((u[0] * dir[0] + u[1] * dir[1]) / (len * len), 0, 1.2));
    },
    end: () => {
      if (phase !== 1) return;
      const cur = sRef.current;
      if (Math.abs(cur - 1) * len < 0.6) {
        springTo('lm-flip', cur, 1, setS, {
          ...TACTILE.snap,
          done: () => {
            sfx.snap();
            setPhase(2);
            guide.coach({ phase: 'hsline', text: t('guide.hs.line'), svg, from: [X(A[0]), Y(A[1])], to: [X(M.T[0]), Y(M.T[1])] });
          },
        });
      } else {
        springTo('lm-flip', cur, 0, setS, TACTILE.settle);
        guide.say(t('guide.hs.flipRetry'));
      }
    },
  });

  const tap = () => {
    if (phase !== 2) return;
    setPhase(3);
    sfx.snap();
    window.setTimeout(onSolved, 700);
  };

  const ell = lineAcross(P, [fig.line[0], -1, fig.line[1]]);
  const Bs = at(s);
  const pText = fig.ask === 'p_x' ? `P（x＝${answerText(card)}）` : 'P';
  return (
    <svg ref={svg} viewBox="0 0 600 440" className="fig" data-testid="scene-line-mirror" onClick={tap}>
      <StripeDefs />
      <CoordPlane P={P} />
      <PlaneClip P={P} id="lm-clip">{ell && <line x1={ell[0]} y1={ell[1]} x2={ell[2]} y2={ell[3]} stroke={color} strokeWidth={3} opacity={0.75} />}</PlaneClip>
      <Legend P={P} items={[{ text: `ℓ: y = ${quad([0, fig.line[0], fig.line[1]])}`, color }]} />
      {s > 0 && <line x1={X(B[0])} y1={Y(B[1])} x2={X(Bs[0])} y2={Y(Bs[1])} stroke={color} strokeDasharray="6 5" />}
      {phase >= 2 && (
        <Txt x={X(M.T[0]) + 16} y={Y(M.T[1]) + 6} anchor="start" fill={color}>
          B′
        </Txt>
      )}
      {phase === 2 && <line x1={X(A[0])} y1={Y(A[1])} x2={X(M.T[0])} y2={Y(M.T[1])} stroke={color} strokeWidth={2} strokeDasharray="4 8" className="nudge-line" opacity={0.6} />}
      {phase === 3 && (
        <g className="appear">
          <line x1={X(A[0])} y1={Y(A[1])} x2={X(M.T[0])} y2={Y(M.T[1])} stroke={color} strokeWidth={4} opacity={0.5} />
          <polyline points={`${X(A[0])},${Y(A[1])} ${X(M.P[0])},${Y(M.P[1])} ${X(B[0])},${Y(B[1])}`} fill="none" stroke={color} strokeWidth={5} strokeLinejoin="round" />
          <circle cx={X(M.P[0])} cy={Y(M.P[1])} r={8} fill={color} />
          <Txt x={X(M.P[0]) + 14} y={Y(M.P[1]) + 26} anchor="start" size={18} fill={color}>
            {pText}
          </Txt>
          {fig.ask === 'min_len' && (
            <Txt x={(X(A[0]) + X(M.T[0])) / 2 - 12} y={(Y(A[1]) + Y(M.T[1])) / 2 - 12} anchor="end" size={20} fill={color}>
              {answerText(card)}
            </Txt>
          )}
        </g>
      )}
      {(
        [
          ['A', A],
          ['B', B],
        ] as const
      ).map(([n, q]) => (
        <g key={n}>
          <circle cx={X(q[0])} cy={Y(q[1])} r={6} fill={C.ink} />
          {(() => {
            const text = coordLabel(n, q);
            const l = labelAt(P, q, centre, text);
            return (
              <Txt x={l.x} y={l.y} size={14} anchor={l.anchor} fill={C.quiet}>
                {text}
              </Txt>
            );
          })()}
        </g>
      ))}
      {phase === 1 && <Knob x={X(Bs[0])} y={Y(Bs[1])} fill={color} r={13} onDown={down} />}
      {phase >= 2 && <circle cx={X(M.T[0])} cy={Y(M.T[1])} r={7} fill={color} />}
    </svg>
  );
}

// ---------------------------------------------------------------- 止める ---

const FAMILY_A = [-2, -1, 0, 1, 2];

export function ParamFamilyScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as ParamFamilyFigure;
  const F = familyPoint(fig) ?? [0, 0];
  const P = plane([F, [F[0] - 4, F[1] - 4], [F[0] + 4, F[1] + 4]], 600, 400);
  const { X, Y } = P;
  const color = C.lens(lens);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [a, setA] = useState(1);
  const aRef = useRef(a);
  aRef.current = a;
  const [frozen, setFrozen] = useState(false);
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;
  // The slider for a, under the plane: a from −3 to 3.
  const sx = (v: number) => 300 + v * 60;
  const sy = 420;

  useEffect(() => {
    if (reducedMotion()) return;
    let tt = 0;
    const stop = everyFrame((dt) => {
      if (frozenRef.current) return;
      tt += dt;
      setA(2.4 * Math.sin(tt * 1.1 + 0.4));
    });
    return stop;
  }, [card.id]);

  useEffect(() => {
    guide.coach({ phase: 'hsfreeze', text: t('guide.hs.freeze'), svg, from: () => [sx(aRef.current), sy], to: () => [sx(aRef.current), sy] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const down = drag({
    start: () => {
      if (frozenRef.current) return;
      setFrozen(true);
      sfx.snap();
      guide.say(t('guide.hs.brackets'));
      window.setTimeout(onSolved, 1300);
    },
    move: () => {},
  });

  const draw = (m: { line?: [number, number, number]; parabola?: Quadratic }, stroke: string, width: number, opacity = 1, className?: string) => {
    if (m.parabola) return <polyline className={className} points={curvePoints(P, m.parabola)} fill="none" stroke={stroke} strokeWidth={width} opacity={opacity} />;
    const l = m.line ? lineAcross(P, m.line) : null;
    return l ? <line className={className} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke={stroke} strokeWidth={width} opacity={opacity} /> : null;
  };
  const br = familyBrackets(fig);
  return (
    <svg ref={svg} viewBox="0 0 600 440" className="fig" data-testid="scene-param-family">
      <CoordPlane P={P} />
      <PlaneClip P={P} id="pf-clip">
        {FAMILY_A.map((v, i) => (
          <g key={v}>{draw(familyMember(fig, v), C.palette[i % C.palette.length]!, 1.5, frozen ? 0.15 : 0.3)}</g>
        ))}
        {draw(familyMember(fig, a), frozen ? C.ink : color, 4, frozen ? 0.5 : 1)}
        {frozen && draw(br.aPart, C.palette[0]!, 4, 1, 'appear')}
        {frozen && draw(br.rest, C.palette[1]!, 4, 1, 'appear')}
      </PlaneClip>
      {frozen && (
        <g className="appear">
          <circle cx={X(F[0])} cy={Y(F[1])} r={14} fill="none" stroke={color} strokeWidth={3} />
          <circle cx={X(F[0])} cy={Y(F[1])} r={7} fill={color} />
          <Txt x={X(F[0]) + 20} y={Y(F[1]) - 16} anchor="start" size={20} fill={color}>
            {answerText(card)}
          </Txt>
        </g>
      )}
      <line x1={sx(-3)} y1={sy} x2={sx(3)} y2={sy} stroke={C.line} strokeWidth={4} strokeLinecap="round" />
      <Txt x={sx(-3) - 18} y={sy + 5} size={16} fill={C.quiet} fontStyle="italic">
        a
      </Txt>
      {frozen ? <circle cx={sx(a)} cy={sy} r={11} fill={color} /> : <Knob x={sx(a)} y={sy} fill={color} r={12} onDown={down} />}
    </svg>
  );
}
