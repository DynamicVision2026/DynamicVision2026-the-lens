// 等積変形 on the plane. coord_equal_area (WO-020): drag C along the line through C parallel to AB;
// △ABC keeps its area, and it snaps where the line meets the y-axis: P, drawn at the card's answer (its y).
// coord_quad_tri (WO-023): quadrilateral ABCD; drag C along the parallel to the diagonal DB; △DBC keeps its
// area, and it snaps on the x-axis at E (the answer's x), turning ABCD into △AED.
import { answerNumber, formatExact, type CoordEqualAreaFigure, type CoordQuadTriFigure, type LensCard, type Point } from '@lens/scenes';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { sfx, springTo, TACTILE } from '../fx';
import { coordLabel, CoordPlane, labelAt, plane } from './coordkit';
import { C, clamp, Knob, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';

/** How close (in grid units along the line) to the axis the slide snaps. */
const SNAP = 0.45;

interface Setup {
  /** The base the moving vertex keeps its height over (AB, or the diagonal DB). */
  base: [Point, Point];
  /** The vertex that slides (C), and where it stops: on the axis, at the card's answer. */
  from: Point;
  to: Point;
  /** The given points, labelled with their coordinates. */
  given: [string, Point][];
  /** The figure outline before the slide (△ABC, or ABCD). */
  outline: Point[];
  /** The fixed corners of the triangle that slides (the moving vertex is added last). */
  moving: Point[];
  /** The other two corners of the figure after the slide (△AED: A and D; E is the target). */
  after: Point[];
  name: string;
  axis: 'x' | 'y';
  coach: 'guide.slide.coord' | 'guide.slide.coordX';
  miss: 'guide.slide.toAxis' | 'guide.slide.toAxisX';
}

function setup(card: LensCard): Setup {
  const fig = card.problem.figure as CoordEqualAreaFigure | CoordQuadTriFigure;
  const ans = answerNumber(card);
  if (fig.type === 'coord_quad_tri') {
    const { A, B, C: Cp, D } = fig;
    return {
      base: [D, B],
      from: Cp,
      to: [ans, 0],
      given: [['A', A], ['B', B], ['C', Cp], ['D', D]],
      outline: [A, B, Cp, D],
      moving: [D, B],
      after: [A, D],
      name: 'E',
      axis: 'x',
      coach: 'guide.slide.coordX',
      miss: 'guide.slide.toAxisX',
    };
  }
  const { A, B, C: Cp } = fig;
  return {
    base: [A, B],
    from: Cp,
    to: [0, ans],
    given: [['A', A], ['B', B], ['C', Cp]],
    outline: [A, B, Cp],
    moving: [A, B],
    after: [A, B],
    name: 'P',
    axis: 'y',
    coach: 'guide.slide.coord',
    miss: 'guide.slide.toAxis',
  };
}

export function SlideCoordScene({ card, lens, onSolved }: SceneProps) {
  const S = setup(card);
  const { from, to } = S;
  const P = plane([...S.given.map(([, q]) => q), to]);
  const { X, Y } = P;
  const color = C.lens(lens);
  // The parallel through C, parametrised by s: s = 0 at C, s = 1 at the target on the axis.
  const dir: Point = [to[0] - from[0], to[1] - from[1]];
  const len = Math.hypot(dir[0], dir[1]);
  const at = (s: number): Point => [from[0] + dir[0] * s, from[1] + dir[1] * s];
  // How far the line can run each way inside the plane (keeps the knob on the grid).
  const sRange = (() => {
    let [lo, hi] = [-4, 4];
    for (const [k, a, b] of [
      [0, P.x0, P.x1],
      [1, P.y0, P.y1],
    ] as const) {
      if (Math.abs(dir[k]) < 1e-9) continue;
      const u = (a + 0.2 - from[k]) / dir[k];
      const w = (b - 0.2 - from[k]) / dir[k];
      lo = Math.max(lo, Math.min(u, w));
      hi = Math.min(hi, Math.max(u, w));
    }
    return [lo, hi] as const;
  })();
  const ps = S.given.map(([, q]) => q);
  const centre: Point = [ps.reduce((a, q) => a + q[0], 0) / ps.length, ps.reduce((a, q) => a + q[1], 0) / ps.length];
  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [s, setS] = useState(0);
  const sRef = useRef(s);
  sRef.current = s;
  const [done, setDone] = useState(false);

  useEffect(() => {
    guide.coach({ phase: 'cslide', text: t(S.coach), svg, from: () => [X(at(sRef.current)[0]), Y(at(sRef.current)[1])], to: () => [X(at(sRef.current + 0.5)[0]), Y(at(sRef.current + 0.5)[1])] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const down = drag({
    move: (p) => {
      if (done) return;
      // Project the pointer onto the line.
      const u: Point = [P.ux(p.x) - from[0], P.uy(p.y) - from[1]];
      setS(clamp((u[0] * dir[0] + u[1] * dir[1]) / (len * len), sRange[0], sRange[1]));
    },
    end: () => {
      if (done) return;
      const cur = sRef.current;
      if (Math.abs(cur - 1) * len < SNAP) {
        setDone(true);
        springTo('slide-coord', cur, 1, setS, {
          ...TACTILE.snap,
          done: () => {
            sfx.snap();
            window.setTimeout(onSolved, 450);
          },
        });
      } else guide.say(t(S.miss));
    },
  });

  // At the snap the moving vertex is exactly the target (the answer, not recomputed).
  const v = done && s === 1 ? to : at(s);
  const far = (k: number): Point => at(k);
  const pts = (q: Point[]) => q.map(([a, b]) => `${X(a)},${Y(b)}`).join(' ');
  const value = card.answer.value.startsWith('-') ? `−${formatExact(card.answer.value.slice(1))}` : formatExact(card.answer.value);
  const solved = S.axis === 'y' ? `${S.name}(0, ${value})` : `${S.name}(${value}, 0)`;
  return (
    <svg ref={svg} viewBox="0 0 600 440" className="fig" data-testid="scene-slide-coord">
      <StripeDefs />
      <CoordPlane P={P} />
      <clipPath id="slide-coord-clip">
        <rect x={X(P.x0)} y={Y(P.y1)} width={X(P.x1) - X(P.x0)} height={Y(P.y0) - Y(P.y1)} />
      </clipPath>
      <line x1={X(far(-6)[0])} y1={Y(far(-6)[1])} x2={X(far(6)[0])} y2={Y(far(6)[1])} stroke={color} strokeWidth={2} strokeDasharray="8 6" clipPath="url(#slide-coord-clip)" />
      <polygon points={pts(S.outline)} fill={C.palette[0]} fillOpacity={0.12} stroke={C.palette[0]} strokeWidth={1.5} strokeOpacity={0.6} />
      <polygon points={pts([...S.moving, v])} fill="url(#st1)" stroke={C.palette[1]} strokeWidth={2.5} strokeLinejoin="round" />
      <line x1={X(S.base[0][0])} y1={Y(S.base[0][1])} x2={X(S.base[1][0])} y2={Y(S.base[1][1])} stroke={C.ink} strokeWidth={3} />
      {done && S.outline.length > 3 && <polygon points={pts([S.after[0]!, to, S.after[1]!])} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" className="appear" />}
      {S.given.map(([n, q]) => (
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
      {done && (
        <Txt x={X(to[0]) + (S.axis === 'y' ? 10 : 0)} y={Y(to[1]) + (S.axis === 'y' ? -16 : 40)} anchor={S.axis === 'y' ? 'start' : 'middle'} size={20} fill={color} className="appear">
          {solved}
        </Txt>
      )}
      {!done && <Knob x={X(v[0])} y={Y(v[1])} fill={color} r={13} onDown={down} />}
      {done && <circle cx={X(to[0])} cy={Y(to[1])} r={8} fill={color} />}
    </svg>
  );
}
