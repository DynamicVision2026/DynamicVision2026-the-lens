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
import { useFonts } from './useFonts';
import { voiceClip, voiceMs } from './voice';

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
  const plan = card ? lensShortPlan(card, tokens, lensName(card.lens), (key) => voiceMs(cardId, key)) : null;
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

function Headline({ text, color, opacity = 1, size = TYPE.headline }: { text: string; color: string; opacity?: number; size?: number }) {
  return (
    <At box={BOXES.headline} style={{ display: 'flex', alignItems: 'center', fontFamily: JA, fontWeight: 900, fontSize: size, color, opacity, letterSpacing: '0.02em' }}>
      {text}
    </At>
  );
}

function Caption({ text, color, opacity }: { text: string; color: string; opacity: number }) {
  return (
    <At box={BOXES.caption} style={{ display: 'flex', alignItems: 'center', opacity }}>
      <div style={{ width: '100%', background: SURF.panel, borderLeft: `14px solid ${color}`, borderRadius: 20, padding: '18px 28px', fontFamily: JA, fontWeight: 700, fontSize: TYPE.caption, lineHeight: 1.35, color: C.ink.value, whiteSpace: 'pre-line' }}>
        {text}
      </div>
    </At>
  );
}

function HookChoice({ card, plan, seg, ms }: { card: LensCard; plan: ShortPlan; seg: ShortSegment; ms: number }) {
  const hook = seg.kind === 'hook';
  const local = ms - seg.startMs;
  const textIn = hook ? prog(local, 0, 400) : 1;
  const figIn = hook ? prog(local, 300, 700) : 1;
  const chipsIn = hook ? 0 : prog(local, 0, 500);
  // 3 · 2 · 1 after the chips are in; the correct chip lights once it reaches zero.
  const cdStart = 700;
  const left = Math.ceil((3000 - (local - cdStart)) / 1000);
  const counting = !hook && local >= cdStart && left > 0;
  const pick = hook ? 0 : prog(local, cdStart + 3000, 400);
  const tick = counting ? 1 - ((local - cdStart) % 1000) / 1000 : 0;
  const ring = counting ? (local - cdStart) / 3000 : pick > 0 ? 1 : 0;
  const R = 84;
  const circ = 2 * Math.PI * R;
  const accent = lensHue(card.lens);
  return (
    <>
      <Headline text={SHORT_COPY.hook} color={accent} opacity={textIn} />
      <At box={BOXES.problem} style={{ fontFamily: JA, fontWeight: 700, fontSize: TYPE.problem, lineHeight: 1.5, color: C.ink.value, opacity: textIn, transform: `translateY(${(1 - textIn) * 30}px)` }}>
        {card.problem.text_ja}
      </At>
      <FitFigure card={card} area={FIGURE.hook} keyframe={firstFigureKf(card)} t={1} opacity={figIn * (hook ? 1 : 1 - 0.75 * chipsIn)} />
      {!hook && (
        <>
          <At box={BOXES.countdown} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: chipsIn * (1 - pick) }}>
            <svg width={2 * R + 24} height={2 * R + 24} viewBox={`${-R - 12} ${-R - 12} ${2 * R + 24} ${2 * R + 24}`}>
              <circle r={R} fill={SURF.panel} stroke={SURF.line} strokeWidth={12} />
              <circle r={R} fill="none" stroke={accent} strokeWidth={12} strokeLinecap="round" strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * ring} transform="rotate(-90)" />
              <text y={TYPE.countdown * 0.35} textAnchor="middle" fontFamily={NUM} fontWeight={800} fontSize={TYPE.countdown * (0.8 + 0.2 * tick)} fill={C.ink.value}>
                {counting ? left : ''}
              </text>
            </svg>
          </At>
          <At box={BOXES.chips} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
            {plan.options.map((o, i) => {
              const inI = prog(local, i * 120, 450);
              const right = o === card.picker.correct;
              return (
                <div key={o} style={{ opacity: inI, transform: `translateY(${(1 - inI) * 40}px)` }}>
                  <Chip lens={o} size={TYPE.chip} glow={right ? pick : 0} dim={right ? 1 : 1 - 0.6 * pick} />
                </div>
              );
            })}
          </At>
        </>
      )}
    </>
  );
}

function Trap({ card, seg, ms }: { card: LensCard; seg: ShortSegment; ms: number }) {
  const local = ms - seg.startMs;
  const steps = card.trap_route.steps;
  const per = (seg.durationMs - 1200) / Math.max(1, steps.length);
  const ink = C.ink_quiet.value;
  return (
    <>
      <Headline text={SHORT_COPY.trap} color={ink} opacity={prog(local, 0, 300)} />
      <FitFigure card={card} area={FIGURE.trap} keyframe={firstFigureKf(card)} t={1} opacity={0.18} />
      <At box={BOXES.trap} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 30 }}>
        {steps.map((s, i) => {
          const a = prog(local, 200 + i * per, 450);
          // Each habit step is crossed out with a tangled pencil line once it has been read.
          const cross = prog(local, 200 + i * per + Math.min(per * 0.75, 1800), 600);
          return (
            <div key={i} style={{ position: 'relative', opacity: a, transform: `translateX(${(1 - a) * -30}px) rotate(${i % 2 ? 0.7 : -0.7}deg)` }}>
              <div style={{ fontFamily: HAND, fontSize: TYPE.trap, lineHeight: 1.4, color: ink, background: C.trap.tint.value, borderRadius: 16, padding: '16px 26px', opacity: 1 - 0.35 * cross }}>{s.ja}</div>
              <svg viewBox="0 0 100 20" preserveAspectRatio="none" style={{ position: 'absolute', left: '4%', top: '30%', width: '92%', height: '40%', overflow: 'visible' }}>
                <path d={TANGLE[i % TANGLE.length]} fill="none" stroke={C.trap.flag.value} strokeWidth={6} vectorEffect="non-scaling-stroke" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - cross} opacity={0.8} />
              </svg>
            </div>
          );
        })}
      </At>
    </>
  );
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

function Lens({ card, seg, ms }: { card: LensCard; seg: ShortSegment; ms: number }) {
  const local = ms - seg.startMs;
  const accent = lensHue(card.lens);
  const intro = seg.step === -1;
  // The keyframe animates during the first part of the step; the rest is reading time.
  const move = Math.min(1400, seg.durationMs * 0.45);
  const t = intro ? 1 : prog(local, 150, move);
  const steps = intro ? [] : (seg.steps ?? []).map((i) => card.lens_route.steps[i]!);
  const isResult = steps.some((st) => st.op === 'result');
  const hue = isResult ? C.correct.value : stepHue(seg.step ?? 0);
  return (
    <>
      <At box={BOXES.headline} style={{ display: 'flex', alignItems: 'center', gap: 22, fontFamily: JA, fontWeight: 900, fontSize: TYPE.headline, color: accent }}>
        <Chip lens={card.lens} size={44} glow={intro ? prog(local, 0, 500) : 0.4} />
        <span>{SHORT_COPY.lens}</span>
      </At>
      <FitFigure card={card} area={FIGURE.lens} {...(intro ? { keyframe: firstFigureKf(card), t: 1 } : keyframeAt(seg.kfFrom, seg.kfTo, t))} />
      {steps.length > 0 && <Caption text={steps.map((st) => st.ja).join('\n')} color={hue} opacity={prog(local, 0, 300)} />}
      {intro && <Caption text={card.trigger.ja} color={accent} opacity={prog(local, 200, 400)} />}
    </>
  );
}

function Cta({ card, seg, ms }: { card: LensCard; seg: ShortSegment; ms: number }) {
  const local = ms - seg.startMs;
  const a = prog(local, 0, 500);
  const b = prog(local, 300, 500);
  const c = prog(local, 700, 500);
  const accent = lensHue(card.lens);
  return (
    <>
      <At box={BOXES.ctaLens} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: a, transform: `scale(${0.9 + 0.1 * a})` }}>
        <Chip lens={card.lens} size={TYPE.lensName * 0.62} glow={1} />
      </At>
      <At box={BOXES.ctaAnswer} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: b }}>
        <span style={{ fontFamily: JA, fontWeight: 700, fontSize: TYPE.cta, color: C.ink_quiet.value }}>{SHORT_COPY.answer}</span>
        <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: TYPE.answer, color: C.correct.value }}>{answerText(card)}</span>
      </At>
      <At box={BOXES.ctaUrl} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, opacity: c, transform: `translateY(${(1 - c) * 30}px)` }}>
        <span style={{ fontFamily: JA, fontWeight: 900, fontSize: TYPE.cta, color: C.ink.value }}>{SHORT_COPY.cta}</span>
        <span style={{ fontFamily: NUM, fontWeight: 800, fontSize: TYPE.url, color: accent, border: `4px solid ${accent}`, borderRadius: 24, padding: '10px 34px' }}>{SHORT_COPY.url}</span>
        <span style={{ fontFamily: JA, fontWeight: 700, fontSize: TYPE.stage, color: C.ink_quiet.value }}>{SHORT_COPY.brand}</span>
      </At>
    </>
  );
}

/**
 * WO-028: the 「どのレンズ？」 Short for any card with a scene. Remotion maps the frame to a plan segment;
 * the figure is the card's masterclass scene (LensScene, theme short_dark), every word comes from the
 * card or SHORT_COPY. Voice clips play when generated; without them the Short renders silent.
 */
export function LensShort({ cardId }: LensShortProps) {
  useFonts();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { card, plan } = planFor(cardId);
  const ms = (frame / fps) * 1000;
  const { segment: seg } = shortSegmentAt(plan, ms);
  return (
    <AbsoluteFill style={{ backgroundColor: C.paper.value }}>
      <StageBar card={card} />
      {(seg.kind === 'hook' || seg.kind === 'choice') && <HookChoice card={card} plan={plan} seg={seg} ms={ms} />}
      {seg.kind === 'trap' && <Trap card={card} seg={seg} ms={ms} />}
      {seg.kind === 'lens' && <Lens card={card} seg={seg} ms={ms} />}
      {seg.kind === 'cta' && <Cta card={card} seg={seg} ms={ms} />}
      {plan.segments.map((s, i) => {
        const clip = s.line ? voiceClip(cardId, s.line.key) : null;
        return clip ? (
          <Sequence key={i} from={Math.round((s.startMs / 1000) * fps)} durationInFrames={Math.round((s.durationMs / 1000) * fps)} layout="none">
            <Audio src={staticFile(clip)} />
          </Sequence>
        ) : null;
      })}
    </AbsoluteFill>
  );
}
