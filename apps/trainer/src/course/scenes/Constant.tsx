// 差一定: drag the years forward; both bars grow together and the difference never changes. The
// younger bar's r copies line up with the older bar at the answer. Printed: params, step values,
// and the number of years the child has dragged.
import { afterEquals, answerNumber, type WordProblemFigure } from '@lens/scenes';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { sfx, springTo, TACTILE } from '../fx';
import { C, clamp, Knob, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';

const W = 600;
const H = 440;

export function ConstantScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as WordProblemFigure;
  const { p = 1, c = 0, r = 1 } = fig.params;
  const nm = fig.names;
  const diff = afterEquals(card.lens_route.steps[0]);
  const ans = answerNumber(card);
  const maxL = Math.max(p + ans, r * (c + ans)) + 6;
  const u = 500 / maxL;
  const x0 = 60;
  const color = C.lens(lens);

  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [y, setY] = useState(0);
  const yRef = useRef(y);
  yRef.current = y;
  const [done, setDone] = useState(false);

  useEffect(() => {
    guide.coach({ phase: 'grow', text: t('guide.constant.grow'), svg, from: () => [x0 + (c + yRef.current) * u, 360], to: () => [x0 + (c + yRef.current) * u + 60, 360] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const down = drag({
    move: (pt) => {
      if (!done) setY(clamp((pt.x - x0) / u - c, 0, maxL - p - 1));
    },
    end: () => {
      if (done) return;
      const target = Math.round(yRef.current);
      springTo('constant-y', yRef.current, target, setY, TACTILE.snap);
      if (target === ans) {
        setDone(true);
        window.setTimeout(() => {
          sfx.snap();
          onSolved();
        }, 320);
      } else guide.say(t('guide.constant.retry', { younger: nm.younger ?? '', older: nm.older ?? '', r }));
    },
  });

  const P2 = p + y;
  const C2 = c + y;
  const years = Math.round(y);
  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="fig" data-testid="scene-constant">
      <StripeDefs />
      <line x1={x0} y1={360} x2={x0 + maxL * u} y2={360} stroke={C.quiet} strokeOpacity={0.4} strokeWidth={6} strokeLinecap="round" />
      <Txt x={x0 - 6} y={98} anchor="start" size={16} fill={C.palette[0]}>
        {nm.older ?? ''}
      </Txt>
      <rect x={x0} y={110} height={30} width={P2 * u} rx={6} fill={C.palette[0]} fillOpacity={0.25} stroke={C.palette[0]} strokeWidth={2} />
      <rect x={x0 + C2 * u} y={110} height={30} width={(p - c) * u} rx={4} fill="url(#st3)" stroke={color} strokeWidth={3} />
      {diff && (
        <Txt x={x0 + (C2 + (p - c) / 2) * u} y={172} size={16} fill={color}>
          {t('guide.constant.same', { diff })}
        </Txt>
      )}
      <Txt x={x0 - 6} y={200} anchor="start" size={14} fill={C.quiet}>
        {t('guide.constant.copies', { younger: nm.younger ?? '', r })}
      </Txt>
      {Array.from({ length: r }, (_, i) => (
        <rect key={i} x={x0 + i * C2 * u} y={210} width={C2 * u} height={22} rx={5} fill="none" stroke={C.palette[1]} strokeWidth={2} strokeDasharray={i ? '6 4' : undefined} />
      ))}
      <line x1={x0 + P2 * u} y1={100} x2={x0 + P2 * u} y2={245} stroke={C.ink} strokeDasharray="3 4" opacity={0.5} />
      <Txt x={x0 - 6} y={288} anchor="start" size={16} fill={C.palette[1]}>
        {nm.younger ?? ''}
      </Txt>
      <rect x={x0} y={300} height={30} width={C2 * u} rx={6} fill={C.palette[1]} fillOpacity={0.25} stroke={C.palette[1]} strokeWidth={2} />
      {/* Today's ages (from params) fade once the years start. */}
      <Txt x={x0 + p * u + 10} y={132} anchor="start" opacity={y < 0.5 ? 1 : 0} className="fade-op">{`${p}${t('area.age')}`}</Txt>
      <Txt x={x0 + c * u + 10} y={322} anchor="start" opacity={y < 0.5 ? 1 : 0} className="fade-op">{`${c}${t('area.age')}`}</Txt>
      <Txt x={300} y={400} size={26} fill={color}>
        {t('guide.constant.years', { y: years })}
      </Txt>
      {!done && <Knob x={x0 + C2 * u} y={360} fill={color} r={14} onDown={down} />}
    </svg>
  );
}
