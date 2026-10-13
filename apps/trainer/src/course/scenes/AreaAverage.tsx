// 平均の面積図 (WO-015 §3A): lower the dashed line to the overall average, then widen group 2 until
// its dent below the line takes exactly the excess of group 1 above it (the excess drains as the dent
// fills). Printed: the text's numbers, step values, and the head count the child sets.
import { afterEquals, type WordDiagramSpec, type WordProblemFigure } from '@lens/scenes';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { sfx, springTo, TACTILE } from '../fx';
import { C, clamp, Knob, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';
import { averageModel } from './word';

const W = 600;
const H = 440;

export function AreaAverageScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as WordProblemFigure;
  const d = fig.diagram as Extract<WordDiagramSpec, { family: 'area_average' }>;
  const m = averageModel(d);
  const steps = card.lens_route.steps;
  const excessText = afterEquals(steps[1]);
  const color = C.lens(lens);

  // Only the band near the averages is drawn (h2 − 4 … h1 + 4), so small differences stay visible.
  const lo = d.h2 - 4;
  const hi = d.h1 + 4;
  const x0 = 64;
  const sx = 430 / (d.w1 + m.kMax);
  const y0 = 330;
  const sy = 235 / (hi - lo);
  const Y = (v: number) => y0 - (v - lo) * sy;
  const xMid = x0 + d.w1 * sx;
  const xLine = x0 + (d.w1 + m.kMax) * sx;

  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [lineV, setLineV] = useState(d.h1);
  const lineRef = useRef(lineV);
  lineRef.current = lineV;
  const [k, setK] = useState(Math.max(1, Math.round(d.w1 / 2)));
  const kRef = useRef(k);
  kRef.current = k;
  const [phase, setPhase] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    guide.coach({
      phase: 'avgLine',
      text: t('guide.area.avgLine', { level: d.level }),
      svg,
      from: () => [xLine + 24, Y(lineRef.current)],
      to: () => [xLine + 24, Y(lineRef.current - (d.h1 - d.level) * 0.8)],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const lineDown = drag({
    move: (p) => {
      if (phase === 1) setLineV(clamp(lo + (y0 - p.y) / sy, d.h2, d.h1));
    },
    end: () => {
      if (phase !== 1) return;
      const cur = lineRef.current;
      if (!m.lineSnaps(cur)) return guide.say(t('guide.area.avgLine', { level: d.level }));
      springTo('avg-line', cur, d.level, setLineV, TACTILE.snap);
      // The phase moves on at the snap; the spring only settles the line visually.
      sfx.snap();
      setPhase(2);
      guide.coach({
        phase: 'avgWidth',
        text: t('guide.area.avgWidth'),
        svg,
        from: () => [xMid + kRef.current * sx, (Y(d.level) + Y(d.h2)) / 2],
        to: () => [xMid + kRef.current * sx + 50, (Y(d.level) + Y(d.h2)) / 2],
      });
    },
  });

  const widthDown = drag({
    move: (p) => {
      if (phase === 2) setK(clamp((p.x - xMid) / sx, 1, m.kMax));
    },
    end: () => {
      if (phase !== 2) return;
      const r = Math.round(kRef.current);
      springTo('avg-k', kRef.current, r, setK, TACTILE.snap);
      if (m.snaps(r)) {
        setPhase(3);
        window.setTimeout(() => {
          sfx.snap();
          onSolved();
        }, 300);
      } else if (m.drained(r) > 1) guide.say(t('guide.area.avgRetry'));
    },
  });

  const count = Math.round(k);
  // At the snap both regions show again, side by side: the same area above and below the line.
  const drained = phase === 2 ? Math.min(1, m.drained(k)) : 0;
  const over = phase >= 2 && m.drained(count) > 1;
  const won = phase === 3 ? 'won' : undefined;
  const yL = Y(lineV);
  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="fig" data-testid="scene-area">
      <StripeDefs />
      {/* The axis starts near h2 − 4, not at 0: a small break mark says so. */}
      <path d={`M${x0 - 18} ${y0 - 4} l6 -6 l6 6 l6 -6`} fill="none" stroke={C.quiet} strokeWidth={2} />
      <rect x={x0} y={Y(d.h1)} width={d.w1 * sx} height={y0 - Y(d.h1)} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2.5} />
      <rect x={xMid} y={Y(d.h2)} width={k * sx} height={y0 - Y(d.h2)} fill={C.palette[1]} fillOpacity={0.18} stroke={C.palette[1]} strokeWidth={2.5} />
      <Txt x={x0 - 8} y={Y(d.h1) - 8} anchor="end" size={16} fill={color}>
        {t('guide.area.points', { v: d.h1 })}
      </Txt>
      <Txt x={xMid + k * sx + 8} y={Y(d.h2) + 22} anchor="start" size={16} fill={C.palette[1]}>
        {t('guide.area.points', { v: d.h2 })}
      </Txt>
      {phase >= 2 && (
        <g className="appear">
          {/* The excess above the line drains (from the right) as the dent below fills. */}
          <rect x={x0} y={Y(d.h1)} width={d.w1 * sx} height={Y(d.level) - Y(d.h1)} fill="none" stroke={color} strokeWidth={2} strokeDasharray="5 4" />
          <rect x={x0} y={Y(d.h1)} width={d.w1 * (1 - drained) * sx} height={Y(d.level) - Y(d.h1)} fill="url(#st0)" stroke={color} strokeWidth={3} className={won} />
          <rect x={xMid} y={Y(d.level)} width={k * sx} height={Y(d.h2) - Y(d.level)} fill="url(#st0)" stroke={over ? C.flag : color} strokeWidth={3} className={won} />
          {excessText && (
            <Txt x={x0 + (d.w1 * sx) / 2} y={Y(d.h1) - 12} size={18} fill={color}>
              {t('guide.area.avgExcess', { v: excessText })}
            </Txt>
          )}
          <Txt x={xLine + 4} y={Y(d.level) - 10} anchor="end" size={16} fill={C.ink}>
            {t('guide.area.avgLevel', { level: d.level })}
          </Txt>
        </g>
      )}
      <line x1={x0 - 10} y1={yL} x2={xLine + 10} y2={yL} stroke={color} strokeWidth={3} strokeDasharray="10 7" />
      <Txt x={x0 + (d.w1 * sx) / 2} y={y0 + 26} size={18} fill={color}>
        {t('guide.area.people', { k: d.w1 })}
      </Txt>
      <Txt x={xMid + (k * sx) / 2} y={y0 + 26} size={18} fill={C.palette[1]}>
        {phase >= 2 ? t('guide.area.people', { k: count }) : t('guide.area.people', { k: '?' })}
      </Txt>
      {phase === 3 && steps[3] && (
        <Txt x={W / 2} y={34} size={18} fill={color} className="appear">
          {steps[3].ja}
        </Txt>
      )}
      {phase === 1 && <Knob x={xLine + 24} y={yL} fill={color} r={14} onDown={lineDown} />}
      {phase === 2 && <Knob x={xMid + k * sx} y={(Y(d.level) + Y(d.h2)) / 2} fill={C.ink} r={13} onDown={widthDown} />}
    </svg>
  );
}
