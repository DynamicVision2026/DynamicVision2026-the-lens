// 面積図: lower the dashed line to "all of the cheaper item", then slide the divider until the
// overhang strip is the gap. Printed numbers: params, step values, and the count the child sets.
import { afterEquals, answerNumber, formatExact, type WordProblemFigure } from '@lens/scenes';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { sfx, springTo, TACTILE } from '../fx';
import { C, clamp, Knob, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';

const W = 600;
const H = 440;

export function AreaScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as WordProblemFigure;
  const { n = 1, a = 1, b = 0 } = fig.params;
  const nm = fig.names;
  const steps = card.lens_route.steps;
  const allB = afterEquals(steps[1]);
  const gap = afterEquals(steps[2]);
  const height = afterEquals(steps[3]);
  const ans = answerNumber(card);
  const yen = nm.measure === '金額' ? t('area.yen') : '';
  const u = 480 / n;
  const hs = 250 / a;
  const x0 = 60;
  const y0 = 330;
  const color = C.lens(lens);

  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [lineH, setLineH] = useState(a);
  const lineRef = useRef(lineH);
  lineRef.current = lineH;
  const [xw, setXw] = useState(Math.round(n / 2));
  const xwRef = useRef(xw);
  xwRef.current = xw;
  const [phase, setPhase] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    guide.coach({
      phase: 'line',
      text: t('guide.area.line', { b: nm.b ?? '' }),
      svg,
      from: () => [x0 + n * u + 26, y0 - lineRef.current * hs],
      to: () => [x0 + n * u + 26, y0 - (lineRef.current - (a - b) * 0.45) * hs],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const lineDown = drag({
    move: (p) => {
      if (phase === 1) setLineH(clamp((y0 - p.y) / hs, 0, a));
    },
    end: () => {
      if (phase !== 1) return;
      const cur = lineRef.current;
      if (Math.abs(cur - b) < a * 0.12)
        springTo('area-line', cur, b, setLineH, {
          ...TACTILE.snap,
          done: () => {
            sfx.snap();
            setPhase(2);
            guide.coach({
              phase: 'divide',
              text: t('guide.area.divide', { gap: gap ?? '' }),
              svg,
              from: () => [x0 + xwRef.current * u, y0 - a * hs - 22],
              to: () => [x0 + xwRef.current * u + 45, y0 - a * hs - 22],
            });
          },
        });
      else guide.say(t('guide.area.lineRetry', { b: nm.b ?? '' }));
    },
  });

  const divDown = drag({
    move: (p) => {
      if (phase === 2) setXw(clamp((p.x - x0) / u, 1, n - 1));
    },
    end: () => {
      if (phase !== 2) return;
      const r = Math.round(xwRef.current);
      springTo('area-x', xwRef.current, r, setXw, TACTILE.snap);
      sfx.tap();
      if (r === ans) {
        setPhase(3);
        window.setTimeout(() => {
          sfx.snap();
          onSolved();
        }, 300);
      }
    },
  });

  const xl = x0 + xw * u;
  const count = Math.round(xw);
  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="fig" data-testid="scene-area">
      <StripeDefs />
      {phase === 1 && <rect x={x0} y={y0 - a * hs} width={n * u} height={a * hs} fill={C.ink} fillOpacity={0.05} stroke={C.quiet} strokeDasharray="6 5" />}
      <rect x={x0} y={y0 - a * hs} width={xw * u} height={a * hs} fill={C.palette[0]} fillOpacity={0.18} stroke={C.palette[0]} strokeWidth={2.5} />
      <rect x={xl} y={y0 - b * hs} width={(n - xw) * u} height={b * hs} fill={C.palette[1]} fillOpacity={0.18} stroke={C.palette[1]} strokeWidth={2.5} />
      {phase >= 2 && (
        <g className="appear">
          <rect x={x0} y={y0 - b * hs} width={n * u} height={b * hs} fill={C.ink} opacity={0.1} />
          <rect x={x0} y={y0 - a * hs} width={xw * u} height={(a - b) * hs} fill="url(#st0)" stroke={color} strokeWidth={3} />
          {allB && (
            <Txt x={x0 + (n * u) / 2} y={y0 - (b * hs) / 2 + 7} size={17} fill={C.quiet}>
              {t('guide.area.allB', { b: nm.b ?? '', v: allB })}
            </Txt>
          )}
          {height && (
            <Txt x={x0 + (xw * u) / 2} y={y0 - ((a + b) / 2) * hs + 7} size={20} fill={color}>{`${height} × ${count}`}</Txt>
          )}
          {gap && (
            <Txt x={300} y={40} size={22} fill={color}>
              {t('guide.area.want', { gap })}
            </Txt>
          )}
        </g>
      )}
      <line x1={x0 - 10} y1={y0 - lineH * hs} x2={x0 + n * u + 10} y2={y0 - lineH * hs} stroke={color} strokeWidth={3} strokeDasharray="10 7" />
      <Txt x={x0 - 30} y={y0 - a * hs + 6} size={16} fill={C.palette[0]}>{`${a}${yen}`}</Txt>
      <Txt x={x0 + n * u + 30} y={y0 - b * hs + 26} size={16} fill={C.palette[1]}>{`${b}${yen}`}</Txt>
      <Txt x={x0 + (xw * u) / 2} y={y0 + 22} size={18} fill={C.palette[0]}>
        {phase >= 2 ? String(count) : '?'}
      </Txt>
      <Txt x={xl + ((n - xw) * u) / 2} y={y0 + 22} size={18} fill={C.palette[1]}>
        ?
      </Txt>
      <Txt x={x0 + (xw * u) / 2} y={y0 + 42} size={14} fill={C.palette[0]}>
        {nm.a ?? ''}
      </Txt>
      <Txt x={xl + ((n - xw) * u) / 2} y={y0 + 42} size={14} fill={C.palette[1]}>
        {nm.b ?? ''}
      </Txt>
      <line x1={x0} y1={y0 + 54} x2={x0 + n * u} y2={y0 + 54} stroke={C.ink} />
      <Txt x={x0 + (n * u) / 2} y={y0 + 60 + 0} size={20} dominantBaseline="hanging">{`${n}${nm.counter ?? ''}`}</Txt>
      {phase === 3 && gap && height && (
        <Txt x={300} y={74} size={22} fill={color} className="appear">{`${gap} ÷ ${height} = ${formatExact(card.answer.value)}`}</Txt>
      )}
      {phase === 1 && <Knob x={x0 + n * u + 26} y={y0 - lineH * hs} fill={color} r={14} onDown={lineDown} />}
      {phase === 2 && <Knob x={xl} y={y0 - a * hs - 22} fill={C.ink} r={13} onDown={divDown} />}
    </svg>
  );
}
