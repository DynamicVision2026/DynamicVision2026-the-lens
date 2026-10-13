// てんびん: drag the unknown weight up/down until the beam balances on the pivot at the mix's
// strength. The tilt is drawn from the two moments (positions only); the arms come from step 2,
// the ratio from step 3, and the weight the child sets is shown as they set it.
import { allAfterEquals, answerNumber, formatExact, ratioIn, type WordProblemFigure } from '@lens/scenes';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { everyFrame, sfx, springTo, TACTILE } from '../fx';
import { C, clamp, Knob, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';

const W = 600;
const H = 440;

export function BalanceScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as WordProblemFigure;
  const { w1 = 1, p1 = 0, p2 = 1, pt = 0 } = fig.params;
  const unit = card.problem.unit;
  const steps = card.lens_route.steps;
  const arms = allAfterEquals(steps[1]);
  const ratio = ratioIn(steps[2]);
  const ans = answerNumber(card);
  const X1 = 110;
  const X2 = 490;
  const Xp = X1 + ((pt - p1) / (p2 - p1)) * (X2 - X1);
  const Yb = 190;
  const stepG = ans % 10 === 0 ? 10 : ans % 5 === 0 ? 5 : 1;
  const arm1 = pt - p1;
  const arm2 = p2 - pt;
  const color = C.lens(lens);

  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [w2, setW2] = useState(() => Math.max(stepG, Math.round((ans * 0.35) / stepG) * stepG));
  const w2Ref = useRef(w2);
  w2Ref.current = w2;
  const [th, setTh] = useState(0);
  const [done, setDone] = useState(false);
  const doneRef = useRef(done);
  doneRef.current = done;

  // The beam swings towards its torque balance (drawing only), until solved.
  useEffect(() => {
    let theta = 0;
    let omega = 0;
    const stop = everyFrame((dt) => {
      if (doneRef.current) return;
      const tau = (w2Ref.current * arm2 - w1 * arm1) / (w1 * arm1);
      const target = clamp(Math.atan(tau) * 0.45, -0.38, 0.38);
      omega += (70 * (target - theta) - 4.5 * omega) * dt;
      theta += omega * dt;
      setTh(theta);
    });
    return stop;
  }, [arm1, arm2, w1]);

  const size = (w: number) => 36 + 46 * Math.sqrt(w / Math.max(w1, ans));
  const end = (x: number): [number, number] => [Xp + (x - Xp) * Math.cos(th), Yb + (x - Xp) * Math.sin(th)];
  const [r2x, r2y] = end(X2);

  useEffect(() => {
    guide.coach({ phase: 'weight', text: t('guide.balance.weight'), svg, from: () => [end(X2)[0] + 44, end(X2)[1] + 40 + size(w2Ref.current) / 2], to: () => [end(X2)[0] + 44, end(X2)[1] + 90 + size(w2Ref.current) / 2] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, guide.coach]);

  let startY = 0;
  let startW = 0;
  const down = drag({
    start: (p) => {
      startY = p.y;
      startW = w2Ref.current;
    },
    move: (p) => {
      if (doneRef.current) return;
      const nw = clamp(Math.round((startW + ((p.y - startY) * ans) / 140) / stepG) * stepG, stepG, Math.round(ans * 2.4));
      if (nw !== w2Ref.current) {
        setW2(nw);
        sfx.tick(nw / ans);
      }
    },
    end: () => {
      if (doneRef.current) return;
      const w = Math.abs(w2Ref.current - ans) <= 2 * stepG ? ans : w2Ref.current;
      setW2(w);
      if (w === ans) {
        setDone(true);
        sfx.snap();
        springTo('balance-th', th, 0, setTh, TACTILE.settle);
        window.setTimeout(onSolved, 500);
      } else guide.say(w > ans ? t('guide.balance.heavy') : t('guide.balance.light'));
    },
  });

  const hang = (x: number, w: number, c: string, text: string) => {
    const [px, py] = end(x);
    const sz = size(w);
    return (
      <g transform={`translate(${px},${py})`}>
        <line x1={0} y1={0} x2={0} y2={40} stroke={C.quiet} strokeWidth={2} />
        <rect x={-sz / 2} y={40} width={sz} height={sz} rx={8} fill={c} fillOpacity={0.25} stroke={c} strokeWidth={2.5} />
        <Txt x={0} y={40 + sz / 2 + 7}>{text}</Txt>
      </g>
    );
  };

  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="fig" data-testid="scene-balance">
      <StripeDefs />
      <path d={`M${Xp},${Yb + 6} l-26,64 h52 z`} fill={C.quiet} fillOpacity={0.25} stroke={color} strokeWidth={2} />
      <Txt x={Xp} y={Yb + 96} fill={color}>{`${pt}%`}</Txt>
      <g transform={`rotate(${(th * 180) / Math.PI} ${Xp} ${Yb})`}>
        <line x1={X1} y1={Yb} x2={X2} y2={Yb} stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
        <line x1={X1} y1={Yb - 14} x2={Xp} y2={Yb - 14} stroke={C.palette[0]} strokeWidth={3} />
        <line x1={Xp} y1={Yb - 14} x2={X2} y2={Yb - 14} stroke={C.palette[1]} strokeWidth={3} />
        {arms[0] && (
          <Txt x={(X1 + Xp) / 2} y={Yb - 22} fill={C.palette[0]}>
            {arms[0]}
          </Txt>
        )}
        {arms[1] && (
          <Txt x={(Xp + X2) / 2} y={Yb - 22} fill={C.palette[1]}>
            {arms[1]}
          </Txt>
        )}
        <Txt x={X1} y={Yb - 44} size={16}>{`${p1}%`}</Txt>
        <Txt x={X2} y={Yb - 44} size={16}>{`${p2}%`}</Txt>
      </g>
      {hang(X1, w1, C.palette[0]!, `${w1}${unit}`)}
      {hang(X2, w2, C.palette[1]!, done ? `${formatExact(card.answer.value)}${unit}` : `${w2}${unit}?`)}
      {done && ratio && (
        <Txt x={300} y={420} size={20} fill={color} className="appear">{`${w1}${unit} : ${formatExact(card.answer.value)}${unit} ＝ ${ratio[0]} : ${ratio[1]}`}</Txt>
      )}
      {!done && <Knob x={r2x + 44} y={r2y + 40 + size(w2) / 2} fill={C.palette[1]!} r={14} onDown={down} />}
    </svg>
  );
}
