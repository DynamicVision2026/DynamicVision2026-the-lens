// 折り返す: flip Q's side over the river to get Q′, then slide X until P–X–Q′ is straight.
// X snaps at the card's answer (AX), the verified touch point; nothing is computed.
import { formatExact, type MirrorPathFigure } from '@lens/scenes';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { sfx, springTo, TACTILE } from '../fx';
import { MirrorCornerScene } from './MirrorCorner';
import { C, clamp, Knob, num, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';

const W = 600;
const H = 480;

export function MirrorScene(props: SceneProps) {
  // WO-018 L4: two walls at right angles, reflect twice.
  if (props.card.problem.figure.type === 'mirror_corner') return <MirrorCornerScene {...props} />;
  return <RiverScene {...props} />;
}

function RiverScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as MirrorPathFigure;
  const { ab, pa, qb, unit } = fig;
  const ansX = num(card.answer.value);
  const s = 440 / ab;
  const sv = Math.min(170 / Math.max(pa, qb), s);
  const Ax = 80;
  const Bx = 80 + ab * s;
  const ry = 250;
  const Py = ry - pa * sv;
  const Qy = ry - qb * sv;
  const Qpy = ry + qb * sv;
  const color = C.lens(lens);
  const L = fig.point_labels;

  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [f, setF] = useState(0); // 0 = Q above the river, 1 = folded to Q′
  const fRef = useRef(f);
  fRef.current = f;
  const [x, setX] = useState(ab / 2);
  const xRef = useRef(x);
  xRef.current = x;
  const [phase, setPhase] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    guide.coach({ phase: 'flip', text: t('guide.mirror.flip'), svg, from: [Bx, Qy], to: [Bx, ry + 60] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const Xp = Ax + x * s;
  const c = Math.cos(Math.PI * f);

  const flipDown = drag({
    move: (p) => {
      if (phase !== 1) return;
      setF(Math.acos(clamp((ry - p.y) / (qb * sv), -1, 1)) / Math.PI);
    },
    end: () => {
      if (phase !== 1) return;
      const cur = fRef.current;
      if (cur > 0.55)
        springTo('mirror-f', cur, 1, setF, {
          ...TACTILE.open,
          done: () => {
            sfx.snap();
            setPhase(2);
            guide.coach({ phase: 'x', text: t('guide.mirror.x'), svg, from: () => [Ax + xRef.current * s, ry], to: () => [Ax + xRef.current * s + 50, ry] });
          },
        });
      else springTo('mirror-f', cur, 0, setF, TACTILE.settle);
    },
  });

  const xDown = drag({
    move: (p) => {
      if (phase !== 2) return;
      setX(clamp((p.x - Ax) / s, 0, ab));
    },
    end: () => {
      if (phase !== 2) return;
      const cur = xRef.current;
      if (Math.abs(cur - ansX) < 0.45) {
        setPhase(3);
        springTo('mirror-x', cur, ansX, setX, {
          ...TACTILE.snap,
          done: () => {
            sfx.snap();
            window.setTimeout(onSolved, 400);
          },
        });
      } else guide.say(cur < ansX ? t('guide.mirror.right') : t('guide.mirror.left'));
    },
  });

  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="fig" data-testid="scene-mirror">
      <StripeDefs />
      <rect x={0} y={ry - 6} width={W} height={12} fill={color} opacity={0.18} />
      <line x1={0} y1={ry} x2={W} y2={ry} stroke={color} strokeWidth={2} />
      <Txt x={585} y={ry - 12} fill={color} fontStyle="italic">
        ℓ
      </Txt>
      {/* Q's half-plane: the sheet that folds over the river. */}
      <g transform={`translate(0,${ry}) scale(1,${c}) translate(0,${-ry})`}>
        <rect x={Bx - 70} y={ry - qb * sv - 40} width={140} height={qb * sv + 40} rx={10} fill={color} opacity={0.06 + 0.1 * (1 - Math.abs(c))} stroke={color} strokeOpacity={0.35} />
        <line x1={Bx} y1={Qy} x2={Bx} y2={ry} stroke={C.quiet} strokeDasharray="5 5" />
        <circle cx={Bx} cy={Qy} r={7} fill={color} />
      </g>
      <circle cx={Bx} cy={Qy} r={7} fill={C.ink} />
      <Txt x={Bx + 22} y={Qy + 6}>
        {L.Q}
      </Txt>
      <line x1={Ax} y1={Py} x2={Ax} y2={ry} stroke={C.quiet} strokeDasharray="5 5" />
      <circle cx={Ax} cy={Py} r={7} fill={C.ink} />
      <Txt x={Ax - 22} y={Py + 6}>
        {L.P}
      </Txt>
      <Txt x={Ax - 30} y={(Py + ry) / 2 + 6} size={15} fill={C.quiet}>{`${pa}${unit}`}</Txt>
      <Txt x={Bx + 36} y={(Qy + ry) / 2 + 6} size={15} fill={C.quiet}>{`${qb}${unit}`}</Txt>
      <Txt x={Ax} y={ry + 28} size={15} fill={C.quiet}>
        {L.A}
      </Txt>
      <Txt x={Bx} y={ry + 28} size={15} fill={C.quiet}>
        {L.B}
      </Txt>
      {/* AB across the top, clear of the guide in the bottom-left corner. */}
      <line x1={Ax} y1={34} x2={Bx} y2={34} stroke={C.ink} />
      <line x1={Ax} y1={28} x2={Ax} y2={40} stroke={C.ink} />
      <line x1={Bx} y1={28} x2={Bx} y2={40} stroke={C.ink} />
      <Txt x={(Ax + Bx) / 2} y={26} size={16}>{`${L.A}${L.B} = ${ab}${unit}`}</Txt>
      {/* The path P → X → Q, and once folded the dashed P → X → Q′. */}
      <polyline points={`${Ax},${Py} ${Xp},${ry} ${Bx},${Qy}`} fill="none" stroke={phase === 3 ? color : C.ink} strokeWidth={phase === 3 ? 5 : 3} strokeLinejoin="round" opacity={0.9} />
      {phase >= 2 && (
        <>
          <polyline points={`${Ax},${Py} ${Xp},${ry} ${Bx},${Qpy}`} fill="none" stroke={color} strokeWidth={3} strokeDasharray="8 6" opacity={0.9} />
          <Txt x={Bx + 24} y={Qpy + 6} fill={color}>
            {L.Q_reflected}
          </Txt>
        </>
      )}
      {phase === 3 && (
        <g className="appear">
          <line x1={Ax} y1={Py} x2={Bx} y2={Qpy} stroke={color} strokeWidth={5} />
          <Txt x={Xp} y={ry + 28} fill={color}>
            {L.X}
          </Txt>
          <Txt x={(Ax + Xp) / 2} y={ry + 52} size={18} fill={color}>{`${L.A}${L.X} = ${formatExact(card.answer.value)}${unit}`}</Txt>
        </g>
      )}
      {phase === 1 && <Knob x={Bx} y={ry - qb * sv * c} fill={color} r={13} onDown={flipDown} />}
      {phase === 2 && <Knob x={Xp} y={ry} fill={C.ink} r={13} onDown={xDown} />}
    </svg>
  );
}
