// 等積変形 on the plane (WO-020, coord_equal_area): drag C along the line through C parallel to AB;
// △ABC keeps its area. It snaps where the line meets the y-axis: P, drawn at the card's answer (its y).
import { answerNumber, formatExact, type CoordEqualAreaFigure } from '@lens/scenes';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { sfx, springTo, TACTILE } from '../fx';
import { coordLabel, CoordPlane, plane } from './coordkit';
import { C, clamp, Knob, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';

/** How close (in x) to the y-axis the slide snaps. */
const SNAP_X = 0.45;

export function SlideCoordScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as CoordEqualAreaFigure;
  const { A, B, C: Cp } = fig;
  const Py = answerNumber(card);
  const P = plane([A, B, Cp, [0, Py]]);
  const { X, Y } = P;
  const color = C.lens(lens);
  // The parallel through C, as x ↦ y (AB is never vertical in these cards; a vertical AB keeps x fixed).
  const k = B[0] === A[0] ? 0 : (B[1] - A[1]) / (B[0] - A[0]);
  const lineY = (x: number) => Cp[1] + k * (x - Cp[0]);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [x, setX] = useState(Cp[0]);
  const xRef = useRef(x);
  xRef.current = x;
  const [done, setDone] = useState(false);

  useEffect(() => {
    guide.coach({ phase: 'cslide', text: t('guide.slide.coord'), svg, from: () => [X(xRef.current), Y(lineY(xRef.current))], to: () => [X(xRef.current * 0.5), Y(lineY(xRef.current * 0.5))] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const down = drag({
    move: (p) => !done && setX(clamp(P.ux(p.x), P.x0 + 0.2, P.x1 - 0.2)),
    end: () => {
      if (done) return;
      const cur = xRef.current;
      if (Math.abs(cur) < SNAP_X) {
        setDone(true);
        springTo('slide-coord', cur, 0, setX, {
          ...TACTILE.snap,
          done: () => {
            sfx.snap();
            window.setTimeout(onSolved, 450);
          },
        });
      } else guide.say(t('guide.slide.toAxis'));
    },
  });

  // The moving vertex sits on the parallel; at the snap it is P (the answer's y, not recomputed).
  const vy = done && x === 0 ? Py : lineY(x);
  const pts = (ps: [number, number][]) => ps.map(([a, b]) => `${X(a)},${Y(b)}`).join(' ');
  return (
    <svg ref={svg} viewBox="0 0 600 440" className="fig" data-testid="scene-slide-coord">
      <StripeDefs />
      <CoordPlane P={P} />
      <clipPath id="slide-coord-clip">
        <rect x={X(P.x0)} y={Y(P.y1)} width={X(P.x1) - X(P.x0)} height={Y(P.y0) - Y(P.y1)} />
      </clipPath>
      <line x1={X(P.x0)} y1={Y(lineY(P.x0))} x2={X(P.x1)} y2={Y(lineY(P.x1))} stroke={color} strokeWidth={2} strokeDasharray="8 6" clipPath="url(#slide-coord-clip)" />
      <polygon points={pts([A, B, Cp])} fill={C.palette[0]} fillOpacity={0.12} stroke={C.palette[0]} strokeWidth={1.5} strokeOpacity={0.6} />
      <polygon points={pts([A, B, [x, vy]])} fill="url(#st1)" stroke={C.palette[1]} strokeWidth={2.5} strokeLinejoin="round" />
      <line x1={X(A[0])} y1={Y(A[1])} x2={X(B[0])} y2={Y(B[1])} stroke={C.ink} strokeWidth={3} />
      {(
        [
          ['A', A],
          ['B', B],
          ['C', Cp],
        ] as const
      ).map(([n, q]) => (
        <g key={n}>
          <circle cx={X(q[0])} cy={Y(q[1])} r={6} fill={C.ink} />
          <Txt x={X(q[0]) + 6} y={Y(q[1]) - 14} size={14} anchor="start" fill={C.quiet}>
            {coordLabel(n, q)}
          </Txt>
        </g>
      ))}
      {done && (
        <Txt x={X(0) + 10} y={Y(Py) - 16} anchor="start" size={20} fill={color} className="appear">
          {`P(0, ${card.answer.value.startsWith('-') ? `−${formatExact(card.answer.value.slice(1))}` : formatExact(card.answer.value)})`}
        </Txt>
      )}
      {!done && <Knob x={X(x)} y={Y(vy)} fill={color} r={13} onDown={down} />}
      {done && <circle cx={X(0)} cy={Y(Py)} r={8} fill={color} />}
    </svg>
  );
}
