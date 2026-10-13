// 止める: first both walk (the trap: they don't meet halfway); tap one to freeze it; then drag the
// other in blocks of the closing speed (from step 1) until it reaches the frozen walker.
// Printed: params, step 1's expression and value, and the blocks the child has dragged.
import { afterEquals, answerNumber, expressionIn, type WordProblemFigure } from '@lens/scenes';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { everyFrame, reducedMotion, sfx, springTo, TACTILE } from '../fx';
import { C, clamp, Knob, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';

const W = 600;
const H = 440;

export function FreezeScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as WordProblemFigure;
  const { d = 1, u: ua = 1, v: vb = 1 } = fig.params;
  const nm = fig.names;
  const steps = card.lens_route.steps;
  const closing = expressionIn(steps[0]);
  const sp = Number(afterEquals(steps[0]) ?? ua + vb); // drawing fallback only; printed text comes from the step
  const ans = answerNumber(card);
  const result = steps.find((s) => s.op === 'result');
  const x0 = 60;
  const x1 = 540;
  const Y = 230;
  const m = (x1 - x0) / d;
  const color = C.lens(lens);

  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);
  const [walk, setWalk] = useState(0); // trap walk progress 0..1
  const [xa, setXa] = useState(0);
  const xaRef = useRef(xa);
  xaRef.current = xa;

  // The trap: both walk a little; a "?" at halfway. Then rewind and ask to freeze one.
  useEffect(() => {
    guide.say(t('guide.freeze.watch'));
    if (reducedMotion()) {
      setPhase(1);
      return;
    }
    let tt = 0;
    const stop = everyFrame((dt) => {
      tt += dt;
      setWalk(Math.min(1, tt / 1.4));
      if (tt > 1.9) {
        stop();
        setWalk(0);
        setPhase(1);
      }
    });
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  useEffect(() => {
    if (phase === 1) guide.coach({ phase: 'tap', text: t('guide.freeze.tap', { b: nm.b ?? '' }), svg, from: [x1, Y], to: [x1, Y] });
    if (phase === 2) guide.coach({ phase: 'walk', text: t('guide.freeze.walk', { a: nm.a ?? '' }), svg, from: () => [x0 + xaRef.current * m, Y + 92], to: () => [x0 + xaRef.current * m + 70, Y + 92] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, guide.coach]);

  const freeze = (e: React.PointerEvent) => {
    if (phase !== 1) return;
    e.stopPropagation();
    sfx.snap();
    setPhase(2);
  };

  const down = drag({
    move: (p) => {
      if (phase === 2) setXa(clamp((p.x - x0) / m, 0, d));
    },
    end: () => {
      if (phase !== 2) return;
      const k = Math.round(xaRef.current / sp);
      springTo('freeze-x', xaRef.current, k * sp, setXa, TACTILE.snap);
      if (k === ans) {
        setPhase(3);
        window.setTimeout(() => {
          sfx.snap();
          onSolved();
        }, 320);
      } else guide.say(k < ans ? t('guide.freeze.more') : t('guide.freeze.less'));
    },
  });

  // Trap walk positions (drawing only): a third of the way to where they would meet.
  const k = walk * 0.25;
  const ax = phase === 0 ? x0 + d * k * (ua / (ua + vb)) * m : x0 + xa * m;
  const bx = phase === 0 ? x1 - d * k * (vb / (ua + vb)) * m : x1;
  const blocks = phase >= 2 ? Math.round(xa / sp) : 0;

  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="fig" data-testid="scene-freeze">
      <StripeDefs />
      <line x1={x0} y1={Y} x2={x1} y2={Y} stroke={C.quiet} strokeWidth={6} strokeLinecap="round" />
      <line x1={x0} y1={Y - 70} x2={x1} y2={Y - 70} stroke={C.ink} />
      <Txt x={(x0 + x1) / 2} y={Y - 80} size={20}>{`${d}m`}</Txt>
      {Array.from({ length: blocks }, (_, i) => (
        <rect key={i} x={x0 + i * sp * m + 1} y={Y - 9} width={sp * m - 2} height={18} rx={3} fill={i % 2 ? C.palette[0] : color} opacity={0.55} />
      ))}
      {phase === 0 && (
        <Txt x={(x0 + x1) / 2} y={Y - 26} size={26} fill={C.flag} className="appear">
          ?
        </Txt>
      )}
      <g transform={`translate(${ax},${Y})`}>
        <circle r={16} fill={C.palette[0]} />
        <Txt x={0} y={7} size={16} fill={C.paper} stroke="none">
          {nm.a ?? ''}
        </Txt>
      </g>
      <g transform={`translate(${bx},${Y})`} onPointerDown={freeze} style={{ cursor: phase === 1 ? 'pointer' : undefined }} className="knob">
        <circle r={30} fill="transparent" />
        <circle r={16} fill={C.palette[1]} />
        <Txt x={0} y={7} size={16} fill={C.paper} stroke="none">
          {nm.b ?? ''}
        </Txt>
        {phase >= 2 && (
          <g className="appear">
            <circle r={26} fill="none" stroke={color} strokeWidth={3} />
            <path d="M0 -40v-16 M-8 -44l16 -8 M-8 -52l16 8" stroke={color} strokeWidth={2.5} fill="none" />
          </g>
        )}
      </g>
      <Txt x={ax} y={Y + 48} size={15} fill={phase >= 2 ? color : C.palette[0]}>
        {phase === 3 ? '' : phase === 2 ? closing ?? '' : t('guide.freeze.speed', { v: ua })}
      </Txt>
      <Txt x={x1} y={Y + 48} size={15} fill={C.palette[1]}>
        {phase === 3 ? '' : phase === 2 ? t('guide.freeze.stopped') : t('guide.freeze.speed', { v: vb })}
      </Txt>
      {phase >= 2 && (
        <Txt x={300} y={380} size={28} fill={color}>
          {phase === 3 && result ? result.ja : t('guide.freeze.minutes', { k: blocks })}
        </Txt>
      )}
      {phase === 2 && <Knob x={x0 + xa * m} y={Y + 92} fill={C.palette[0]!} r={14} onDown={down} />}
    </svg>
  );
}
