// 折り返す L4 (WO-018, mirror_corner): two walls at right angles. Drag P across m (snap at P′), then Q
// across ℓ (snap at Q′); the straight line P′Q′ then shows where the path touches each wall. The touch
// point on ℓ is drawn at the card's answer; nothing is computed for print.
import { formatExact, type MirrorCornerFigure } from '@lens/scenes';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { sfx, springTo, TACTILE } from '../fx';
import { C, clamp, Knob, num, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';

const W = 600;
const H = 480;
const SNAP = 0.6;

export function MirrorCornerScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as MirrorCornerFigure;
  const [px, py] = fig.P;
  const [qx, qy] = fig.Q;
  const unit = fig.unit;
  const ans = num(card.answer.value);
  const xmin = -px;
  const xmax = Math.max(px, qx);
  const ymin = -qy;
  const ymax = Math.max(py, qy);
  const s = Math.min((W - 140) / (xmax - xmin), (H - 120) / (ymax - ymin));
  const ox = (W - (xmax - xmin) * s) / 2 - xmin * s;
  const oy = (H - (ymax - ymin) * s) / 2 + ymax * s;
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oy - y * s;
  const color = C.lens(lens);

  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  // P's x (px → −px) and Q's y (qy → −qy) as the child drags them across the walls.
  const [pX, setPX] = useState(px);
  const [qY, setQY] = useState(qy);
  const pRef = useRef(pX);
  pRef.current = pX;
  const qRef = useRef(qY);
  qRef.current = qY;
  const [phase, setPhase] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    guide.coach({ phase: 'cornerP', text: t('guide.corner.p'), svg, from: [X(px), Y(py)], to: [X(-px), Y(py)] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const pDown = drag({
    move: (p) => phase === 1 && setPX(clamp((p.x - ox) / s, -px, px)),
    end: () => {
      if (phase !== 1) return;
      const cur = pRef.current;
      if (cur < -px * SNAP) {
        springTo('corner-p', cur, -px, setPX, {
          ...TACTILE.snap,
          done: () => {
            sfx.snap();
            setPhase(2);
            guide.coach({ phase: 'cornerQ', text: t('guide.corner.q'), svg, from: [X(qx), Y(qy)], to: [X(qx), Y(-qy)] });
          },
        });
      } else {
        springTo('corner-p', cur, px, setPX, TACTILE.settle);
        guide.say(t('guide.corner.across'));
      }
    },
  });

  const qDown = drag({
    move: (p) => phase === 2 && setQY(clamp((oy - p.y) / s, -qy, qy)),
    end: () => {
      if (phase !== 2) return;
      const cur = qRef.current;
      if (cur < -qy * SNAP) {
        springTo('corner-q', cur, -qy, setQY, {
          ...TACTILE.snap,
          done: () => {
            sfx.snap();
            setPhase(3);
            window.setTimeout(onSolved, 700);
          },
        });
      } else {
        springTo('corner-q', cur, qy, setQY, TACTILE.settle);
        guide.say(t('guide.corner.across'));
      }
    },
  });

  // The straight line P′Q′ and where it touches m (drawing) and ℓ (the answer).
  const Pr: [number, number] = [X(-px), Y(py)];
  const Qr: [number, number] = [X(qx), Y(-qy)];
  const tmY = py - (py + qy) * (px / (px + qx));
  const Tm: [number, number] = [X(0), Y(tmY)];
  const Tl: [number, number] = [X(ans), Y(0)];
  const dist = (x1: number, y1: number, x2: number, y2: number, label: string, dx: number, dy: number) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.quiet} strokeDasharray="5 5" />
      <Txt x={(x1 + x2) / 2 + dx} y={(y1 + y2) / 2 + dy} size={15} fill={C.quiet}>
        {label}
      </Txt>
    </g>
  );
  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="fig" data-testid="scene-corner">
      {/* The two walls: ℓ along, m up; faint where the reflections land. */}
      <line x1={X(0)} y1={Y(0)} x2={W - 20} y2={Y(0)} stroke={color} strokeWidth={3} />
      <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={20} stroke={color} strokeWidth={3} />
      <line x1={20} y1={Y(0)} x2={X(0)} y2={Y(0)} stroke={color} strokeWidth={1.5} strokeDasharray="6 6" opacity={0.4} />
      <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={H - 20} stroke={color} strokeWidth={1.5} strokeDasharray="6 6" opacity={0.4} />
      <Txt x={W - 30} y={Y(0) - 12} fill={color} fontStyle="italic">
        ℓ
      </Txt>
      <Txt x={X(0) + 18} y={34} fill={color} fontStyle="italic">
        m
      </Txt>
      <Txt x={X(0) - 16} y={Y(0) + 24} size={15} fill={C.quiet}>
        O
      </Txt>
      {dist(X(px), Y(py), X(0), Y(py), `${px}${unit}`, 0, -10)}
      {dist(X(px), Y(py), X(px), Y(0), `${py}${unit}`, -24, 4)}
      {dist(X(qx), Y(qy), X(0), Y(qy), `${qx}${unit}`, 0, -10)}
      {dist(X(qx), Y(qy), X(qx), Y(0), `${qy}${unit}`, 26, 4)}

      {/* P and Q stay; their reflections follow the drag. */}
      <circle cx={X(px)} cy={Y(py)} r={7} fill={C.ink} />
      <Txt x={X(px) + 18} y={Y(py) - 10}>P</Txt>
      <circle cx={X(qx)} cy={Y(qy)} r={7} fill={C.ink} />
      <Txt x={X(qx) + 18} y={Y(qy) - 10}>Q</Txt>
      {pX < px && <line x1={X(px)} y1={Y(py)} x2={X(pX)} y2={Y(py)} stroke={color} strokeDasharray="6 5" />}
      {qY < qy && <line x1={X(qx)} y1={Y(qy)} x2={X(qx)} y2={Y(qY)} stroke={color} strokeDasharray="6 5" />}
      {phase >= 2 && (
        <Txt x={Pr[0] - 4} y={Pr[1] - 16} fill={color}>
          P′
        </Txt>
      )}
      {phase === 3 && (
        <Txt x={Qr[0] + 22} y={Qr[1] + 6} fill={color}>
          Q′
        </Txt>
      )}

      {phase === 3 && (
        <g className="appear">
          <line x1={Pr[0]} y1={Pr[1]} x2={Qr[0]} y2={Qr[1]} stroke={color} strokeWidth={3} strokeDasharray="8 6" opacity={0.7} />
          <polyline points={`${X(px)},${Y(py)} ${Tm[0]},${Tm[1]} ${Tl[0]},${Tl[1]} ${X(qx)},${Y(qy)}`} fill="none" stroke={color} strokeWidth={5} strokeLinejoin="round" />
          <circle cx={Tm[0]} cy={Tm[1]} r={7} fill={color} />
          <circle cx={Tl[0]} cy={Tl[1]} r={7} fill={color} />
          <Txt x={(X(0) + Tl[0]) / 2} y={Y(0) + 28} size={18} fill={color}>{`${formatExact(card.answer.value)}${unit}`}</Txt>
        </g>
      )}
      {phase === 1 && <Knob x={X(pX)} y={Y(py)} fill={color} r={13} onDown={pDown} />}
      {phase === 2 && (
        <>
          <circle cx={Pr[0]} cy={Pr[1]} r={7} fill={color} />
          <Knob x={X(qx)} y={Y(qY)} fill={color} r={13} onDown={qDown} />
        </>
      )}
      {phase === 3 && <circle cx={Pr[0]} cy={Pr[1]} r={7} fill={color} />}
      {phase === 3 && <circle cx={Qr[0]} cy={Qr[1]} r={7} fill={color} />}
    </svg>
  );
}
