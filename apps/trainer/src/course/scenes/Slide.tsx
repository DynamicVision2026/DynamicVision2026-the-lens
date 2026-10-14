// 等積変形: slide the apexes along ℓ; the triangles keep their area. When they meet, they merge
// into one triangle on the whole base. Lengths shown only where the figure says they are given.
import { answerText, formatExact, type ParallelBandFigure } from '@lens/scenes';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { sfx, springTo, TACTILE } from '../fx';
import { SlideCoordScene } from './SlideCoord';
import { C, clamp, Knob, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';

const W = 600;
const H = 440;

export function SlideScene(props: SceneProps) {
  // WO-020: the same slide on the coordinate plane, snapping at the y-axis.
  if (props.card.problem.figure.type === 'coord_equal_area') return <SlideCoordScene {...props} />;
  return <BandScene {...props} />;
}

function BandScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as ParallelBandFigure;
  const bx = fig.bottom_x;
  const lo = bx[0]! - 1;
  const hi = bx[bx.length - 1]! + 1;
  const s = 520 / (hi - lo);
  const sh = Math.min(240 / fig.band_height, 46);
  const X = (u: number) => 40 + (u - lo) * s;
  const ux = (px: number) => (px - 40) / s + lo;
  const yM = 340;
  const yL = yM - fig.band_height * sh;
  const color = C.lens(lens);

  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [ax, setAx] = useState(() => fig.apex_x.slice());
  const axRef = useRef(ax);
  axRef.current = ax;
  const [same, setSame] = useState(0);
  const [merged, setMerged] = useState<number | null>(null);

  useEffect(() => {
    guide.coach({
      phase: 'apex',
      text: t('guide.slide.apex'),
      svg,
      from: () => [X(axRef.current[0]!), yL],
      to: () => [X(axRef.current[0]! + (axRef.current[1]! - axRef.current[0]!) * 0.5), yL],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  const knobDown = (i: number) =>
    drag({
      start: () => setSame(1),
      move: (p) => {
        if (merged !== null) return;
        setAx((a) => a.map((v, j) => (j === i ? clamp(ux(p.x), lo + 0.3, hi - 0.3) : v)));
      },
      end: () => {
        setSame(0.35);
        const a = axRef.current;
        if (merged === null && Math.max(...a) - Math.min(...a) < 0.7) {
          const m = a.reduce((x, y) => x + y, 0) / a.length;
          a.forEach((v, j) => springTo(`slide-${j}`, v, m, (x) => setAx((cur) => cur.map((c, k) => (k === j ? x : c))), TACTILE.snap));
          window.setTimeout(() => {
            sfx.snap();
            setMerged(m);
            window.setTimeout(onSolved, 450);
          }, 380);
        } else if (merged === null) guide.say(t('guide.slide.retry'));
      },
    });

  const labels = fig.point_labels.bottom;
  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="fig" data-testid="scene-slide">
      <StripeDefs />
      <line x1={20} y1={yL} x2={580} y2={yL} stroke={C.quiet} strokeWidth={2} />
      <line x1={20} y1={yM} x2={580} y2={yM} stroke={C.quiet} strokeWidth={2} />
      <Txt x={575} y={yL - 10} fill={C.quiet} fontStyle="italic">
        ℓ
      </Txt>
      <Txt x={575} y={yM - 10} fill={C.quiet} fontStyle="italic">
        m
      </Txt>
      {fig.shown.band_height && (
        <>
          <line x1={24} y1={yL} x2={24} y2={yM} stroke={color} strokeWidth={2} />
          <Txt x={24} y={(yL + yM) / 2 + 6} fill={color}>
            {formatExact(String(fig.band_height))}
          </Txt>
        </>
      )}
      {/* WO-018 L4: the gap is the question: 「?cm」 until the apexes merge, then the answer. */}
      {fig.ask === 'band_height' && (
        <>
          <line x1={24} y1={yL} x2={24} y2={yM} stroke={merged !== null ? color : C.quiet} strokeWidth={2} />
          <Txt x={30} y={(yL + yM) / 2 + 6} anchor="start" size={20} fill={merged !== null ? color : C.ink} className={merged !== null ? 'appear' : undefined}>
            {merged !== null ? answerText(card) : t('slide.askGap')}
          </Txt>
        </>
      )}
      {fig.total_area !== undefined && (
        <Txt x={30} y={yL - 30} anchor="start" size={18}>
          {t('slide.totalArea', { a: formatExact(fig.total_area) })}
        </Txt>
      )}
      {bx.map((x, i) => (
        <Txt key={i} x={X(x)} y={yM + 26} size={16} fill={C.quiet}>
          {labels[i] ?? ''}
        </Txt>
      ))}
      {fig.shown.total_base && (
        <>
          <line x1={X(bx[0]!)} y1={yM + 44} x2={X(bx[bx.length - 1]!)} y2={yM + 44} stroke={C.ink} strokeWidth={1.5} />
          <Txt x={(X(bx[0]!) + X(bx[bx.length - 1]!)) / 2} y={yM + 70} size={22}>
            {formatExact(fig.total_base)}
          </Txt>
        </>
      )}
      {ax.map((a, i) => (
        <polygon key={i} points={`${X(bx[i]!)},${yM} ${X(bx[i + 1]!)},${yM} ${X(a)},${yL}`} fill={`url(#st${i % 4})`} stroke={C.palette[i % 4]} strokeWidth={2.5} strokeLinejoin="round" />
      ))}
      {merged !== null && (
        <polygon className="appear" points={`${X(bx[0]!)},${yM} ${X(bx[bx.length - 1]!)},${yM} ${X(merged)},${yL}`} fill="none" stroke={color} strokeWidth={4} strokeLinejoin="round" />
      )}
      <Txt x={300} y={44} fill={color} size={20} opacity={same} className="fade-op">
        {t('guide.slide.same')}
      </Txt>
      {merged === null && ax.map((a, i) => <Knob key={i} x={X(a)} y={yL} fill={C.palette[i % 4]!} r={14} onDown={knobDown(i)} />)}
    </svg>
  );
}
