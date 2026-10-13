// Pure models for the word-problem drags (WO-015). The snap targets are the bundle's answer fields
// (w2, n, shift); the other diagram numbers only size shapes. Nothing here produces a printed number.
import type { WordDiagramSpec } from '@lens/scenes';

/** An answer field such as "15" as a number (snap targets only). */
const num = (s: string) => Number(s);

type Spec<F extends WordDiagramSpec['family']> = Extract<WordDiagramSpec, { family: F }>;

/** 平均 (area_average): lower the line to the overall average, then widen group 2 until the dent matches the excess. */
export function averageModel(d: Spec<'area_average'>) {
  const target = num(d.w2);
  return {
    target,
    /** Widest the child can drag (overshoot is allowed and shows red). */
    kMax: target + Math.max(3, Math.ceil(target * 0.4)),
    /** The dashed line snaps to the overall average when released close to it. */
    lineSnaps: (v: number) => Math.abs(v - d.level) <= (d.h1 - d.h2) * 0.15,
    /** How much of the excess the dent of k person-columns has taken (1 = the same area; drawing only). */
    drained: (k: number) => (k * (d.level - d.h2)) / (d.w1 * (d.h1 - d.level)),
    snaps: (k: number) => Math.round(k) === target,
  };
}

/** 過不足 (area_shortfall): raise plan A to plan B, then widen until the strip holds the leftover and the missing. */
export function shortfallModel(d: Spec<'area_shortfall'>) {
  const target = num(d.n);
  return {
    target,
    kMax: target + Math.max(3, Math.ceil(target * 0.5)),
    raiseSnaps: (h: number) => Math.abs(h - d.b) <= (d.b - d.a) * 0.3,
    /** Dots the strip holds at k columns, each column (b − a) tall (drawing only). */
    slots: (k: number) => k * (d.b - d.a),
    snaps: (k: number) => Math.round(k) === target,
  };
}

/** 差一定 (diff_bars): k steps forward (dir 1) or back (dir −1); both bars change together. */
export function barsModel(d: Spec<'diff_bars'>) {
  const target = num(d.shift) / d.step;
  const at = (k: number) => ({ big: d.big + d.dir * k * d.step, small: d.small + d.dir * k * d.step });
  return {
    target,
    /** Furthest the ● goes: back until the smaller bar is one step long, or forward with room to overshoot. */
    kMax: d.dir < 0 ? d.small / d.step - 1 : target + Math.max(4, Math.ceil(target * 0.6)),
    at,
    snaps: (k: number) => Math.round(k) === target,
  };
}

/**
 * てんびん (lever, WO-017): the lower % is drawn on the left. The unknown weight hangs at p2, which can
 * be 0% (water) or 100% (salt). It balances when weight × arm is equal on both sides (drawing only;
 * the snap target is the bundle answer).
 */
export function leverModel(d: Spec<'lever'>) {
  const target = num(d.w2);
  const step = target >= 50 && target % 10 === 0 ? 10 : target >= 25 && target % 5 === 0 ? 5 : 1;
  const armKnown = Math.abs(d.pt - d.p1);
  const armUnknown = Math.abs(d.p2 - d.pt);
  const unknownLeft = d.p2 < d.p1;
  const start = Math.max(step, Math.round((target * 0.35) / step) * step);
  // A broken axis when one arm is much longer (salt: 2 vs 90), so the short arm stays touchable.
  const ratio = Math.max(armKnown, armUnknown) / Math.max(1e-9, Math.min(armKnown, armUnknown));
  return {
    target,
    step,
    start: start === target ? target + step * 3 : start,
    unknownLeft,
    armKnown,
    armUnknown,
    broken: ratio > 4,
    /** > 0 when the unknown side is heavier. */
    torque: (w: number) => w * armUnknown - d.w1 * armKnown,
    /** A release within two steps of the answer snaps to it; anything else stays where it is. */
    snapTo: (w: number) => (Math.abs(w - target) <= 2 * step ? target : null),
  };
}

/** 止める (road): k minute-blocks of the closing speed; it meets (toward) or catches up (chase) at the gap. */
export function roadModel(d: Spec<'road'>, closing: number) {
  const target = num(d.t);
  return { target, chase: d.mode === 'chase', snaps: (k: number) => Math.round(k) === target, closed: (k: number) => k * closing >= d.d };
}
