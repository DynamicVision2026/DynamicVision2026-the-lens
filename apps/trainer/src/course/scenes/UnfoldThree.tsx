// 展開 L4 (WO-018, box_unfold route three_faces): open faces BCGF and CDHG beside ABFE (one drag),
// then slide Q on CG until the string A → P → Q → H is one straight line. Q snaps only at the card's
// answer (CQ); P follows where A–Q crosses BF (drawing only).
import { formatExact, type BoxUnfoldFigure } from '@lens/scenes';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { sfx, springTo, TACTILE } from '../fx';
import { C, clamp, Knob, num, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';

export function UnfoldThreeScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as BoxUnfoldFigure;
  const { a, b, h, unit } = fig;
  const L = fig.point_labels;
  const ans = num(card.answer.value);
  const total = 2 * a + b;
  const s = Math.min(480 / total, 290 / h);
  const x0 = (600 - total * s) / 2;
  const y0 = 360;
  const X = (x: number) => x0 + x * s;
  const Y = (y: number) => y0 - y * s;
  const color = C.lens(lens);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [u, setU] = useState(0);
  const uRef = useRef(u);
  uRef.current = u;
  const [qY, setQY] = useState(h / 2);
  const qRef = useRef(qY);
  qRef.current = qY;
  const [phase, setPhase] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    guide.coach({ phase: 'open3', text: t('guide.unfold.open3'), svg, from: [X(a), Y(h / 2)], to: [X(a) + 120, Y(h / 2)] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const openDown = drag({
    move: (p) => phase === 1 && setU(clamp((p.x - X(a)) / ((b + a) * s), 0, 1)),
    end: () => {
      if (phase !== 1) return;
      const cur = uRef.current;
      if (cur > 0.5)
        springTo('unfold3-u', cur, 1, setU, {
          ...TACTILE.open,
          done: () => {
            sfx.snap();
            setPhase(2);
            guide.coach({ phase: 'q3', text: t('guide.unfold.q3'), svg, from: () => [X(a + b), Y(qRef.current)], to: () => [X(a + b), Y(qRef.current) - 50] });
          },
        });
      else springTo('unfold3-u', cur, 0, setU, TACTILE.settle);
    },
  });

  const qDown = drag({
    move: (p) => phase === 2 && setQY(clamp((y0 - p.y) / s, 0.02 * h, 0.98 * h)),
    end: () => {
      if (phase !== 2) return;
      const cur = qRef.current;
      if (Math.abs(cur - ans) < h * 0.07) {
        setPhase(3);
        springTo('unfold3-q', cur, ans, setQY, {
          ...TACTILE.snap,
          done: () => {
            sfx.snap();
            window.setTimeout(onSolved, 400);
          },
        });
      } else guide.say(cur > ans ? t('guide.unfold.down') : t('guide.unfold.up'));
    },
  });

  const xc = a + b * u;
  const xd = a + (b + a) * u;
  // P: where A–Q crosses BF (drawing only).
  const pY = (qY * a) / (a + b);
  const corners: [string, number, number, number, number][] = [
    [L.A, 0, 0, -14, 14],
    [L.B, a, 0, 0, 24],
    [L.E, 0, h, -14, -8],
    [L.F, a, h, 0, -12],
  ];
  const opened: [string, number, number, number, number][] = [
    [L.C, xc, 0, 0, 24],
    [L.D, xd, 0, 14, 14],
    [L.G, xc, h, 0, -12],
    [L.H, xd, h, 14, -8],
  ];
  return (
    <svg ref={svg} viewBox="0 0 600 440" className="fig" data-testid="scene-unfold-three">
      <StripeDefs />
      <rect x={X(0)} y={Y(h)} width={a * s} height={h * s} fill={C.palette[0]} fillOpacity={0.16} stroke={C.ink} strokeWidth={2} />
      {u > 0.01 && (
        <>
          <rect x={X(a)} y={Y(h)} width={b * u * s} height={h * s} fill={C.palette[1]} fillOpacity={0.2} stroke={C.ink} strokeWidth={2} />
          <rect x={X(xc)} y={Y(h)} width={a * u * s} height={h * s} fill={C.palette[2]} fillOpacity={0.2} stroke={C.ink} strokeWidth={2} />
          <line x1={X(a)} y1={Y(0)} x2={X(a)} y2={Y(h)} stroke={color} strokeWidth={4} />
          <line x1={X(xc)} y1={Y(0)} x2={X(xc)} y2={Y(h)} stroke={color} strokeWidth={4} />
        </>
      )}
      {phase >= 2 && (
        <polyline points={`${X(0)},${Y(0)} ${X(a)},${Y(pY)} ${X(a + b)},${Y(qY)} ${X(total)},${Y(h)}`} fill="none" stroke={phase === 3 ? color : C.ink} strokeWidth={phase === 3 ? 5 : 3} strokeLinejoin="round" />
      )}
      {phase >= 2 && <circle cx={X(a)} cy={Y(pY)} r={6} fill={color} />}
      {[...corners, ...(u > 0.01 ? opened : [])].map(([k, x, y, dx, dy]) => (
        <Txt key={k} x={X(x) + dx} y={Y(y) + dy} size={16} fill={C.quiet}>
          {k}
        </Txt>
      ))}
      <Txt x={X(a / 2)} y={Y(0) + 46} size={16} fill={C.palette[0]}>{`${a}${unit}`}</Txt>
      {u > 0.6 && <Txt x={X(a + b / 2)} y={Y(0) + 46} size={16} fill={C.palette[1]}>{`${b}${unit}`}</Txt>}
      {u > 0.6 && <Txt x={X(a + b + a / 2)} y={Y(0) + 46} size={16} fill={C.palette[2]}>{`${a}${unit}`}</Txt>}
      <Txt x={X(0) - 30} y={Y(h / 2)} size={16} fill={C.quiet}>{`${h}${unit}`}</Txt>
      {phase >= 2 && (
        <Txt x={X(a) - 18} y={Y(pY) - 10} fill={color}>
          {L.P}
        </Txt>
      )}
      {phase >= 2 && (
        <Txt x={X(a + b) + 16} y={Y(qY) + 24} anchor="start" fill={color}>
          {phase === 3 ? `Q（${L.C}Q=${formatExact(card.answer.value)}${unit}）` : 'Q'}
        </Txt>
      )}
      {phase === 1 && <Knob x={X(xd)} y={Y(h / 2)} fill={color} r={13} onDown={openDown} />}
      {phase === 2 && <Knob x={X(a + b)} y={Y(qY)} fill={color} r={13} onDown={qDown} />}
    </svg>
  );
}
