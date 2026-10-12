// Study-pace beats as reducers over one state, like the keyframes: the frame at (beat k, t) is every
// earlier beat at t = 1, then beat k at t. Each beat turns t into elapsed ms of its own window, so
// springs, staggers and the glow pulse are pure functions of t.
import { clamp01, type Easing } from '../easing';
import { springAt } from '../spring';
import type { SpringToken, Tokens } from '../types';
import type { Beat } from './timeline';

/** Which calculation step is on screen: the box (step 0) or corner i. */
export type Focus = { kind: 'box' } | { kind: 'corner'; index: number };

export interface MotionState {
  grid: number;
  /** Figure drawn in chalk (trap ink), then crossfaded to ink by `inked`. */
  chalk: number;
  inked: number;
  /** Trap lines: how many have appeared (0–1 across them) and their opacity. */
  trapReveal: number;
  trapOpacity: number;
  /** Lens chip (icon + label) pop. */
  chip: number;
  box: number;
  boxFade: number;
  glow: number;
  focus: Focus | null;
  /** Progress of the focused step's parts: enter (title, piece), legs/brackets, formula card. */
  enter: number;
  legs: number;
  formula: number;
  /** 0–1 per corner: has had its step (stays tinted at low opacity afterwards). */
  done: number[];
  /** 0–1 per corner during subtract: lights up, then slides out and fades. */
  lit: number[];
  removed: number[];
  /** Per equation term (start value, then one per corner): joined, and lit up in subtract. */
  terms: number[];
  termLit: number[];
  /** Question text (hook), the time strip (trap), the lens buttons (freeze) and the end card. */
  question: number;
  timeStrip: number;
  buttons: number;
  freezeTitle: number;
  /** The correct lens button lighting up, and the buttons leaving. */
  pick: number;
  buttonsOut: number;
  endCard: number;
  /** The trap attempt drawn on the figure (e.g. the midpoint guess) and its dimming once the lens arrives. */
  trapDemo: number;
  trapDemoDim: number;
  /** Progress per figure keyframe played by figure_step beats (word-problem diagrams). */
  figureProg: Record<string, number>;
  /** Shortest path: Q′ reflected (Mirror) or face BCGF opened flat (Unfold), the straight line drawn, the similar triangles. */
  reflect: number;
  unfold: number;
  straight: number;
  similar: number;
  /** Parallel band: the ∥ highlight, how far each apex has slid, the merged outline, the focused triangle. */
  parallel: number;
  slid: number[];
  merged: number;
  bandFocus: number;
  /** A lens step shown as a caption in the title band (index into lens_route.steps), with its fade. */
  captionStep: number;
  caption: number;
  core: number;
  coreGlow: number;
  pulseMs: number;
  result: number;
  display: number;
  trigger: number;
}

export interface MotionContext {
  corners: number;
  /** Apexes on a parallel band (0 for other figures). */
  apexes: number;
  trapLines: number;
  tokens: Tokens;
  ease: Easing;
  spring: SpringToken;
}

export function initialMotionState(corners: number, apexes = 0): MotionState {
  const zeros = (n: number) => Array.from({ length: n }, () => 0);
  return {
    grid: 0,
    chalk: 0,
    inked: 0,
    trapReveal: 0,
    trapOpacity: 0,
    chip: 0,
    box: 0,
    boxFade: 1,
    glow: 0,
    focus: null,
    enter: 0,
    legs: 0,
    formula: 0,
    done: zeros(corners),
    lit: zeros(corners),
    removed: zeros(corners),
    terms: zeros(corners + 1),
    termLit: zeros(corners + 1),
    question: 0,
    timeStrip: 0,
    buttons: 0,
    freezeTitle: 0,
    pick: 0,
    buttonsOut: 0,
    endCard: 0,
    figureProg: {},
    trapDemo: 0,
    unfold: 0,
    trapDemoDim: 1,
    reflect: 0,
    straight: 0,
    similar: 0,
    parallel: 0,
    slid: zeros(apexes),
    merged: 0,
    bandFocus: -1,
    captionStep: -1,
    caption: 0,
    core: 0,
    coreGlow: 0,
    pulseMs: 0,
    result: 0,
    display: 0,
    trigger: 0,
  };
}

/** Progress of a part that starts `start` ms into the beat and lasts `dur` ms. */
const span = (ms: number, start: number, dur: number) => clamp01((ms - start) / Math.max(1, dur));
/** Spring that settles at exactly 1 once its beat ends. */
const pop = (t: number, ms: number, start: number, cfg: SpringToken) => (t >= 1 ? 1 : springAt(ms - start, cfg));
const set = (arr: number[], i: number, v: number) => arr.map((x, j) => (j === i ? v : x));

/** Readable trap text (≥ 70%), dimmed when the lens activates. */
const TRAP_READABLE = 0.85;
const TRAP_DIM = 0.15;
const FADE_MS = 300;

type BeatReducer = (s: MotionState, t: number, ms: number, beat: Beat, ctx: MotionContext) => MotionState;

const REDUCERS: Record<Beat['name'], BeatReducer> = {
  hook: (s, _t, ms, _beat, { ease }) => ({
    ...s,
    grid: ease(span(ms, 0, 600)),
    chalk: ease(span(ms, 0, 800)),
    question: ease(span(ms, 300, FADE_MS * 2)),
  }),

  trap: (s, _t, ms, beat, { ease }) => ({
    ...s,
    // After a hook the grid and figure are already in; never fade them back.
    grid: Math.max(s.grid, ease(span(ms, 0, 600))),
    chalk: Math.max(s.chalk, ease(span(ms, 0, 800))),
    trapReveal: span(ms, 800, beat.durationMs - 1200),
    trapOpacity: TRAP_READABLE,
    timeStrip: s.question > 0 ? ease(span(ms, 800, beat.durationMs - 1000)) : 0,
    trapDemo: ease(span(ms, 800, beat.durationMs - 1200)),
  }),

  freeze: (s, t, ms, _beat, { ease, spring }) => ({
    ...s,
    trapOpacity: TRAP_READABLE * (1 - ease(span(ms, 0, FADE_MS))),
    timeStrip: s.timeStrip * (1 - ease(span(ms, 0, FADE_MS))),
    question: s.question * (1 - ease(span(ms, 0, FADE_MS))),
    freezeTitle: ease(span(ms, FADE_MS, FADE_MS)),
    buttons: pop(t, ms, FADE_MS, spring),
  }),

  lens_activate: (s, t, ms, beat, { ease, spring }) => ({
    ...s,
    pick: s.buttons > 0 ? ease(span(ms, 0, FADE_MS)) : 0,
    trapDemoDim: 1 - 0.7 * ease(span(ms, 0, beat.durationMs * 0.6)),
    // Dims readable trap text; text the freeze already cleared stays cleared.
    trapOpacity: s.trapOpacity + (Math.min(s.trapOpacity, TRAP_DIM) - s.trapOpacity) * ease(span(ms, 0, 600)),
    chip: pop(t, ms, 300, spring),
    inked: ease(span(ms, 0, beat.durationMs * 0.6)),
  }),

  box_step: (s, _t, ms, beat, { ease, tokens }) => {
    const { laser_wipe: laser } = tokens.motion.duration_ms;
    const { legs_draw_ms: legs, formula_ms: formula, equation_term_ms: term } = tokens.motion.study;
    const box = ease(span(ms, 0, laser));
    return {
      ...s,
      trapOpacity: Math.min(s.trapOpacity, TRAP_DIM) * (1 - span(ms, 0, FADE_MS)),
      buttonsOut: ease(span(ms, 0, FADE_MS * 2)),
      freezeTitle: s.freezeTitle * (1 - ease(span(ms, 0, FADE_MS))),
      focus: { kind: 'box' },
      enter: ease(span(ms, 0, FADE_MS)),
      box,
      glow: clamp01((box - 0.85) / 0.15),
      legs: ease(span(ms, laser, legs)),
      formula: ease(span(ms, laser + legs, formula)),
      terms: set(s.terms, 0, ease(span(ms, beat.durationMs - term, term))),
    };
  },

  corner_step: (s, _t, ms, beat, { ease, tokens }) => {
    const i = beat.index ?? 0;
    const { step_focus_ms: focus, legs_draw_ms: legs, formula_ms: formula, equation_term_ms: term } = tokens.motion.study;
    return {
      ...s,
      focus: { kind: 'corner', index: i },
      enter: ease(span(ms, 0, focus)),
      legs: ease(span(ms, focus, legs)),
      formula: ease(span(ms, focus + legs, formula)),
      done: set(s.done, i, 1),
      terms: set(s.terms, i + 1, ease(span(ms, beat.durationMs - term, term))),
    };
  },

  subtract: (s, _t, ms, beat, { corners, ease, tokens }) => {
    const remove = tokens.motion.duration_ms.corner_remove;
    const lightUp = tokens.motion.study.equation_term_ms / 2;
    const spacing = corners > 0 ? (beat.durationMs - remove - lightUp) / corners : 0;
    const startOf = (i: number) => i * spacing;
    return {
      ...s,
      focus: null,
      lit: s.lit.map((_, i) => ease(span(ms, startOf(i), lightUp))),
      removed: s.removed.map((_, i) => ease(span(ms, startOf(i) + lightUp, remove))),
      termLit: s.termLit.map((_, i) => (i === 0 ? ease(span(ms, 0, lightUp)) : ease(span(ms, startOf(i - 1), lightUp)))),
      boxFade: 1 - ease(span(ms, startOf(corners - 1) + lightUp, remove)),
    };
  },

  mark_parallel: (s, _t, ms, beat, { ease }) => ({
    ...s,
    trapOpacity: Math.min(s.trapOpacity, TRAP_DIM) * (1 - span(ms, 0, FADE_MS)),
    buttonsOut: ease(span(ms, 0, FADE_MS * 2)),
    freezeTitle: s.freezeTitle * (1 - ease(span(ms, 0, FADE_MS))),
    // Pulse up, then settle at a visible highlight.
    parallel: ms < beat.durationMs / 2 ? ease(span(ms, 0, beat.durationMs / 2)) : 1 - 0.4 * ease(span(ms, beat.durationMs / 2, beat.durationMs / 2)),
  }),

  slide_apex: (s, _t, ms, beat, { ease, tokens }) => {
    const i = beat.index ?? 0;
    const focus = tokens.motion.study.step_focus_ms;
    return {
      ...s,
      bandFocus: i,
      slid: set(s.slid, i, ease(span(ms, focus / 2, beat.durationMs - focus / 2))),
      captionStep: 0,
      caption: Math.max(s.captionStep === 0 ? s.caption : 0, ease(span(ms, 0, FADE_MS))),
    };
  },

  merge_triangle: (s, _t, ms, _beat, { ease }) => ({
    ...s,
    bandFocus: -1,
    merged: ease(span(ms, 0, FADE_MS * 2)),
    captionStep: 1,
    caption: ease(span(ms, 0, FADE_MS)),
  }),

  reflect_point: (s, _t, ms, _beat, { ease }) => ({
    ...s,
    trapOpacity: Math.min(s.trapOpacity, TRAP_DIM) * (1 - span(ms, 0, FADE_MS)),
    buttonsOut: ease(span(ms, 0, FADE_MS * 2)),
    freezeTitle: s.freezeTitle * (1 - ease(span(ms, 0, FADE_MS))),
    reflect: ease(span(ms, 0, FADE_MS * 3)),
    captionStep: 0,
    caption: ease(span(ms, 0, FADE_MS)),
  }),

  unfold_faces: (s, _t, ms, beat, { ease, tokens }) => ({
    ...s,
    trapOpacity: Math.min(s.trapOpacity, TRAP_DIM) * (1 - span(ms, 0, FADE_MS)),
    buttonsOut: ease(span(ms, 0, FADE_MS * 2)),
    freezeTitle: s.freezeTitle * (1 - ease(span(ms, 0, FADE_MS))),
    unfold: ease(span(ms, 0, beat.durationMs - tokens.motion.study.step_hold_ms)),
    captionStep: 0,
    caption: ease(span(ms, 0, FADE_MS)),
  }),

  draw_straight: (s, _t, ms, beat, { ease, tokens }) => ({
    ...s,
    straight: ease(span(ms, 0, beat.durationMs - tokens.motion.study.step_hold_ms)),
    captionStep: 1,
    caption: ease(span(ms, 0, FADE_MS)),
  }),

  mark_similar: (s, _t, ms, _beat, { ease }) => ({
    ...s,
    similar: ease(span(ms, 0, FADE_MS * 3)),
    captionStep: 2,
    caption: ease(span(ms, 0, FADE_MS)),
  }),

  figure_step: (s, _t, ms, beat, { ease, tokens }) => {
    const draw = ease(span(ms, 0, beat.durationMs - tokens.motion.study.step_hold_ms));
    return {
      ...s,
      trapOpacity: Math.min(s.trapOpacity, TRAP_DIM) * (1 - span(ms, 0, FADE_MS)),
      buttonsOut: Math.max(s.buttonsOut, ease(span(ms, 0, FADE_MS * 2))),
      freezeTitle: s.freezeTitle * (1 - ease(span(ms, 0, FADE_MS))),
      figureProg: beat.key ? { ...s.figureProg, [beat.key]: draw } : s.figureProg,
      captionStep: beat.caption ?? s.captionStep,
      caption: beat.caption === undefined ? s.caption : beat.caption === s.captionStep && s.caption > 0 ? 1 : ease(span(ms, 0, FADE_MS)),
    };
  },

  answer: (s, t, ms, _beat, { ease, spring, tokens }) => {
    const reveal = ease(span(ms, 0, tokens.motion.duration_ms.core_reveal));
    return {
      ...s,
      core: reveal,
      coreGlow: reveal,
      pulseMs: ms,
      caption: s.caption * (1 - ease(span(ms, 0, FADE_MS))),
      result: ease(span(ms, 200, FADE_MS)),
      display: pop(t, ms, 500, spring),
      trigger: ease(span(ms, 500, tokens.motion.duration_ms.shade)),
    };
  },

  end_card: (s, _t, ms, _beat, { ease }) => ({ ...s, endCard: ease(span(ms, 0, FADE_MS * 2)) }),
};

/** The motion state at beat index `k` and raw (un-eased) progress `t`. */
export function motionState(beats: Beat[], k: number, t: number, ctx: MotionContext): MotionState {
  let state = initialMotionState(ctx.corners, ctx.apexes);
  const last = Math.min(Math.max(0, k), beats.length - 1);
  for (let i = 0; i <= last; i++) {
    const beat = beats[i]!;
    const p = i === last ? clamp01(t) : 1;
    // A new step replaces the previous step's marks.
    if (beat.name === 'corner_step' || beat.name === 'subtract') state = { ...state, enter: 0, legs: 0, formula: 0 };
    state = REDUCERS[beat.name](state, p, p * beat.durationMs, beat, ctx);
  }
  return state;
}
