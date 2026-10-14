// @vitest-environment happy-dom
// WO-022 in a DOM (happy-dom, dev-only): for every lesson, masterclass example 1 shows the ghost finger
// within 3 s, and after idle_ms with no touch exactly one element pulses: the coached target.
import { loadBundle } from '@lens/scenes';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stopSprings, TACTILE } from './fx';
import { findPass } from './lessons';
import { masterCards, masterToken } from './masterclass';
import { MasterBeat } from './MasterView';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pass = findPass(loadBundle(), 'chugaku_juken')!;
const m = masterToken();
/** Everything that can pulse: a knob's halo, a tap target's halo, the ring over a non-SVG target, a nudged button. */
const PULSES = '.halo.pulse, .target-ring.pulse, .nudge';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
  // happy-dom lays nothing out and has no getScreenCTM: map SVG user units 1:1 onto the stage so the
  // finger has somewhere to go (the guide converts its points with getScreenCTM + DOMPoint).
  (SVGElement.prototype as unknown as { getScreenCTM: () => object }).getScreenCTM = () => ({});
  class Pt {
    constructor(
      public x = 0,
      public y = 0,
    ) {}
    matrixTransform() {
      return this;
    }
  }
  vi.stubGlobal('DOMPoint', Pt);
  // happy-dom rejects a cancelled animation's promise; the finger only needs play and cancel.
  (Element.prototype as unknown as { animate: () => object }).animate = () => ({ cancel() {}, finished: Promise.resolve() });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  // fx runs one shared frame loop: finish any springs and let a last frame run so it parks itself
  // before the fake clock goes away (otherwise the next lesson's frames never start).
  act(() => {
    stopSprings();
    vi.advanceTimersByTime(100);
  });
  delete (SVGElement.prototype as unknown as { getScreenCTM?: unknown }).getScreenCTM;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Lets exactly `ms` of fake time pass, a frame (16 ms) at a time, inside act. */
function wait(ms: number) {
  for (let t = 0; t < ms; t += 16) act(() => vi.advanceTimersByTime(Math.min(16, ms - t)));
}

describe.each(pass.lessons.map((l) => [l.lens, l] as const))('%s masterclass example 1', (lens, lesson) => {
  const cards = masterCards(lesson)!;
  const mount = () => act(() => root.render(<MasterBeat beat="example1" cards={cards} lens={lens} passId={pass.id} m={m} onNext={() => {}} scope={null} />));

  it('shows the ghost finger within 3 s', () => {
    mount();
    let at = -1;
    for (let t = 0; t < 3000 && at < 0; t += 50) {
      wait(50);
      if (host.querySelector('.finger')) at = t + 50;
    }
    expect(at, `${lens}: no finger before 3 s`).toBeGreaterThan(0);
    expect(at).toBeLessThan(3000);
  });

  it('after idle, pulses exactly one element: the coached target', () => {
    mount();
    expect(host.querySelectorAll(PULSES)).toHaveLength(0);
    // The coaching starts (止める after its walk preview), then idle_ms pass with no touch.
    wait(2500 + TACTILE.idleMs + 300);
    const on = [...host.querySelectorAll(PULSES)];
    expect(on, `${lens}: ${on.map((e) => e.getAttribute('class')).join(' | ')}`).toHaveLength(1);
    // A knob's halo, or 止める's tap target (弟), or the ring over a target that is not an SVG knob.
    expect(on[0]!.closest('.knob') ?? on[0]!.closest('.target-ring') ?? (on[0]!.classList.contains('target-ring') ? on[0] : null)).not.toBeNull();
    // The first touch stops it.
    act(() => {
      document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(host.querySelectorAll(PULSES)).toHaveLength(0);
  });
});
