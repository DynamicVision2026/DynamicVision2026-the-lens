// Static (solved) drawings of the てんびん water/salt lever and the 止める chase road, which the shared
// scenes cannot draw yet (DIAGRAM_READY in @lens/scenes). They follow the trainer's end states
// (apps/trainer/src/course/scenes/Balance.tsx and Freeze.tsx, WO-015/017): the same layout and the
// same printed texts. Printed numbers come only from the diagram fields, the lens steps and the answer.
import { afterEquals, allAfterEquals, answerNumber, expressionIn, formatExact, ratioIn, type LensCard, type WordDiagramSpec, type WordProblemFigure } from '@lens/scenes';
import type { ReactNode } from 'react';
import { COPY } from './copy';
import type { BookTokens } from './types';

const W = 600;
const H = 440;

type Lever = Extract<WordDiagramSpec, { family: 'lever' }>;
type Road = Extract<WordDiagramSpec, { family: 'road' }>;

interface Pal {
  ink: string;
  quiet: string;
  paper: string;
  lens: string;
  known: string;
  unknown: string;
  font: string;
}

function pal(t: BookTokens, card: LensCard): Pal {
  return {
    ink: t.color.ink.value,
    quiet: t.color.ink_quiet.value,
    paper: t.color.paper.value,
    lens: t.color.lens[card.lens].value,
    known: t.color.step.palette[0]!.value,
    unknown: t.color.step.palette[1]!.value,
    font: `"${t.type.family_ja}", sans-serif`,
  };
}

function Txt({ x, y, size = 26, fill, p, children, weight = 700, halo = true }: { x: number; y: number; size?: number; fill?: string; p: Pal; children: ReactNode; weight?: number; halo?: boolean }) {
  return (
    <text x={x} y={y} fill={fill ?? p.ink} fontSize={size} fontFamily={p.font} fontWeight={weight} textAnchor="middle" paintOrder="stroke" stroke={halo ? p.paper : 'none'} strokeWidth={halo ? 4 : 0} strokeLinejoin="round">
      {children}
    </text>
  );
}

/** The balanced lever: arms from step 1, the ratio from step 2, the answer weight on the unknown side. */
function LeverSolved({ card, d, p }: { card: LensCard; d: Lever; p: Pal }) {
  const { w1, p1, p2, pt, unit_w: unit, unit_p } = d;
  const steps = card.lens_route.steps;
  const arms = allAfterEquals(steps[1]); // [known arm, unknown arm]
  const ratio = ratioIn(steps[2]);
  // WO-026 §7 SHOULD 11: the ratio label uses the step's own 「:」/「：」 and 「=」/「＝」, so it matches the text.
  const colon = /[\d.]\s*：/.test(steps[2]?.ja ?? '') ? '：' : ':';
  const eq = /＝/.test(steps[2]?.ja ?? '') ? '＝' : '=';
  const answer = `${formatExact(card.answer.value)}${unit}`;
  const unknownLeft = p2 < p1;
  const armKnown = Math.abs(pt - p1);
  const armUnknown = Math.abs(p2 - pt);
  const broken = Math.max(armKnown, armUnknown) / Math.max(1e-9, Math.min(armKnown, armUnknown)) > 4;

  const X1 = 110;
  const X2 = 490;
  const L = X2 - X1;
  const [lo, hi] = [Math.min(p1, p2), Math.max(p1, p2)];
  const armLeft = pt - lo;
  const armRight = hi - pt;
  const Xp = broken ? (armLeft < armRight ? X1 + 0.3 * L : X1 + 0.7 * L) : X1 + (armLeft / (hi - lo)) * L;
  const [Xk, Xu] = unknownLeft ? [X2, X1] : [X1, X2];
  const Yb = 150;
  const endLabel = (v: number) => (v === 0 && p2 === 0 ? COPY.water : v === 100 && p2 === 100 ? COPY.salt : `${v}${unit_p}`);
  const knownLeft = !unknownLeft;
  const [leftColor, rightColor] = knownLeft ? [p.known, p.unknown] : [p.unknown, p.known];
  const [leftArm, rightArm] = knownLeft ? [arms[0], arms[1]] : [arms[1], arms[0]];
  const breakX = broken ? (armLeft > armRight ? (X1 + Xp) / 2 : (Xp + X2) / 2) : null;
  const sz = 84;
  const hang = (x: number, c: string, text: string) => (
    <g transform={`translate(${x},${Yb})`}>
      <line x1={0} y1={0} x2={0} y2={40} stroke={p.quiet} strokeWidth={2} />
      <rect x={-sz / 2} y={40} width={sz} height={sz} rx={8} fill={c} fillOpacity={0.25} stroke={c} strokeWidth={2.5} />
      <Txt x={0} y={40 + sz / 2 + 9} size={24} p={p}>
        {text}
      </Txt>
    </g>
  );
  return (
    <>
      <path d={`M${Xp},${Yb + 6} l-26,64 h52 z`} fill={p.quiet} fillOpacity={0.25} stroke={p.lens} strokeWidth={2} />
      <Txt x={Xp} y={Yb + 100} fill={p.lens} p={p}>{`${pt}${unit_p}`}</Txt>
      <line x1={X1} y1={Yb} x2={X2} y2={Yb} stroke={p.ink} strokeWidth={6} strokeLinecap="round" />
      <line x1={X1} y1={Yb - 14} x2={Xp} y2={Yb - 14} stroke={leftColor} strokeWidth={3} />
      <line x1={Xp} y1={Yb - 14} x2={X2} y2={Yb - 14} stroke={rightColor} strokeWidth={3} />
      {breakX !== null && (
        <g>
          <rect x={breakX - 9} y={Yb - 20} width={18} height={28} fill={p.paper} />
          <path d={`M${breakX - 9} ${Yb + 8} l6 -14 l6 14 l6 -14 M${breakX - 9} ${Yb - 6} l6 -14 l6 14 l6 -14`} fill="none" stroke={p.ink} strokeWidth={2.5} />
        </g>
      )}
      {leftArm && (
        <Txt x={(X1 + Xp) / 2} y={Yb - 24} fill={leftColor} p={p}>
          {leftArm}
        </Txt>
      )}
      {rightArm && (
        <Txt x={(Xp + X2) / 2} y={Yb - 24} fill={rightColor} p={p}>
          {rightArm}
        </Txt>
      )}
      <Txt x={X1} y={Yb - 50} size={24} p={p}>
        {endLabel(lo)}
      </Txt>
      <Txt x={X2} y={Yb - 50} size={24} p={p}>
        {endLabel(hi)}
      </Txt>
      {hang(Xk, p.known, `${w1}${unit}`)}
      {hang(Xu, p.unknown, answer)}
      {ratio && (
        <Txt x={300} y={Yb + 175} size={28} fill={p.lens} p={p}>{`${w1}${unit} ${colon} ${answer} ${eq} ${ratio[0]} ${colon} ${ratio[1]}`}</Txt>
      )}
    </>
  );
}

/** The road with one walker frozen: blocks of the closing speed (step 0) up to the gap (step 1 in a chase). */
function RoadSolved({ card, fig, d, p }: { card: LensCard; fig: WordProblemFigure; d: Road; p: Pal }) {
  const chase = d.mode === 'chase';
  const nm = fig.names ?? {};
  const steps = card.lens_route.steps;
  const closing = expressionIn(steps[0]);
  const sp = Number(afterEquals(steps[0]) ?? d.u + d.v); // drawing only
  const blocks = Math.round(answerNumber(card)); // drawing only
  const result = steps.find((s) => s.op === 'result') ?? steps[steps.length - 1];
  const x0 = 60;
  const x1 = 540;
  const Y = 200;
  const m = (chase ? x1 - 60 - x0 : x1 - x0) / d.d;
  const gapText = chase ? afterEquals(steps[1]) : String(d.d);
  const bx = x0 + d.d * m;
  return (
    <>
      <line x1={x0} y1={Y} x2={x1} y2={Y} stroke={p.quiet} strokeWidth={6} strokeLinecap="round" />
      <line x1={x0} y1={Y - 70} x2={bx} y2={Y - 70} stroke={p.ink} />
      <line x1={x0} y1={Y - 78} x2={x0} y2={Y - 62} stroke={p.ink} />
      <line x1={bx} y1={Y - 78} x2={bx} y2={Y - 62} stroke={p.ink} />
      {gapText && <Txt x={x0 + (d.d * m) / 2} y={Y - 82} size={28} p={p}>{`${gapText}m`}</Txt>}
      {Array.from({ length: blocks }, (_, i) => (
        <rect key={i} x={x0 + i * sp * m + 1} y={Y - 9} width={Math.max(1, sp * m - 2)} height={18} rx={3} fill={i % 2 ? p.known : p.lens} opacity={0.55} />
      ))}
      <g transform={`translate(${x0},${Y})`}>
        <circle r={20} fill={p.ink} />
        <Txt x={0} y={8} size={22} fill={p.paper} halo={false} p={p}>
          {nm.a ?? ''}
        </Txt>
      </g>
      <g transform={`translate(${bx},${Y})`}>
        <circle r={20} fill={p.quiet} />
        <Txt x={0} y={8} size={22} fill={p.paper} halo={false} p={p}>
          {nm.b ?? ''}
        </Txt>
        <circle r={28} fill="none" stroke={p.lens} strokeWidth={3} />
      </g>
      <Txt x={x0 + 80} y={Y + 52} size={24} fill={p.lens} p={p}>
        {closing ?? ''}
      </Txt>
      <Txt x={bx} y={Y + 52} size={24} fill={p.unknown} p={p}>
        {COPY.stopped}
      </Txt>
      <Txt x={300} y={Y + 130} size={30} fill={p.lens} p={p}>
        {result?.ja ?? ''}
      </Txt>
    </>
  );
}

/** Word-problem families the book draws itself; null when the card is not one of them. */
export function bookWordFamily(card: LensCard): 'lever' | 'road' | null {
  const f = card.problem.figure as { type: string; diagram?: { family?: string } };
  if (f.type !== 'word_problem') return null;
  return f.diagram?.family === 'lever' || f.diagram?.family === 'road' ? f.diagram.family : null;
}

export function BookWordFigure({ card, tokens }: { card: LensCard; tokens: BookTokens }) {
  const fig = card.problem.figure as WordProblemFigure;
  const p = pal(tokens, card);
  const d = fig.diagram;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={card.problem.text_ja} style={{ display: 'block', width: '100%', height: 'auto' }}>
      {d.family === 'lever' && <LeverSolved card={card} d={d} p={p} />}
      {d.family === 'road' && <RoadSolved card={card} fig={fig} d={d} p={p} />}
    </svg>
  );
}
