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
