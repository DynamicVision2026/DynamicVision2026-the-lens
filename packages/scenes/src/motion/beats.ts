// Motion preview beats as reducers over one state, like the keyframes: the frame at (beat k, t) is
// every earlier beat at t = 1, then beat k at t. Each beat turns t into elapsed ms of its own window,
// so springs, staggers and the glow pulse are pure functions of t.
import { clamp01, type Easing } from '../easing';
import { springAt } from '../spring';
import type { SpringToken, Tokens } from '../types';
import type { Beat, BeatName } from './timeline';

export interface MotionState {
  grid: number;
  /** Figure drawn in chalk (trap ink), then crossfaded to ink by `inked`. */
  chalk: number;
  inked: number;
  /** Opacity of the trap scratch lines. */
  scratch: number;
  icon: number;
  box: number;
  boxFade: number;
  /** 0–1 strength of the glow on the box (and later the core outline). */
  glow: number;
  cornerFill: number[];
  cornerLabel: number[];
  /** 0–1 per corner: outward slide and fade. */
  cornerRemove: number[];
  /** Fade-in per equation term: the start value, then one per sub step. */
  terms: number[];
  core: number;
  coreGlow: number;
  /** ms since the core outline started glowing, for the pulse. */
  pulseMs: number;
  result: number;
  display: number;
  trigger: number;
}

export interface MotionContext {
  corners: number;
  tokens: Tokens;
  ease: Easing;
  spring: SpringToken;
}

export function initialMotionState(corners: number): MotionState {
  const zeros = () => Array.from({ length: corners }, () => 0);
  return {
    grid: 0,
    chalk: 0,
    inked: 0,
    scratch: 0,
    icon: 0,
    box: 0,
    boxFade: 1,
    glow: 0,
    cornerFill: zeros(),
    cornerLabel: zeros(),
    cornerRemove: zeros(),
    terms: Array.from({ length: corners + 1 }, () => 0),
    core: 0,
    coreGlow: 0,
    pulseMs: 0,
    result: 0,
    display: 0,
    trigger: 0,
  };
}

/** Progress of a sub-animation that starts `start` ms into the beat and lasts `dur` ms. */
const window = (ms: number, start: number, dur: number) => clamp01((ms - start) / Math.max(1, dur));
/** Spring that settles at exactly 1 once its beat ends. */
const pop = (t: number, ms: number, start: number, cfg: SpringToken) => (t >= 1 ? 1 : springAt(ms - start, cfg));

type BeatReducer = (s: MotionState, t: number, ms: number, durationMs: number, ctx: MotionContext) => MotionState;

const SCRATCH_ON = 0.4;
const SCRATCH_DIM = 0.15;
const FADE_MS = 300;

const BEATS: Record<BeatName, BeatReducer> = {
  trap_state: (s, _t, ms, d, { ease }) => ({
    ...s,
    grid: ease(window(ms, 0, d * 0.4)),
    chalk: ease(window(ms, d * 0.2, d * 0.5)),
    scratch: SCRATCH_ON * ease(window(ms, d * 0.5, d * 0.5)),
  }),

  lens_activate: (s, t, ms, d, { ease, spring }) => ({
    ...s,
    scratch: SCRATCH_ON + (SCRATCH_DIM - SCRATCH_ON) * ease(window(ms, 0, d * 0.5)),
    icon: pop(t, ms, 0, spring),
    inked: ease(window(ms, 0, d)),
  }),

  laser_wipe: (s, _t, ms, d, { ease }) => {
    const box = ease(window(ms, 0, d));
    return { ...s, box, glow: clamp01((box - 0.85) / 0.15), scratch: SCRATCH_DIM * (1 - box) };
  },

  light_corners: (s, t, ms, _d, { ease, spring, tokens }) => {
    const { corner_fill: fill, corner_stagger: stagger } = tokens.motion.duration_ms;
    return {
      ...s,
      cornerFill: s.cornerFill.map((_, i) => ease(window(ms, i * stagger, fill))),
      cornerLabel: s.cornerLabel.map((_, i) => pop(t, ms, i * stagger + fill, spring)),
    };
  },

  collapse: (s, _t, ms, d, { corners, ease, tokens }) => {
    const remove = tokens.motion.duration_ms.corner_remove;
    const spacing = corners > 1 ? (d - remove) / corners : 0;
    // Corner i starts after the start value has appeared: term 0 at 0, corner i at (i + 1) × spacing.
    const startOf = (i: number) => (i + 1) * spacing;
    return {
      ...s,
      cornerRemove: s.cornerRemove.map((_, i) => ease(window(ms, startOf(i), remove))),
      terms: s.terms.map((_, i) => ease(window(ms, i === 0 ? 0 : startOf(i - 1), FADE_MS))),
      boxFade: 1 - ease(window(ms, startOf(corners - 1), remove)),
    };
  },

  core_isolated: (s, _t, ms, _d, { ease, tokens }) => {
    const reveal = ease(window(ms, 0, tokens.motion.duration_ms.core_reveal));
    return { ...s, core: reveal, coreGlow: reveal, pulseMs: ms };
  },

  answer: (s, t, ms, _d, { ease, spring, tokens }) => {
    const { hold_answer: hold, shade } = tokens.motion.duration_ms;
    return {
      ...s,
      pulseMs: s.pulseMs + ms,
      result: ease(window(ms, 0, FADE_MS)),
      display: pop(t, ms, FADE_MS, spring),
      trigger: ease(window(ms, FADE_MS + hold, shade)),
    };
  },
};

/** The motion state at beat index `k` and raw (un-eased) progress `t`. */
export function motionState(beats: Beat[], k: number, t: number, ctx: MotionContext): MotionState {
  let state = initialMotionState(ctx.corners);
  const last = Math.min(Math.max(0, k), beats.length - 1);
  for (let i = 0; i <= last; i++) {
    const beat = beats[i]!;
    const p = i === last ? clamp01(t) : 1;
    state = BEATS[beat.name](state, p, p * beat.durationMs, beat.durationMs, ctx);
  }
  return state;
}
