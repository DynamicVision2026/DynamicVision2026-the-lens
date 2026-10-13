// 過不足の面積図 (WO-015 §3B): pull the top edge up from plan A to plan B, then widen the rectangle
// person by person; each new column is a (b − a)-tall slot that takes leftover and missing items.
// At the answer every dot has a place and none is left over. Printed: the text's numbers, step
// values, and the head count the child sets.
import { afterEquals, type WordDiagramSpec, type WordProblemFigure } from '@lens/scenes';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { sfx, springTo, TACTILE } from '../fx';
import { C, clamp, Knob, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';
import { shortfallModel } from './word';

const W = 600;
const H = 440;
const PER_ROW = 8;

export function AreaShortfallScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as WordProblemFigure;
  const d = fig.diagram as Extract<WordDiagramSpec, { family: 'area_shortfall' }>;
  const m = shortfallModel(d);
  const steps = card.lens_route.steps;
  const gapText = afterEquals(steps[1]);
  const color = C.lens(lens);

  const x0 = 60;
  const sx = 330 / m.kMax;
  const y0 = 330;
  const sy = 230 / (d.b + (d.b - d.a) * 0.5);
  const Y = (v: number) => y0 - v * sy;
  // The leftover (solid) and missing (hollow) dots, stacked on the right.
  const dotX = 430;
  const pitch = 13;
  const dotR = 4.5;
  const stackY = { s: 92, d: 92 + (Math.ceil(d.s / PER_ROW) + 2.4) * pitch };

  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [top, setTop] = useState(d.a);
  const topRef = useRef(top);
  topRef.current = top;
  const [k, setK] = useState(3);
  const kRef = useRef(k);
  kRef.current = k;
  const [phase, setPhase] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    guide.coach({
      phase: 'sfRaise',
      text: t('guide.area.sfRaise', { b: d.b }),
      svg,
      from: () => [x0 + (kRef.current * sx) / 2, Y(topRef.current)],
      to: () => [x0 + (kRef.current * sx) / 2, Y(topRef.current + (d.b - d.a) * 0.8)],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const raiseDown = drag({
    move: (p) => {
      if (phase === 1) setTop(clamp((y0 - p.y) / sy, d.a, d.b + (d.b - d.a) * 0.5));
    },
    end: () => {
      if (phase !== 1) return;
      const cur = topRef.current;
      if (!m.raiseSnaps(cur)) return guide.say(t('guide.area.sfRaise', { b: d.b }));
      springTo('sf-top', cur, d.b, setTop, TACTILE.snap);
      // The phase moves on at the snap; the spring only settles the line visually.
      sfx.snap();
      setPhase(2);
      guide.coach({
        phase: 'sfWidth',
        text: t('guide.area.sfWidth'),
        svg,
        from: () => [x0 + kRef.current * sx, (Y(d.a) + Y(d.b)) / 2],
        to: () => [x0 + kRef.current * sx + 50, (Y(d.a) + Y(d.b)) / 2],
      });
    },
  });

  const widthDown = drag({
    move: (p) => {
      if (phase === 2) setK(clamp((p.x - x0) / sx, 1, m.kMax));
    },
    end: () => {
      if (phase !== 2) return;
      const r = Math.round(kRef.current);
      springTo('sf-k', kRef.current, r, setK, TACTILE.snap);
      if (m.snaps(r)) {
        setPhase(3);
        window.setTimeout(() => {
          sfx.snap();
          onSolved();
        }, 450);
      } else if (m.slots(r) > d.s + d.d) guide.say(t('guide.area.sfRetry'));
    },
  });

  const count = Math.round(k);
  const total = d.s + d.d;
  const slots = phase >= 2 ? m.slots(count) : 0;
  const over = phase >= 2 && slots > total;
  const stripH = d.b - d.a;
  const placed = phase === 3; // the dots fly into the strip
  // Where dot i sits: in its stack, or (once placed) in its slot, column by column from the left.
  const dotAt = (i: number): [number, number] => {
    if (placed) {
      const col = Math.floor(i / stripH);
      const row = i % stripH;
      return [x0 + (col + 0.5) * sx, Y(d.a + row + 0.5)];
    }
    const j = i < d.s ? i : i - d.s;
    const y = i < d.s ? stackY.s : stackY.d;
    return [dotX + (j % PER_ROW) * pitch, y + Math.floor(j / PER_ROW) * pitch];
  };
  const won = phase === 3 ? 'won' : undefined;
  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="fig" data-testid="scene-area">
      <StripeDefs />
      {/* Plan B as a dashed outline at height b. */}
      <rect x={x0} y={Y(d.b)} width={k * sx} height={y0 - Y(d.b)} fill="none" stroke={C.palette[1]} strokeWidth={2} strokeDasharray="7 5" />
      <Txt x={x0} y={Y(d.b) - 10} anchor="start" size={15} fill={C.palette[1]}>
        {t('guide.area.sfPlan', { b: d.b })}
      </Txt>
      {/* Plan A: the solid rectangle, whose top edge the child pulls up. */}
      <rect x={x0} y={Y(top)} width={k * sx} height={y0 - Y(top)} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2.5} />
      <Txt x={x0 - 10} y={Y(d.a) + 6} anchor="end" size={16} fill={color}>
        {String(d.a)}
      </Txt>
      <Txt x={x0 - 10} y={Y(d.b) + 6} anchor="end" size={16} fill={C.palette[1]}>
        {String(d.b)}
      </Txt>
      {phase >= 2 && (
        <g className="appear">
          <rect x={x0} y={Y(d.b)} width={k * sx} height={Y(d.a) - Y(d.b)} fill="url(#st0)" stroke={over ? C.flag : color} strokeWidth={3} className={won} />
          {Array.from({ length: Math.max(0, count - 1) }, (_, i) => (
            <line key={i} x1={x0 + (i + 1) * sx} y1={Y(d.b)} x2={x0 + (i + 1) * sx} y2={Y(d.a)} stroke={color} strokeOpacity={0.5} />
          ))}
          {gapText && (
            <Txt x={W / 2} y={40} size={18} fill={color}>
              {t('guide.area.sfGap', { s: d.s, d: d.d, v: gapText })}
            </Txt>
          )}
        </g>
      )}
      <Txt x={dotX - 4} y={stackY.s - 14} anchor="start" size={15} fill={color} opacity={placed ? 0 : 1} className="fade-op">
        {t('guide.area.sfExtra', { s: d.s })}
      </Txt>
      <Txt x={dotX - 4} y={stackY.d - 14} anchor="start" size={15} fill={C.palette[1]} opacity={placed ? 0 : 1} className="fade-op">
        {t('guide.area.sfShort', { d: d.d })}
      </Txt>
      {Array.from({ length: total }, (_, i) => {
        const [x, y] = dotAt(i);
        const solid = i < d.s;
        return (
          <circle
            key={i}
            r={dotR}
            fill={solid ? color : C.paper}
            stroke={solid ? color : C.palette[1]}
            strokeWidth={2}
            style={{ transform: `translate(${x}px, ${y}px)`, transition: `transform 0.5s cubic-bezier(.2,1.3,.4,1) ${placed ? i * 12 : 0}ms` }}
          />
        );
      })}
      <Txt x={x0 + (k * sx) / 2} y={y0 + 28} size={18} fill={C.ink}>
        {phase >= 2 ? t('guide.area.people', { k: count }) : t('guide.area.people', { k: '?' })}
      </Txt>
      {phase === 3 && steps[3] && (
        <Txt x={W / 2} y={70} size={18} fill={color} className="appear">
          {steps[3].ja}
        </Txt>
      )}
      {phase === 1 && <Knob x={x0 + (k * sx) / 2} y={Y(top)} fill={color} r={14} onDown={raiseDown} />}
      {phase === 2 && <Knob x={x0 + k * sx} y={(Y(d.a) + Y(d.b)) / 2} fill={C.ink} r={13} onDown={widthDown} />}
    </svg>
  );
}
