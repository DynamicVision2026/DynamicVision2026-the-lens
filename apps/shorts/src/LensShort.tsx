import {
  answerText,
  getCard,
  LensIcon,
  lensShortPlan,
  loadBundle,
  SHORT_COPY,
  shortSegmentAt,
  themed,
  tokens,
  type LensCard,
  type LensOrDirect,
  type ShortPlan,
  type ShortSegment,
} from '@lens/scenes';
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig, type CalculateMetadataFunction } from 'remotion';
import { BOXES, FIGURE, TYPE, type Box } from './layout';
import { CAPTIONS_HEADER, captionsSection, uploadCopy, type UploadCopy } from './captions';
import { FitFigure } from './FitFigure';
import { Burst, Camera, Iris, kick, KineticText, MathField, Sheen, Sparks } from './fx';
import { useFonts } from './useFonts';
import { voiceClip, voiceFor } from './voice';
import { estimateSpeechMs } from '@lens/scenes';

export type LensShortProps = {
  cardId: string;
  /** Filled in by calculateMetadata, so the batch script reads the upload copy from the bundle. */
  upload?: UploadCopy & { seconds: number; markdown: string; markdownHeader: string };
  /** [label, frame] snapshot frames, one per beat (pnpm render:shorts --stills). */
  stillFrames?: [string, number][];
};

const THEME = 'short_dark';
const T = themed(tokens, THEME).tokens;
const C = T.color;
/** Surfaces on navy (short_dark defines all three; the base theme may not). */
const SURF = { panel: (C.panel ?? C.paper).value, raise: (C.raise ?? C.paper).value, line: (C.line ?? C.grid).value };
const FPS = tokens.layout.short.fps;
const JA = `"${tokens.type.family_ja}", sans-serif`;
const NUM = `"${tokens.type.family_num}", "${tokens.type.family_ja}", sans-serif`;
const HAND = `"${tokens.type.family_hand}", "${tokens.type.family_ja}", cursive`;
const ease = Easing.bezier(0.2, 0.7, 0.2, 1);

const lensName = (lens: string) => loadBundle().labels.lenses[lens]?.ja ?? lens;
const lensHue = (lens: string) => C.lens[lens as LensOrDirect]?.value ?? C.ink.value;
const stepHue = (i: number) => C.step.palette[Math.max(0, i) % C.step.palette.length]!.value;

/** The plan for a card, with the generated voice clip lengths. Throws for cards the template cannot draw. */
export function planFor(cardId: string): { card: LensCard; plan: ShortPlan } {
  const card = getCard(cardId);
  const plan = card ? lensShortPlan(card, tokens, lensName(card.lens), voiceFor(cardId)) : null;
  if (!card || !plan) throw new Error(`LensShort: "${cardId}" is not a standard card with a scene in the bundle (report it to the Architect)`);
  return { card, plan };
}

export const calculateLensShortMetadata: CalculateMetadataFunction<LensShortProps> = ({ props }) => {
  const { card, plan } = planFor(props.cardId);
  const seconds = plan.totalMs / 1000;
  const copy = uploadCopy(card);
  return {
    durationInFrames: Math.ceil(seconds * FPS),
    props: { ...props, upload: { ...copy, seconds, markdown: captionsSection(copy, seconds), markdownHeader: CAPTIONS_HEADER }, stillFrames: stillFrames(plan) },
  };
};

/** One snapshot per beat: the hook, the countdown, the pick, the trap, each lens step (read), the CTA. */
export function stillFrames(plan: ShortPlan): [string, number][] {
  const f = (ms: number) => Math.round((ms / 1000) * FPS);
  const out: [string, number][] = [];
  let step = 0;
  for (const s of plan.segments) {
    const end = s.startMs + s.durationMs - 200;
    if (s.kind === 'hook') out.push(['1-hook', f(s.startMs + 1500)]);
    if (s.kind === 'choice') out.push(['2-choice', f(s.startMs + 1900)], ['2-pick', f(end)]);
    if (s.kind === 'trap') out.push(['3-trap', f(end)]);
    if (s.kind === 'lens') out.push([s.step === -1 ? '4-lens' : `4-step${++step}`, f(end)]);
    if (s.kind === 'cta') out.push(['5-cta', f(end)]);
  }
  return out;
}

/** 0→1 over `dur` ms starting `start` ms into the segment. */
const prog = (ms: number, start: number, dur: number) => interpolate(ms, [start, start + Math.max(1, dur)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });

function At({ box, children, style }: { box: Box; children: ReactNode; style?: CSSProperties }) {
  return <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height, ...style }}>{children}</div>;
}

/** The first keyframe that draws a figure: word problems open on their story text, which the Short prints itself. */
const firstFigureKf = (card: LensCard) => (card.animation?.keyframes[0] === 'show_story' && card.animation.keyframes.length > 1 ? 1 : 0);

function Chip({ lens, size, glow = 0, dim = 1 }: { lens: string; size: number; glow?: number; dim?: number }) {
  const hue = lensHue(lens);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.3,
        padding: `${size * 0.28}px ${size * 0.55}px`,
        borderRadius: size,
        border: `${4 + 4 * glow}px solid ${hue}`,
        background: SURF.raise,
        color: hue,
        fontFamily: JA,
        fontWeight: 700,
        fontSize: size,
        opacity: dim,
        boxShadow: glow > 0 ? `0 0 ${40 * glow}px ${hue}` : undefined,
        transform: `scale(${1 + 0.08 * glow})`,
      }}
    >
      <svg width={size * 1.1} height={size * 1.1} viewBox="0 0 24 24">
        <LensIcon lens={lens as LensOrDirect} tokens={T} color={hue} />
      </svg>
      {lensName(lens)}
    </div>
  );
}

/** Stage chip (中学受験 / 高校受験 / 大学受験) and the brand, top of every beat. */
function StageBar({ card }: { card: LensCard }) {
  return (
    <At box={BOXES.stage} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: JA, fontWeight: 700, fontSize: TYPE.stage }}>
      <span style={{ color: C.paper.value, background: C.ink.value, borderRadius: 12, padding: '4px 18px' }}>{SHORT_COPY.stages[card.stage] ?? card.stage}</span>
      <span style={{ color: C.ink_quiet.value }}>{SHORT_COPY.brand}</span>
    </At>
  );
}

function Headline({ text, color, ms, at, size = TYPE.headline, glow = 0.6 }: { text: string; color: string; ms: number; at: number; size?: number; glow?: number }) {
  return (
    <At box={BOXES.headline} style={{ display: 'flex', alignItems: 'center', fontFamily: JA, fontWeight: 900, fontSize: size, color, letterSpacing: '0.02em', textShadow: `0 0 ${28 * glow}px ${color}` }}>
      <KineticText text={text} ms={ms} at={at} stagger={40} />
    </At>
  );
}

/** The caption bar: slides in, glows in the step colour, writes its text in. */
function Caption({ text, color, ms, at, badge }: { text: string; color: string; ms: number; at: number; badge?: string }) {
  const p = prog(ms - at, 0, 350);
  return (
    <At box={BOXES.caption} style={{ display: 'flex', alignItems: 'center', opacity: p, transform: `translateX(${(1 - p) * -80}px)` }}>
      <div style={{ position: 'relative', width: '100%', background: SURF.panel, borderLeft: `14px solid ${color}`, borderRadius: 20, padding: '18px 28px', fontFamily: JA, fontWeight: 700, fontSize: TYPE.caption, lineHeight: 1.35, color: C.ink.value, boxShadow: `0 0 ${36 + 24 * kick(ms, at, 600)}px ${color}55` }}>
        {badge && <div style={{ position: 'absolute', top: -34, left: 18, fontFamily: NUM, fontWeight: 800, fontSize: 30, letterSpacing: '0.12em', color }}>{badge}</div>}
        <KineticText text={text} ms={ms} at={at + 120} stagger={14} rise={24} block />
      </div>
    </At>
  );
}


/** Centre of chip i in the column of `n` chips (frame px), for bursts on the pick. */
const chipCentre = (i: number, n: number) => ({ x: BOXES.chips.x + BOXES.chips.width / 2, y: BOXES.chips.y + BOXES.chips.height / 2 + (i - (n - 1) / 2) * 92 });
const COUNT_AT = 700;
const PICK_AT = COUNT_AT + 3000;
const countCentre = { x: BOXES.countdown.x + BOXES.countdown.width / 2, y: BOXES.countdown.y + BOXES.countdown.height / 2 };
const figCentre = (area: Box) => ({ x: area.x + area.width / 2, y: area.y + area.height / 2 });

function HookChoice({ card, plan, seg, ms }: { card: LensCard; plan: ShortPlan; seg: ShortSegment; ms: number }) {
  const hook = seg.kind === 'hook';
  const local = ms - seg.startMs;
  const accent = lensHue(card.lens);
  const figIn = hook ? prog(local, 500, 800) : 1;
  const chipsIn = hook ? 0 : prog(local, 0, 500);
  const left = Math.ceil((3000 - (local - COUNT_AT)) / 1000);
  const counting = !hook && local >= COUNT_AT && left > 0;
  const pick = hook ? 0 : prog(local, PICK_AT, 300);
  const tickAt = COUNT_AT + (3 - left) * 1000;
  const slam = counting ? 1 + 0.8 * kick(local, tickAt, 350) : 1;
  const ring = counting ? (local - COUNT_AT) / 3000 : pick > 0 ? 1 : 0;
  const R = 92;
  const circ = 2 * Math.PI * R;
  const n = plan.options.length;
  const right = plan.options.indexOf(card.picker.correct);
  return (
    <>
      {/* The hook text stays put through the choice, so the problem is never lost. */}
      <Headline text={SHORT_COPY.hook} color={accent} ms={hook ? local : 9999} at={0} glow={0.8 + 0.6 * kick(local, 0, 700)} />
      <At box={BOXES.problem} style={{ fontFamily: JA, fontWeight: 700, fontSize: TYPE.problem, lineHeight: 1.5, color: C.ink.value }}>
        <KineticText text={card.problem.text_ja} ms={hook ? local : 9999} at={250} stagger={9} rise={20} block />
      </At>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${0.88 + 0.12 * figIn})`, transformOrigin: '50% 70%' }}>
        <FitFigure card={card} area={FIGURE.hook} keyframe={firstFigureKf(card)} t={1} opacity={figIn * (hook ? 1 : 1 - 0.75 * chipsIn)} glow={accent} />
      </div>
      {!hook && (
        <>
          <At box={BOXES.countdown} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: chipsIn * (1 - pick) }}>
            <svg width={2 * R + 40} height={2 * R + 40} viewBox={`${-R - 20} ${-R - 20} ${2 * R + 40} ${2 * R + 40}`} style={{ overflow: 'visible', filter: `drop-shadow(0 0 18px ${accent})` }}>
              <circle r={R} fill={SURF.panel} stroke={SURF.line} strokeWidth={12} />
              <circle r={R} fill="none" stroke={accent} strokeWidth={14} strokeLinecap="round" strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * ring} transform="rotate(-90)" />
              <g transform={`scale(${slam})`}>
                <text y={TYPE.countdown * 0.35} textAnchor="middle" fontFamily={NUM} fontWeight={800} fontSize={TYPE.countdown} fill={C.ink.value}>
                  {counting ? left : ''}
                </text>
              </g>
            </svg>
          </At>
          <At box={BOXES.chips} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
            {plan.options.map((o, i) => {
              const inI = prog(local, i * 110, 420);
              const over = inI < 1 ? 1 + 0.12 * Math.sin(inI * Math.PI) : 1;
              const ok = o === card.picker.correct;
              return (
                <div key={o} style={{ opacity: inI, transform: `translateX(${(1 - inI) * (i % 2 ? 420 : -420)}px) scale(${over})` }}>
                  <Chip lens={o} size={TYPE.chip} glow={ok ? pick : 0} dim={ok ? 1 : 1 - 0.65 * pick} />
                </div>
              );
            })}
          </At>
          {counting && <Burst ms={local} at={tickAt} hue={accent} x={countCentre.x} y={countCentre.y} size={0.32} rays={8} />}
          <Burst ms={local} at={PICK_AT} hue={accent} {...chipCentre(right, n)} size={0.8} />
          <Sparks ms={local} at={PICK_AT} hues={[accent, C.ink.value, stepHue(0)]} {...chipCentre(right, n)} seed={`${card.id}-pick`} />
        </>
      )}
      {hook && <Burst ms={local} at={0} hue={accent} x={540} y={420} size={1.2} />}
    </>
  );
}

function Trap({ card, seg, ms }: { card: LensCard; seg: ShortSegment; ms: number }) {
  const local = ms - seg.startMs;
  const steps = card.trap_route.steps;
  const ink = C.ink_quiet.value;
  return (
    <>
      <Headline text={SHORT_COPY.trap} color={ink} ms={local} at={0} glow={0.2} />
      <FitFigure card={card} area={FIGURE.trap} keyframe={firstFigureKf(card)} t={1} opacity={0.16} />
      <At box={BOXES.trap} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 30 }}>
        {steps.map((s, i) => {
          const { appear, cross } = trapTimes(seg, steps.length, i);
          const a = prog(local, appear, 420);
          const x = prog(local, cross, 500);
          const jolt = kick(local, cross, 260);
          return (
            <div key={i} style={{ position: 'relative', opacity: a, transform: `translateX(${(1 - a) * -60 + jolt * 16 * Math.sin(local * 0.25)}px) rotate(${i % 2 ? 0.7 : -0.7}deg)` }}>
              <div style={{ fontFamily: HAND, fontSize: TYPE.trap, lineHeight: 1.4, color: ink, background: C.trap.tint.value, borderRadius: 16, padding: '16px 26px', opacity: 1 - 0.4 * x, textShadow: jolt > 0.05 ? `${6 * jolt}px 0 ${C.trap.flag.value}, ${-6 * jolt}px 0 ${C.lens.mirror.value}` : undefined }}>{s.ja}</div>
              <svg viewBox="0 0 100 20" preserveAspectRatio="none" style={{ position: 'absolute', left: '4%', top: '30%', width: '92%', height: '40%', overflow: 'visible' }}>
                <path d={TANGLE[i % TANGLE.length]} fill="none" stroke={C.trap.flag.value} strokeWidth={6} vectorEffect="non-scaling-stroke" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - x} opacity={0.85} />
              </svg>
            </div>
          );
        })}
      </At>
    </>
  );
}

/** When each habit step appears and is crossed out (ms into the trap segment); shared with the sound cues. */
function trapTimes(seg: ShortSegment, n: number, i: number): { appear: number; cross: number } {
  const per = (seg.durationMs - 1200) / Math.max(1, n);
  const appear = 200 + i * per;
  return { appear, cross: appear + Math.min(per * 0.75, 1800) };
}

/** Scribbles in a 100×20 box: a strike-through that loops back on itself (fixed shapes, deterministic). */
const TANGLE = [
  'M0 12 C 15 4, 25 18, 38 9 S 52 2, 58 12 S 48 20, 62 10 S 85 4, 100 11',
  'M0 9 C 12 16, 22 2, 35 11 S 50 18, 44 8 S 60 2, 70 12 S 90 16, 100 8',
  'M0 11 C 18 2, 28 16, 40 8 S 55 18, 66 9 S 74 2, 70 14 S 92 6, 100 12',
];

/** Plays keyframes kfFrom+1 … kfTo one after another across t (a step may cover several keyframes). */
function keyframeAt(from: number, to: number, t: number): { keyframe: number; t: number } {
  const n = to - from;
  if (n <= 0) return { keyframe: to, t: 1 };
  const x = t * n;
  const i = Math.min(n - 1, Math.floor(x));
  return { keyframe: from + 1 + i, t: x - i };
}

const isResultSeg = (card: LensCard, seg: ShortSegment) => (seg.steps ?? []).some((i) => card.lens_route.steps[i]?.op === 'result');

function Lens({ card, seg, ms }: { card: LensCard; seg: ShortSegment; ms: number }) {
  const local = ms - seg.startMs;
  const accent = lensHue(card.lens);
  const intro = seg.step === -1;
  // The keyframe animates during the first part of the step; the rest is reading time.
  const move = Math.min(1400, seg.durationMs * 0.45);
  const t = intro ? 1 : prog(local, 150, move);
  const steps = intro ? [] : (seg.steps ?? []).map((i) => card.lens_route.steps[i]!);
  const result = isResultSeg(card, seg);
  const hue = result ? C.correct.value : stepHue(seg.step ?? 0);
  const fc = figCentre(FIGURE.lens);
  const badge = result ? '' : `STEP ${(seg.step ?? 0) + 1}${steps.length > 1 ? `–${(seg.step ?? 0) + steps.length}` : ''}`;
  return (
    <>
      <At box={BOXES.headline} style={{ display: 'flex', alignItems: 'center', gap: 22, fontFamily: JA, fontWeight: 900, fontSize: TYPE.headline, color: accent, textShadow: `0 0 24px ${accent}` }}>
        <div style={{ transform: `scale(${1 + 0.25 * (intro ? kick(local, 0, 500) : 0)})` }}>
          <Chip lens={card.lens} size={44} glow={intro ? 1 : 0.5} />
        </div>
        <KineticText text={SHORT_COPY.lens} ms={intro ? local : 9999} at={150} stagger={45} />
      </At>
      <FitFigure card={card} area={FIGURE.lens} {...(intro ? { keyframe: firstFigureKf(card), t: 1 } : keyframeAt(seg.kfFrom, seg.kfTo, t))} glow={accent} glowBoost={result ? kick(local, 0, 1200) : 0} />
      {steps.length > 0 && <Caption text={steps.map((st) => st.ja).join('\n')} color={hue} ms={local} at={0} badge={badge} />}
      {intro && seg.line && seg.line.text.includes(card.trigger.ja) && <Caption text={card.trigger.ja} color={accent} ms={local} at={250} />}
      {intro && <Iris ms={local} at={0} hue={accent} x={BOXES.headline.x + 110} y={BOXES.headline.y + BOXES.headline.height / 2} />}
      {result && <Burst ms={local} at={250} hue={C.correct.value} x={fc.x} y={fc.y} size={1.1} rays={18} />}
      {result && <Sparks ms={local} at={250} hues={[C.correct.value, accent, ...C.step.palette.map((p) => p.value)]} x={fc.x} y={fc.y} n={48} seed={`${card.id}-answer`} />}
    </>
  );
}

function Cta({ card, seg, ms }: { card: LensCard; seg: ShortSegment; ms: number }) {
  const local = ms - seg.startMs;
  const a = prog(local, 0, 450);
  const b = prog(local, 250, 450);
  const c = prog(local, 650, 500);
  const d = prog(local, 1000, 500);
  const accent = lensHue(card.lens);
  const book = SHORT_COPY.books[card.stage];
  const editions = Object.values(SHORT_COPY.books).map((x) => x.edition).join('・');
  return (
    <>
      <At box={BOXES.ctaLens} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: a, transform: `scale(${0.6 + 0.4 * a + 0.15 * kick(local, 0, 400)})` }}>
        <Chip lens={card.lens} size={TYPE.lensName * 0.62} glow={1} />
      </At>
      <At box={BOXES.ctaAnswer} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: b }}>
        <span style={{ fontFamily: JA, fontWeight: 700, fontSize: TYPE.cta, color: C.ink_quiet.value }}>{SHORT_COPY.answer}</span>
        <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: TYPE.answer, color: C.correct.value, textShadow: `0 0 34px ${C.correct.value}`, transform: `scale(${1 + 0.3 * kick(local, 250, 500)})`, display: 'inline-block' }}>{answerText(card)}</span>
      </At>
      <At box={BOXES.ctaTrigger} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: JA, fontWeight: 700, fontSize: TYPE.trigger, lineHeight: 1.45, color: C.ink.value }}>
        <KineticText text={card.trigger.ja} ms={local} at={600} stagger={12} rise={18} block />
      </At>
      <At box={BOXES.ctaUrl} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, opacity: c, transform: `translateY(${(1 - c) * 40}px)` }}>
        <span style={{ fontFamily: JA, fontWeight: 900, fontSize: TYPE.cta, color: C.ink.value }}>{SHORT_COPY.cta}</span>
        <span style={{ position: 'relative', overflow: 'hidden', fontFamily: NUM, fontWeight: 800, fontSize: TYPE.url, color: accent, border: `4px solid ${accent}`, borderRadius: 24, padding: '10px 34px', boxShadow: `0 0 40px ${accent}66` }}>
          {SHORT_COPY.url}
          <Sheen ms={local} />
        </span>
      </At>
      <At box={BOXES.ctaBook} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: d, transform: `translateY(${(1 - d) * 40}px)` }}>
        <div style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 26, background: SURF.panel, border: `3px solid ${SURF.line}`, borderRadius: 26, padding: '22px 30px' }}>
          {/* A small book: the paperback's two-band cover in the lens colour. */}
          <svg width={92} height={124} viewBox="0 0 92 124">
            <rect x={4} y={4} width={84} height={116} rx={6} fill={C.ink.value} />
            <rect x={4} y={4} width={84} height={40} rx={6} fill={accent} />
            <circle cx={46} cy={78} r={22} fill="none" stroke={accent} strokeWidth={5} />
            <rect x={4} y={4} width={9} height={116} fill={SURF.line} opacity={0.6} />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontFamily: JA, fontWeight: 900, fontSize: TYPE.book, color: C.ink.value }}>{SHORT_COPY.bookLine}</span>
            <span style={{ fontFamily: JA, fontWeight: 700, fontSize: TYPE.book * 0.78, color: accent }}>{book ? `『${book.title}』` : editions}</span>
            <span style={{ fontFamily: JA, fontWeight: 700, fontSize: TYPE.book * 0.7, color: C.ink_quiet.value }}>{SHORT_COPY.bookSearch}</span>
          </div>
          <Sheen ms={local + 900} period={2400} />
        </div>
      </At>
      <Burst ms={local} at={0} hue={accent} x={540} y={BOXES.ctaLens.y + 80} size={1.2} />
      <Sparks ms={local} at={250} hues={[C.correct.value, accent, ...C.step.palette.map((p) => p.value)]} x={540} y={BOXES.ctaAnswer.y + 120} n={40} seed={`${card.id}-cta`} />
    </>
  );
}

/** How bright the background is per beat: dim and grey in the trap, bright once the lens opens. */
function energyOf(seg: ShortSegment, local: number): { energy: number; grey: number } {
  if (seg.kind === 'hook') return { energy: 0.9, grey: 0 };
  if (seg.kind === 'choice') return { energy: 0.6 + 0.4 * kick(local, PICK_AT, 900), grey: 0 };
  if (seg.kind === 'trap') return { energy: 0.15, grey: 0.75 };
  if (seg.kind === 'cta') return { energy: 1, grey: 0 };
  return { energy: seg.step === -1 ? 0.5 + 0.5 * prog(local, 0, 900) : 0.75, grey: 0 };
}

interface Cue {
  src: string;
  at: number;
  volume?: number;
}

/** Sound effects on the beats: whoosh on every change, impact on the pick / the lens / the answer, ticks, glitches. */
function sfxCues(card: LensCard, plan: ShortPlan): Cue[] {
  const cues: Cue[] = [{ src: 'impact', at: 0, volume: 0.7 }];
  for (const s of plan.segments) {
    if (s.startMs > 0 && s.kind !== 'lens') cues.push({ src: 'whoosh', at: s.startMs - 250, volume: 0.45 });
    if (s.kind === 'choice') {
      for (let k = 0; k < 3; k++) cues.push({ src: 'tick', at: s.startMs + COUNT_AT + k * 1000, volume: 0.7 });
      cues.push({ src: 'rise', at: s.startMs + PICK_AT - 1000, volume: 0.4 });
      cues.push({ src: 'impact', at: s.startMs + PICK_AT, volume: 0.65 });
    }
    if (s.kind === 'trap') card.trap_route.steps.forEach((_, i) => cues.push({ src: 'glitch', at: s.startMs + trapTimes(s, card.trap_route.steps.length, i).cross, volume: 0.35 }));
    if (s.kind === 'lens' && s.step === -1) cues.push({ src: 'impact', at: s.startMs, volume: 0.75 });
    if (s.kind === 'lens' && s.step !== -1) cues.push({ src: 'whoosh', at: s.startMs - 200, volume: 0.25 });
    if (s.kind === 'lens' && isResultSeg(card, s)) cues.push({ src: 'shimmer', at: s.startMs + 250, volume: 0.6 });
    if (s.kind === 'cta') cues.push({ src: 'impact', at: s.startMs, volume: 0.6 }, { src: 'shimmer', at: s.startMs + 250, volume: 0.5 });
  }
  return cues;
}

/**
 * Music levels over time: the bed (depth) plays throughout and ducks under the voice; the drive (kick,
 * arpeggio: brightness) opens the Short, drops out for the trap, and comes back when the lens opens.
 */
function musicLevels(plan: ShortPlan, cardId: string) {
  const voice = voiceFor(cardId);
  const talk = plan.segments.filter((s) => s.line).map((s) => [s.startMs, s.startMs + (voice(s.line!.key, s.line!.speech) ?? estimateSpeechMs(s.line!.speech)) + 150] as const);
  const talking = (ms: number) => talk.some(([a, b]) => ms >= a - 120 && ms <= b);
  const end = plan.totalMs;
  const fade = (ms: number) => Math.min(1, (end - ms) / 1500, ms / 200);
  const segAt = (ms: number) => shortSegmentAt(plan, ms).segment;
  const bed = (ms: number) => fade(ms) * (talking(ms) ? 0.22 : 0.5);
  const drive = (ms: number) => {
    const s = segAt(ms);
    const local = ms - s.startMs;
    const base = s.kind === 'hook' ? 0.55 : s.kind === 'choice' ? 0.45 : s.kind === 'trap' ? 0.0 : s.kind === 'cta' ? 0.55 : s.step === -1 ? 0.5 * prog(local, 0, 700) : 0.38;
    return fade(ms) * base * (talking(ms) ? 0.45 : 1);
  };
  return { bed, drive };
}

/**
 * WO-028: the 「どのレンズ？」 Short for any card with a scene. Remotion maps the frame to a plan segment;
 * the figure is the card's masterclass scene (LensScene, theme short_dark), every word comes from the
 * card or SHORT_COPY. Around it: a living math background, camera punches on every beat, kinetic text,
 * bursts, and an original soundtrack (tools/make_short_music.py). Voice clips play when generated;
 * without them the Short still renders (music only).
 */
export function LensShort({ cardId }: LensShortProps) {
  useFonts();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { card, plan } = planFor(cardId);
  const ms = (frame / fps) * 1000;
  const { segment: seg } = shortSegmentAt(plan, ms);
  const local = ms - seg.startMs;
  const accent = lensHue(card.lens);
  const { energy, grey } = energyOf(seg, local);
  const levels = musicLevels(plan, cardId);
  const toMs = (f: number) => (f / fps) * 1000;
  const punch = kick(ms, seg.startMs, 450) + (seg.kind === 'choice' ? 0.6 * kick(local, PICK_AT, 400) : 0);
  const push = seg.kind === 'lens' ? local / seg.durationMs : seg.kind === 'hook' ? local / seg.durationMs : 0;
  const shake = seg.kind === 'trap' ? card.trap_route.steps.reduce((m, _, i) => Math.max(m, kick(local, trapTimes(seg, card.trap_route.steps.length, i).cross, 220)), 0) * 0.5 : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: C.paper.value }}>
      <MathField card={card} ms={ms} hue={accent} energy={energy} grey={grey} />
      <Camera punch={punch} push={push} shake={shake} ms={ms}>
        <StageBar card={card} />
        {(seg.kind === 'hook' || seg.kind === 'choice') && <HookChoice card={card} plan={plan} seg={seg} ms={ms} />}
        {seg.kind === 'trap' && <Trap card={card} seg={seg} ms={ms} />}
        {seg.kind === 'lens' && <Lens card={card} seg={seg} ms={ms} />}
        {seg.kind === 'cta' && <Cta card={card} seg={seg} ms={ms} />}
      </Camera>
      <Audio src={staticFile('music/bed.m4a')} volume={(f) => levels.bed(toMs(f))} />
      <Audio src={staticFile('music/drive.m4a')} volume={(f) => levels.drive(toMs(f))} />
      {sfxCues(card, plan).map((cue, i) => (
        <Sequence key={`fx${i}`} from={Math.max(0, Math.round((cue.at / 1000) * fps))} layout="none">
          <Audio src={staticFile(`music/${cue.src}.m4a`)} volume={cue.volume ?? 0.6} />
        </Sequence>
      ))}
      {plan.segments.map((s, i) => {
        const clip = s.line ? voiceClip(cardId, s.line.key, s.line.speech) : null;
        return clip ? (
          <Sequence key={i} from={Math.round((s.startMs / 1000) * fps)} durationInFrames={Math.round((s.durationMs / 1000) * fps)} layout="none">
            <Audio src={staticFile(clip)} />
          </Sequence>
        ) : null;
      })}
    </AbsoluteFill>
  );
}
