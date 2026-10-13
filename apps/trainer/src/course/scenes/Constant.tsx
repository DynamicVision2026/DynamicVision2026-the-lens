// 差一定: drag the ● forward in time (dir 1) or back / spend (dir −1, WO-015 §3C); both bars change
// together and the difference never changes. The smaller bar's r copies line up with the bigger bar
// at the answer. Printed: the text's numbers, step values, and the child's count × the fixed step.
import { afterEquals, type WordDiagramSpec, type WordProblemFigure } from '@lens/scenes';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { sfx, springTo, TACTILE } from '../fx';
import { C, clamp, Knob, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';
import { barsModel } from './word';

const W = 600;
const H = 440;

export function ConstantScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as WordProblemFigure;
  const d = fig.diagram as Extract<WordDiagramSpec, { family: 'diff_bars' }>;
  const m = barsModel(d);
  const { r, dir, step } = d;
  const nm = fig.names ?? {};
  const unit = d.measure === 'yen' ? t('area.yen') : t('area.age');
  const diff = afterEquals(card.lens_route.steps[0]);
  const last = card.lens_route.steps[3];
  const end = m.at(dir < 0 ? 0 : m.kMax);
  const maxL = Math.max(end.big, r * end.small, d.big, r * d.small) * 1.06;
  const u = 500 / maxL;
  const x0 = 60;
  const color = C.lens(lens);
  const coachText = dir > 0 ? t('guide.constant.grow') : d.measure === 'yen' ? t('guide.constant.spend') : t('guide.constant.back');

  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [k, setK] = useState(0);
  const kRef = useRef(k);
  kRef.current = k;
  const [done, setDone] = useState(false);
  const knobX = (kk: number) => x0 + m.at(kk).small * u;

  useEffect(() => {
    guide.coach({ phase: dir > 0 ? 'grow' : 'back', text: coachText, svg, from: () => [knobX(kRef.current), 360], to: () => [knobX(kRef.current) + dir * 60, 360] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const down = drag({
    move: (pt) => {
      // The ● sits on the smaller bar's end: k steps = how far that end has moved.
      if (!done) setK(clamp(((pt.x - x0) / u - d.small) / (dir * step), 0, m.kMax));
    },
    end: () => {
      if (done) return;
      const target = Math.round(kRef.current);
      springTo('constant-k', kRef.current, target, setK, TACTILE.snap);
      if (m.snaps(target)) {
        setDone(true);
        window.setTimeout(() => {
          sfx.snap();
          onSolved();
        }, 320);
      } else guide.say(t(d.measure === 'yen' ? 'guide.constant.retryYen' : 'guide.constant.retry', { younger: nm.younger ?? '', older: nm.older ?? '', r }));
    },
  });

  const { big: P2, small: C2 } = m.at(k);
  const count = Math.round(k);
  const readout =
    dir > 0 ? t('guide.constant.years', { y: count }) : d.measure === 'yen' ? t('guide.constant.spent', { y: count * step }) : t('guide.constant.yearsAgo', { k: count });
  const won = done ? 'won' : undefined;
  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="fig" data-testid="scene-constant">
      <StripeDefs />
      <line x1={x0} y1={360} x2={x0 + maxL * u} y2={360} stroke={C.quiet} strokeOpacity={0.4} strokeWidth={6} strokeLinecap="round" />
      <Txt x={x0 - 6} y={98} anchor="start" size={16} fill={C.palette[0]}>
        {nm.older ?? ''}
      </Txt>
      <rect x={x0} y={110} height={30} width={P2 * u} rx={6} fill={C.palette[0]} fillOpacity={0.25} stroke={C.palette[0]} strokeWidth={2} />
      <rect x={x0 + C2 * u} y={110} height={30} width={(d.big - d.small) * u} rx={4} fill="url(#st3)" stroke={color} strokeWidth={3} className={won} />
      {diff && (
        <Txt x={x0 + (C2 + (d.big - d.small) / 2) * u} y={172} size={16} fill={color}>
          {t('guide.constant.same', { diff })}
        </Txt>
      )}
      <Txt x={x0 - 6} y={200} anchor="start" size={14} fill={C.quiet}>
        {t('guide.constant.copies', { younger: nm.younger ?? '', r })}
      </Txt>
      {Array.from({ length: r }, (_, i) => (
        <rect key={i} x={x0 + i * C2 * u} y={210} width={C2 * u} height={22} rx={5} fill="none" stroke={C.palette[1]} strokeWidth={2} strokeDasharray={i ? '6 4' : undefined} className={won} />
      ))}
      <line x1={x0 + P2 * u} y1={100} x2={x0 + P2 * u} y2={245} stroke={C.ink} strokeDasharray="3 4" opacity={0.5} />
      <Txt x={x0 - 6} y={288} anchor="start" size={16} fill={C.palette[1]}>
        {nm.younger ?? ''}
      </Txt>
      <rect x={x0} y={300} height={30} width={C2 * u} rx={6} fill={C.palette[1]} fillOpacity={0.25} stroke={C.palette[1]} strokeWidth={2} />
      {/* Today's amounts (from the text) fade once the ● moves. */}
      <Txt x={x0 + d.big * u + 10} y={132} anchor="start" opacity={k < 0.5 ? 1 : 0} className="fade-op">{`${d.big}${unit}`}</Txt>
      <Txt x={x0 + d.small * u + 10} y={322} anchor="start" opacity={k < 0.5 ? 1 : 0} className="fade-op">{`${d.small}${unit}`}</Txt>
      {/* The readout sits at the top, clear of the guide bubble (bottom-left). */}
      <Txt x={300} y={62} size={26} fill={color}>
        {readout}
      </Txt>
      {done && last && (
        <Txt x={300} y={28} size={18} fill={color} className="appear">
          {last.ja}
        </Txt>
      )}
      {!done && <Knob x={knobX(k)} y={360} fill={color} r={14} onDown={down} />}
    </svg>
  );
}
