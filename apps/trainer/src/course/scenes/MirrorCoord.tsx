// 折り返す on the plane (WO-020, coord_mirror_area): drag B across the x-axis (it snaps at B′), then tap
// to draw A–B′; P appears where it meets the axis. For a chained card this is stage 1; the Enclose
// stage follows on the same plane. P's x prints only when it is the card's answer.
import { formatExact, mirrorAreaP, type CoordMirrorAreaFigure, type Point } from '@lens/scenes';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { sfx, springTo, TACTILE } from '../fx';
import { coordLabel, CoordPlane, plane } from './coordkit';
import { C, clamp, Knob, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';

const SNAP = 0.6;

export function MirrorCoordScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as CoordMirrorAreaFigure;
  const { A, B } = fig;
  const Br: Point = [B[0], -B[1]];
  const Pp = mirrorAreaP(card, fig);
  const P = plane([A, B, Br, Pp]);
  const { X, Y } = P;
  const color = C.lens(lens);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [by, setBy] = useState(B[1]);
  const byRef = useRef(by);
  byRef.current = by;
  const [phase, setPhase] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    guide.coach({ phase: 'cflip', text: t('guide.mirror.coordFlip'), svg, from: [X(B[0]), Y(B[1])], to: [X(B[0]), Y(-B[1])] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const down = drag({
    move: (p) => phase === 1 && setBy(clamp(P.uy(p.y), -Math.abs(B[1]), Math.abs(B[1]))),
    end: () => {
      if (phase !== 1) return;
      const cur = byRef.current;
      if (cur < -B[1] * SNAP) {
        springTo('mirror-coord', cur, -B[1], setBy, {
          ...TACTILE.snap,
          done: () => {
            sfx.snap();
            setPhase(2);
            guide.coach({ phase: 'cline', text: t('guide.mirror.coordLine'), svg, from: [X(A[0]), Y(A[1])], to: [X(Br[0]), Y(Br[1])] });
          },
        });
      } else {
        springTo('mirror-coord', cur, B[1], setBy, TACTILE.settle);
        guide.say(t('guide.corner.across'));
      }
    },
  });

  // Phase 2: one tap draws A–B′; P lights on the axis, and the stage (or the problem) is solved.
  const tap = () => {
    if (phase !== 2) return;
    setPhase(3);
    sfx.snap();
    window.setTimeout(onSolved, 700);
  };

  const pLabel = fig.ask === 'p_x' ? `P(${card.answer.value.startsWith('-') ? `−${formatExact(card.answer.value.slice(1))}` : formatExact(card.answer.value)}, 0)` : 'P';
  return (
    <svg ref={svg} viewBox="0 0 600 440" className="fig" data-testid="scene-mirror-coord" onClick={tap}>
      <StripeDefs />
      <CoordPlane P={P} />
      {/* The x-axis is the mirror. */}
      <line x1={X(P.x0)} y1={Y(0)} x2={X(P.x1)} y2={Y(0)} stroke={color} strokeWidth={3} opacity={0.7} />
      {by < B[1] && <line x1={X(B[0])} y1={Y(B[1])} x2={X(B[0])} y2={Y(by)} stroke={color} strokeDasharray="6 5" />}
      {phase >= 2 && (
        <Txt x={X(Br[0]) + 14} y={Y(Br[1]) + 6} anchor="start" fill={color}>
          B′
        </Txt>
      )}
      {phase === 2 && <line x1={X(A[0])} y1={Y(A[1])} x2={X(Br[0])} y2={Y(Br[1])} stroke={color} strokeWidth={2} strokeDasharray="4 8" className="nudge-line" opacity={0.6} />}
      {phase === 3 && (
        <g className="appear">
          <line x1={X(A[0])} y1={Y(A[1])} x2={X(Br[0])} y2={Y(Br[1])} stroke={color} strokeWidth={4} />
          <polyline points={`${X(A[0])},${Y(A[1])} ${X(Pp[0])},${Y(0)} ${X(B[0])},${Y(B[1])}`} fill="none" stroke={color} strokeWidth={5} strokeLinejoin="round" />
          <circle cx={X(Pp[0])} cy={Y(0)} r={8} fill={color} />
          <Txt x={X(Pp[0])} y={Y(0) + 30} size={18} fill={color}>
            {pLabel}
          </Txt>
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
          <Txt x={X(q[0]) + 6} y={Y(q[1]) - 14} size={14} anchor="start" fill={C.quiet}>
            {coordLabel(n, q)}
          </Txt>
        </g>
      ))}
      {phase === 1 && <Knob x={X(B[0])} y={Y(by)} fill={color} r={13} onDown={down} />}
      {phase >= 2 && <circle cx={X(Br[0])} cy={Y(Br[1])} r={7} fill={color} />}
    </svg>
  );
}
