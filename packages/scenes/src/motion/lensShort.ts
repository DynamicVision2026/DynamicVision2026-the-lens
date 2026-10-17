// WO-028: the 「どのレンズ？」 Short for any card with a scene. One plan for every lens and stage:
// hook (the problem) → choice (3 lens chips + countdown) → trap (the habit's route, greyed) → lens (the
// card's own masterclass keyframes, one lens step at a time, at study pace) → CTA. Pure functions of
// the card, the tokens and the voice clip lengths, so the render, the voice script and the tests agree.
import { tokens as defaultTokens } from '../tokens';
import { hasScene } from '../variant';
import type { LensCard, Tokens } from '../types';
import { SHORT_COPY } from './MotionScene';
import { studyStepMs } from './timeline';

export type ShortSegmentKind = 'hook' | 'choice' | 'trap' | 'lens' | 'cta';

/** One spoken line: `text` is the burned-in caption, `speech` what the voice reads (math spelled out). */
export interface ShortLine {
  key: string;
  text: string;
  speech: string;
}

export interface ShortSegment {
  kind: ShortSegmentKind;
  startMs: number;
  durationMs: number;
  /** The voice line played from the start of the segment (none for the countdown). */
  line?: ShortLine;
  /** Lens segments: first index into lens_route.steps (−1 for the 「レンズで見ると」 intro), and all of them. */
  step?: number;
  steps?: number[];
  /** Masterclass keyframe drawn at the start and at the end of the segment. */
  kfFrom: number;
  kfTo: number;
}

export interface ShortPlan {
  segments: ShortSegment[];
  totalMs: number;
  /** The three lens chips (the correct lens always among them), in picker order. */
  options: string[];
  /** ShortScript.level used for this card. */
  level: Level;
}

/** Segment windows (WO-028 §1 beat sheet). */
export const SHORT_MS = {
  hook: 3000,
  choice: 5000,
  /** Inside the choice window: chips in, then 3 · 2 · 1, then the correct chip lights. */
  choiceChipsIn: 700,
  countdown: 3000,
  trap: 7000,
  lensIntro: 1800,
  cta: 5000,
  /** Room after a voice line before the next segment. */
  voicePad: 450,
  min: 30_000,
  max: 45_000,
} as const;

/** Rough VOICEVOX length when a clip has not been generated yet (春日部つむぎ at speed 1.12). */
export function estimateSpeechMs(speech: string): number {
  return Math.round(350 + speech.replace(/[\s、。・…「」]/g, '').length * 125);
}

/**
 * The text the voice reads for a caption: operators and symbols spelled out in Japanese, so VOICEVOX
 * does not skip or misread them. The caption itself always shows the card's exact text.
 */
export function speechText(text: string): string {
  return (
    text
      .replace(/△/g, '三角形')
      .replace(/cm²/g, '平方センチメートル')
      .replace(/cm³/g, '立方センチメートル')
      .replace(/²/g, 'の2乗')
      .replace(/³/g, 'の3乗')
      .replace(/√/g, 'ルート')
      .replace(/π/g, 'パイ')
      .replace(/(\d+)\/(\d+)/g, '$2分の$1')
      .replace(/(^|[(（,，、\s=＝])[−-](?=\d)/g, '$1マイナス')
      .replace(/\s*[−-]\s*/g, 'ひく')
      .replace(/\s*[+＋]\s*/g, 'たす')
      .replace(/\s*[×]\s*/g, 'かける')
      .replace(/\s*[÷]\s*/g, 'わる')
      .replace(/\s*[=＝]\s*/g, 'は')
      .replace(/([A-Z])'/g, '$1ダッシュ')
      .replace(/[（）()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

const line = (key: string, text: string): ShortLine => ({ key, text, speech: speechText(text) });

/** The three chips: the correct lens plus the first two other picker options. */
export function shortOptions(card: LensCard): string[] {
  const opts = card.picker.options;
  const others = opts.filter((o) => o !== card.picker.correct).slice(0, 2);
  const keep = new Set([card.picker.correct, ...others]);
  return opts.filter((o) => keep.has(o));
}

/**
 * How a card's lens route is told: which lens steps share a segment, and whether the lens intro also
 * speaks the trigger. Chosen from estimated voice lengths only (never from generated clips), so the
 * voice script and the render always agree on the lines.
 */
export interface ShortScript {
  lines: ShortLine[];
  /** Lens step indices per lens segment, in order. */
  groups: number[][];
  /**
   * Compression used to stay within 45 s: 0 full, 1 trigger shown but not spoken, 2 corner steps merged,
   * 3 a long step speaks only its first sentence (the caption still shows all of it).
   */
  level: Level;
}

type Level = 0 | 1 | 2 | 3;
const LONG_STEP = 40;

const stepKey = (g: number[]) => (g.length === 1 ? `step${g[0]! + 1}` : `step${g[0]! + 1}_${g[g.length - 1]! + 1}`);

function scriptAt(card: LensCard, lensLabel: string, level: Level): ShortScript {
  const steps = card.lens_route.steps;
  const groups: number[][] = [];
  steps.forEach((s, i) => {
    const prev = groups[groups.length - 1];
    // Level 2: a run of corner (sub) steps becomes one segment, read as one list.
    if (level >= 2 && prev && s.op === 'sub' && steps[prev[prev.length - 1]!]!.op === 'sub') prev.push(i);
    else groups.push([i]);
  });
  const trap = card.trap_route.steps[0]?.ja;
  const intro = `${lensLabel}${SHORT_COPY.lens}`;
  const lines = [
    line('hook', SHORT_COPY.hook),
    line('trap', trap ? `${SHORT_COPY.trap}${trap}` : SHORT_COPY.trap),
    line('lens', level >= 1 ? `${intro}。` : `${intro}。${card.trigger.ja}`),
    ...groups.map((g) => {
      const text = g.map((i) => steps[i]!.ja).join('、');
      const first = text.split('。')[0]!;
      return level >= 3 && text.length > LONG_STEP && first.length < text.length ? { key: stepKey(g), text, speech: speechText(`${first}。`) } : line(stepKey(g), text);
    }),
    line('cta', `${lensLabel}。${SHORT_COPY.ctaSay}`),
  ];
  return { lines, groups, level };
}

/** Every spoken line of a card's Short, in order (also the voice script for tools/make_voice.py). */
export function shortLines(card: LensCard, lensLabel: string): ShortLine[] {
  return shortScript(card, lensLabel).lines;
}

/** Cards the template can turn into a Short: a standard card whose figure has a keyframe scene. */
export function canShort(card: LensCard): boolean {
  return card.kind === 'standard' && hasScene(card) && (card.animation?.keyframes?.length ?? 0) >= 2 && card.lens_route.steps.length > 0;
}

/** The least compressed script whose estimated length fits 45 s (the most compressed one otherwise). */
export function shortScript(card: LensCard, lensLabel: string, tokens: Tokens = defaultTokens): ShortScript {
  let script = scriptAt(card, lensLabel, 0);
  for (const level of [0, 1, 2, 3] as const) {
    script = scriptAt(card, lensLabel, level);
    if (planFrom(card, script, tokens, () => undefined).totalMs <= SHORT_MS.max) break;
  }
  return script;
}

/**
 * The Short's segments for a card, or null when the card has no scene. `voiceMs(key)` returns a
 * generated clip's length; missing clips fall back to an estimate, so a silent render keeps the
 * same timing. Lens segments get at least one study-pace step each; the plan is stretched to 30 s
 * when it would be shorter.
 */
export function lensShortPlan(card: LensCard, tokens: Tokens, lensLabel: string, voiceMs: (key: string) => number | undefined = () => undefined): ShortPlan | null {
  if (!canShort(card)) return null;
  return planFrom(card, shortScript(card, lensLabel, tokens), tokens, voiceMs);
}

function planFrom(card: LensCard, script: ShortScript, tokens: Tokens, voiceMs: (key: string) => number | undefined): ShortPlan {
  const lines = Object.fromEntries(script.lines.map((l) => [l.key, l]));
  const need = (key: string) => (voiceMs(key) ?? estimateSpeechMs(lines[key]!.speech)) + SHORT_MS.voicePad;
  const lastKf = card.animation!.keyframes.length - 1;
  const n = card.lens_route.steps.length;
  // Same mapping as the masterclass walkthrough: after step i of n, keyframe round(i / n × last).
  const kfAfter = (i: number) => Math.round((i / n) * lastKf);

  const study = studyStepMs(tokens);
  const groupMs = script.groups.map((g) => Math.max(study, need(stepKey(g))));
  const fixed = Math.max(SHORT_MS.hook, need('hook')) + SHORT_MS.choice + Math.max(SHORT_MS.trap, need('trap')) + Math.max(SHORT_MS.lensIntro, need('lens')) + Math.max(SHORT_MS.cta, need('cta'));
  const lensTotal = groupMs.reduce((a, b) => a + b, 0);
  // Stretch the lens steps (never the hook or the countdown) to reach the 30 s floor.
  const short = SHORT_MS.min - (fixed + lensTotal);
  if (short > 0) groupMs.forEach((_, i) => (groupMs[i]! += Math.ceil(short / groupMs.length)));

  const segments: ShortSegment[] = [];
  let at = 0;
  const push = (s: Omit<ShortSegment, 'startMs'>) => {
    segments.push({ ...s, startMs: at });
    at += s.durationMs;
  };
  push({ kind: 'hook', durationMs: Math.max(SHORT_MS.hook, need('hook')), line: lines.hook, kfFrom: 0, kfTo: 0 });
  push({ kind: 'choice', durationMs: SHORT_MS.choice, kfFrom: 0, kfTo: 0 });
  push({ kind: 'trap', durationMs: Math.max(SHORT_MS.trap, need('trap')), line: lines.trap, kfFrom: 0, kfTo: 0 });
  push({ kind: 'lens', durationMs: Math.max(SHORT_MS.lensIntro, need('lens')), line: lines.lens, step: -1, steps: [], kfFrom: 0, kfTo: 0 });
  script.groups.forEach((g, i) =>
    push({ kind: 'lens', durationMs: groupMs[i]!, line: lines[stepKey(g)], step: g[0]!, steps: g, kfFrom: kfAfter(g[0]!), kfTo: kfAfter(g[g.length - 1]! + 1) }),
  );
  push({ kind: 'cta', durationMs: Math.max(SHORT_MS.cta, need('cta')), line: lines.cta, kfFrom: lastKf, kfTo: lastKf });
  return { segments, totalMs: at, options: shortOptions(card), level: script.level };
}

/** The segment at a time (ms), and the progress 0–1 inside it. Past the end: the last segment at 1. */
export function shortSegmentAt(plan: ShortPlan, ms: number): { index: number; segment: ShortSegment; t: number } {
  const segs = plan.segments;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    if (ms < s.startMs + s.durationMs) return { index: i, segment: s, t: Math.max(0, (ms - s.startMs) / s.durationMs) };
  }
  return { index: segs.length - 1, segment: segs[segs.length - 1]!, t: 1 };
}
