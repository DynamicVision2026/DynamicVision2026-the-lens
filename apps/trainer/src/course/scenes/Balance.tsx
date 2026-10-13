// てんびん: drag the unknown weight up/down until the beam balances on the pivot at the mix's
// strength. The lower % is always on the left (WO-017), so water (0%) hangs left and salt (100%)
// right; a very long arm is drawn with a break so the short one stays touchable. The tilt is drawn
// from the two moments (positions only); the arms come from step 1, the ratio from step 2, and the
// weight the child sets is shown as they set it.
import { allAfterEquals, formatExact, ratioIn, type WordDiagramSpec, type WordProblemFigure } from '@lens/scenes';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ja';
import { everyFrame, sfx, springTo, TACTILE } from '../fx';
import { C, clamp, Knob, StripeDefs, Txt, useDrag, useSceneGuide, type SceneProps } from './kit';
import { leverModel } from './word';

const W = 600;
const H = 440;

export function BalanceScene({ card, lens, onSolved }: SceneProps) {
  const fig = card.problem.figure as WordProblemFigure;
  const d = fig.diagram as Extract<WordDiagramSpec, { family: 'lever' }>;
  const m = leverModel(d);
  const { w1, p1, p2, pt, unit_w: unit } = d;
  const steps = card.lens_route.steps;
  const arms = allAfterEquals(steps[1]); // [known arm, unknown arm]
  const ratio = ratioIn(steps[2]);
  const ans = m.target;
  const color = C.lens(lens);

  // Ends: the lower % on the left. The known weight hangs at p1, the unknown at p2.
  const X1 = 110;
  const X2 = 490;
  const L = X2 - X1;
  const [lo, hi] = [Math.min(p1, p2), Math.max(p1, p2)];
  const armLeft = pt - lo;
  const armRight = hi - pt;
  const Xp = m.broken ? (armLeft < armRight ? X1 + 0.3 * L : X1 + 0.7 * L) : X1 + (armLeft / (hi - lo)) * L;
  const [Xk, Xu] = m.unknownLeft ? [X2, X1] : [X1, X2];
  const Yb = 190;
  const endLabel = (p: number) => (p === 0 && p2 === 0 ? t('balance.water') : p === 100 && p2 === 100 ? t('balance.salt') : `${p}${d.unit_p}`);
  const side = (m.unknownLeft ? 'Left' : '') as 'Left' | '';

  const svg = useRef<SVGSVGElement>(null);
  const drag = useDrag(svg);
  const guide = useSceneGuide();
  const [w2, setW2] = useState(m.start);
  const w2Ref = useRef(w2);
  w2Ref.current = w2;
  const [th, setTh] = useState(0);
  const [done, setDone] = useState(false);
  const doneRef = useRef(done);
  doneRef.current = done;

  // The beam swings towards its torque balance (drawing only), until solved. Clockwise = right end down.
  useEffect(() => {
    let theta = 0;
    let omega = 0;
    const stop = everyFrame((dt) => {
      if (doneRef.current) return;
      const tau = (m.torque(w2Ref.current) / (w1 * m.armKnown)) * (m.unknownLeft ? -1 : 1);
      const target = clamp(Math.atan(tau) * 0.45, -0.38, 0.38);
      omega += (70 * (target - theta) - 4.5 * omega) * dt;
      theta += omega * dt;
      setTh(theta);
    });
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const size = (w: number) => 36 + 46 * Math.sqrt(w / Math.max(w1, ans));
  const end = (x: number): [number, number] => [Xp + (x - Xp) * Math.cos(th), Yb + (x - Xp) * Math.sin(th)];
  const knobDx = m.unknownLeft ? -44 : 44;
  const knobAt = (): [number, number] => [end(Xu)[0] + knobDx, end(Xu)[1] + 40 + size(w2Ref.current) / 2];

  useEffect(() => {
    guide.coach({ phase: 'weight', text: t(`guide.balance.weight${side}`), svg, from: knobAt, to: () => [knobAt()[0], knobAt()[1] + 50] });
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
      const nw = clamp(Math.round((startW + ((p.y - startY) * ans) / 140) / m.step) * m.step, m.step, Math.round(ans * 2.4));
      if (nw !== w2Ref.current) {
        setW2(nw);
        sfx.tick(nw / ans);
      }
    },
    end: () => {
      if (doneRef.current) return;
      const w = m.snapTo(w2Ref.current) ?? w2Ref.current;
      setW2(w);
      if (w === ans) {
        setDone(true);
        sfx.snap();
        springTo('balance-th', th, 0, setTh, TACTILE.settle);
        window.setTimeout(onSolved, 500);
      } else guide.say(w > ans ? t(`guide.balance.heavy${side}`) : t(`guide.balance.light${side}`));
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

  // Arm colours and texts follow the weights: the known arm in the first colour, the unknown in the second.
  const knownLeft = !m.unknownLeft;
  const leftColor = knownLeft ? C.palette[0] : C.palette[1];
  const rightColor = knownLeft ? C.palette[1] : C.palette[0];
  const [leftArm, rightArm] = knownLeft ? [arms[0], arms[1]] : [arms[1], arms[0]];
  // The break sits in the middle of the long arm.
  const breakX = m.broken ? (armLeft > armRight ? (X1 + Xp) / 2 : (Xp + X2) / 2) : null;
  const [ratioKnown, ratioUnknown] = ratio ?? ['', ''];
  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="fig" data-testid="scene-balance">
      <StripeDefs />
      <path d={`M${Xp},${Yb + 6} l-26,64 h52 z`} fill={C.quiet} fillOpacity={0.25} stroke={color} strokeWidth={2} />
      <Txt x={Xp} y={Yb + 96} fill={color}>{`${pt}${d.unit_p}`}</Txt>
      <g transform={`rotate(${(th * 180) / Math.PI} ${Xp} ${Yb})`}>
        <line x1={X1} y1={Yb} x2={X2} y2={Yb} stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
        <line x1={X1} y1={Yb - 14} x2={Xp} y2={Yb - 14} stroke={leftColor} strokeWidth={3} />
        <line x1={Xp} y1={Yb - 14} x2={X2} y2={Yb - 14} stroke={rightColor} strokeWidth={3} />
        {breakX !== null && (
          <g data-part="axis-break">
            <rect x={breakX - 9} y={Yb - 20} width={18} height={28} fill={C.panel} />
            <path d={`M${breakX - 9} ${Yb + 8} l6 -14 l6 14 l6 -14 M${breakX - 9} ${Yb - 6} l6 -14 l6 14 l6 -14`} fill="none" stroke={C.ink} strokeWidth={2.5} />
          </g>
        )}
        {leftArm && (
          <Txt x={(X1 + Xp) / 2} y={Yb - 22} fill={leftColor}>
            {leftArm}
          </Txt>
        )}
        {rightArm && (
          <Txt x={(Xp + X2) / 2} y={Yb - 22} fill={rightColor}>
            {rightArm}
          </Txt>
        )}
        <Txt x={X1} y={Yb - 44} size={16}>
          {endLabel(lo)}
        </Txt>
        <Txt x={X2} y={Yb - 44} size={16}>
          {endLabel(hi)}
        </Txt>
      </g>
      {hang(Xk, w1, C.palette[0]!, `${w1}${unit}`)}
      {hang(Xu, w2, C.palette[1]!, done ? `${formatExact(card.answer.value)}${unit}` : `${w2}${unit}?`)}
      {done && ratio && (
        <Txt x={300} y={420} size={20} fill={color} className="appear">{`${w1}${unit} : ${formatExact(card.answer.value)}${unit} ＝ ${ratioKnown} : ${ratioUnknown}`}</Txt>
      )}
      {!done && <Knob x={knobAt()[0]} y={knobAt()[1]} fill={C.palette[1]!} r={14} onDown={down} />}
    </svg>
  );
}
