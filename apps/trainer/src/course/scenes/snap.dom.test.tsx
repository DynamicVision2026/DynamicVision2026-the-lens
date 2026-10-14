// @vitest-environment happy-dom
// WO-023 §3: each Stage 2/3 drag scene snaps at the card's answer and nowhere else. The scene is mounted in a
// DOM (happy-dom), the knob dragged with real pointer events (SVG units map 1:1 onto the screen here).
import { allSceneCards, answerNumber, answerText, loadBundle, unfoldP, type BoxUnfoldFigure, type CoordEqualAreaFigure, type CoordQuadTriFigure, type LensCard, type Point } from '@lens/scenes';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stopSprings } from '../fx';
import { GuideProvider } from '../guide';
import { isPlayable } from '../lessons';
import { plane } from './coordkit';
import { SCENES } from './index';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const cards = allSceneCards(loadBundle());
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
  // happy-dom lays nothing out: SVG user units are screen pixels (identity CTM).
  const identity = { inverse: () => identity };
  (SVGElement.prototype as unknown as { getScreenCTM: () => object }).getScreenCTM = () => identity;
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
  (Element.prototype as unknown as { animate: () => object }).animate = () => ({ cancel() {}, finished: Promise.resolve() });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  act(() => {
    stopSprings();
    vi.advanceTimersByTime(100);
  });
  delete (SVGElement.prototype as unknown as { getScreenCTM?: unknown }).getScreenCTM;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function wait(ms: number) {
  for (let t = 0; t < ms; t += 16) act(() => vi.advanceTimersByTime(Math.min(16, ms - t)));
}

/** Mounts the card's lens scene; returns a drag of the knob to (x, y) and whether it solved. */
function mount(card: LensCard) {
  const Scene = SCENES[card.lens]!;
  const solved = vi.fn();
  const stage = { current: host };
  act(() =>
    root.render(
      <GuideProvider lens={card.lens} stageRef={stage}>
        <Scene card={card} lens={card.lens} onSolved={solved} />
      </GuideProvider>,
    ),
  );
  const drag = (x: number, y: number) => {
    const knob = host.querySelector('.knob');
    expect(knob, `${card.id}: no knob`).not.toBeNull();
    const svg = knob!.closest('svg')!;
    const [kx, ky] = (knob!.getAttribute('transform') ?? '').match(/-?[\d.]+/g)!.map(Number);
    act(() => {
      knob!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: kx, clientY: ky }));
    });
    for (let i = 1; i <= 8; i++) {
      act(() => {
        svg.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: kx! + ((x - kx!) * i) / 8, clientY: ky! + ((y - ky!) * i) / 8 }));
      });
    }
    act(() => {
      svg.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: x, clientY: y }));
    });
    wait(1500);
    return solved.mock.calls.length > 0;
  };
  return { drag };
}

/** Where the knob must go, in SVG units, for the 等積変形 scenes on the plane (positions as the scene draws them). */
function slideTarget(card: LensCard): { at: (p: Point) => [number, number]; to: Point; from: Point } {
  const fig = card.problem.figure as CoordEqualAreaFigure | CoordQuadTriFigure;
  const ans = answerNumber(card);
  const to: Point = fig.type === 'coord_quad_tri' ? [ans, 0] : [0, ans];
  const given = fig.type === 'coord_quad_tri' ? [fig.A, fig.B, fig.C, fig.D] : [fig.A, fig.B, fig.C];
  const P = plane([...given, to]);
  return { at: (p) => [P.X(p[0]), P.Y(p[1])], to, from: fig.C };
}

const slideCards = cards.filter((c) => c.kind === 'standard' && ['coord_equal_area', 'coord_quad_tri'].includes(c.problem.figure.type) && isPlayable(c, c.lens));

describe('等積変形 on the plane (coord_equal_area, coord_quad_tri)', () => {
  it('has the WO-023 quadrilateral card and its variants', () => {
    expect(slideCards.filter((c) => c.problem.figure.type === 'coord_quad_tri').length).toBeGreaterThanOrEqual(5);
  });

  it.each(slideCards.map((c) => [c.id, c] as const))('%s snaps on the axis at the answer', (_id, card) => {
    const { at, to } = slideTarget(card);
    const [x, y] = at(to);
    expect(mount(card).drag(x, y)).toBe(true);
  });

  it.each(slideCards.map((c) => [c.id, c] as const))('%s does not snap halfway along the line', (_id, card) => {
    const { at, to, from } = slideTarget(card);
    const [x, y] = at([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]);
    expect(mount(card).drag(x, y)).toBe(false);
  });
});

// 展開 with `ask: length` (WO-023): P slides on BF (the flat net, no WebGL here) and snaps where A→G is
// straight; the answer is the string's length, printed when it snaps.
const lengthCards = cards.filter((c) => c.problem.figure.type === 'box_unfold' && (c.problem.figure as BoxUnfoldFigure).ask === 'length' && isPlayable(c, c.lens));

describe('展開: the string length (box_unfold, ask: length)', () => {
  it('has kj-unfold-005 and its variants', () => {
    expect(lengthCards.map((c) => c.id)).toContain('kj-unfold-005');
    expect(lengthCards.length).toBeGreaterThanOrEqual(5);
  });

  /** P on BF in the flat net's SVG units, as FlatUnfold draws it. */
  const netY = (card: LensCard, bp: number) => {
    const f = card.problem.figure as BoxUnfoldFigure;
    const s = Math.min(480 / (f.a + f.b), 300 / f.h);
    return [(600 - (f.a + f.b) * s) / 2 + f.a * s, 360 - bp * s] as const;
  };

  it.each(lengthCards.map((c) => [c.id, c] as const))('%s snaps where A→G is straight, and prints AG', (_id, card) => {
    const m = mount(card);
    expect(m.drag(...netY(card, unfoldP(card)))).toBe(true);
    const L = (card.problem.figure as BoxUnfoldFigure).point_labels;
    expect(host.textContent).toContain(`${L.A}${L.G}=${answerText(card)}`);
  });

  it.each(lengthCards.map((c) => [c.id, c] as const))('%s does not snap at the top of BF', (_id, card) => {
    expect(mount(card).drag(...netY(card, (card.problem.figure as BoxUnfoldFigure).h * 0.97))).toBe(false);
  });
});
