// @vitest-environment happy-dom
// WO-023 §3: each Stage 2/3 drag scene snaps at the card's answer and nowhere else. The scene is mounted in a
// DOM (happy-dom), the knob dragged with real pointer events (SVG units map 1:1 onto the screen here).
import { allSceneCards, answerNumber, answerText, areaPoints, areaSpan, diceCells, loadBundle, mirrorPoints, sumBar, triPoints, unfoldP, type BoxUnfoldFigure, type ConeUnfoldFigure, type ConstSumFigure, type DiceGridFigure, type LineMirrorFigure, type ParabolaAreaFigure, type ParabolaTriFigure, type TriangleCeviansFigure, type CoordEqualAreaFigure, type CoordQuadTriFigure, type LensCard, type Point } from '@lens/scenes';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stopSprings } from '../fx';
import { GuideProvider } from '../guide';
import { isPlayable } from '../lessons';
import { plane } from './coordkit';
import { ceviansLayout, coneLayout } from './HsShapeScenes';
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
  const drag = (x: number, y: number, index = 0) => {
    const knob = host.querySelectorAll('.knob')[index] ?? null;
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
  /** A stroke over the given SVG points on `target` (pointer down, moves, up). */
  const stroke = (target: Element, points: [number, number][]) => {
    const svg = target.closest('svg')!;
    const [x0, y0] = points[0]!;
    act(() => {
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: x0, clientY: y0 }));
    });
    for (const [x, y] of points.slice(1)) {
      act(() => {
        svg.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: x, clientY: y }));
      });
    }
    const [x1, y1] = points.at(-1)!;
    act(() => {
      svg.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: x1, clientY: y1 }));
    });
    wait(1500);
    return solved.mock.calls.length > 0;
  };
  const click = () => {
    act(() => {
      host.querySelector('svg')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    wait(1500);
    return solved.mock.calls.length > 0;
  };
  return { drag, stroke, click, solved: () => solved.mock.calls.length > 0 };
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

// ------------------------------------------------------------ WO-023 §2 ---

const hs = (type: string) => cards.filter((c) => c.problem.figure.type === type && isPlayable(c, c.lens)).map((c) => [c.id, c] as const);

describe('High School drag scenes snap at the answer and nowhere else', () => {
  it('every Stage 3 drag scene has cards to play', () => {
    for (const t of ['parabola_area', 'parabola_tri', 'line_mirror', 'param_family', 'cone_unfold', 'dice_grid', 'const_sum', 'triangle_cevians']) expect(hs(t).length, t).toBeGreaterThanOrEqual(5);
  });

  it.each(hs('parabola_area'))('囲む %s: the fences snap at α and β, and the region fills', (_id, card) => {
    const f = card.problem.figure as ParabolaAreaFigure;
    const [lo, hi] = areaSpan(f);
    const P = plane(areaPoints(f));
    const m = mount(card);
    expect(m.drag(P.X(lo), P.Y(0), 0)).toBe(false);
    expect(host.querySelectorAll('.knob')).toHaveLength(1);
    expect(m.drag(P.X(hi), P.Y(0), 0)).toBe(true);
    expect(host.textContent).toContain(answerText(card));
  });

  it.each(hs('parabola_area'))('囲む %s: a fence away from the crossings does not snap', (_id, card) => {
    const f = card.problem.figure as ParabolaAreaFigure;
    const [lo, hi] = areaSpan(f);
    const P = plane(areaPoints(f));
    const m = mount(card);
    m.drag(P.X(lo + (hi - lo) * 0.2), P.Y(0), 0);
    expect(host.querySelectorAll('.knob')).toHaveLength(2);
  });

  const triSetup = (card: LensCard) => {
    const f = card.problem.figure as ParabolaTriFigure;
    const T = triPoints(f, f.ask === 'equal_o' || f.ask === 'px' ? answerNumber(card) : undefined);
    const P = plane([T.A, T.B, T.P, [0, 0], T.mid]);
    const kx = T.mid[0];
    const chord = T.A[1] - T.slope * T.A[0];
    const target = f.ask === 'equal_o' ? 0 : T.mid[1] - T.slope * T.mid[0];
    return { P, x: P.X(kx), y: (c: number) => P.Y(T.slope * kx + c), chord, target };
  };

  it.each(hs('parabola_tri'))('等積変形 %s: the parallel snaps where it touches (or passes through O)', (_id, card) => {
    const s = triSetup(card);
    expect(mount(card).drag(s.x, s.y(s.target))).toBe(true);
  });

  it.each(hs('parabola_tri'))('等積変形 %s: not halfway', (_id, card) => {
    const s = triSetup(card);
    const m = mount(card);
    m.drag(s.x, s.y((s.chord + s.target) / 2));
    // Long enough for any snap spring to settle and call onSolved.
    wait(5000);
    expect(m.solved()).toBe(false);
  });

  it.each(hs('line_mirror'))('折り返す %s: B snaps at B′ across ℓ, then a tap draws A–B′', (_id, card) => {
    const f = card.problem.figure as LineMirrorFigure;
    const M = mirrorPoints(f);
    const P = plane([f.A, f.B, M.T, M.P]);
    const m = mount(card);
    expect(m.drag(P.X(M.T[0]), P.Y(M.T[1]))).toBe(false);
    expect(host.textContent).toContain('B′');
    expect(m.click()).toBe(true);
  });

  it.each(hs('line_mirror'))('折り返す %s: halfway across springs back', (_id, card) => {
    const f = card.problem.figure as LineMirrorFigure;
    const M = mirrorPoints(f);
    const P = plane([f.A, f.B, M.T, M.P]);
    const m = mount(card);
    m.drag(P.X((f.B[0] + M.T[0]) / 2), P.Y((f.B[1] + M.T[1]) / 2));
    expect(host.textContent).not.toContain('B′');
    expect(m.click()).toBe(false);
  });

  it.each(hs('param_family'))('止める %s: a tap freezes a; the fixed point is the answer', (_id, card) => {
    const m = mount(card);
    wait(2000);
    expect(m.solved()).toBe(false);
    const knob = host.querySelector('.knob')!;
    const [kx, ky] = (knob.getAttribute('transform') ?? '').match(/-?[\d.]+/g)!.map(Number);
    expect(m.drag(kx!, ky!)).toBe(true);
    expect(host.textContent).toContain(answerText(card));
  });

  it.each(hs('cone_unfold'))('展開 %s: the side opens fully, then A pulls straight to the far end', (_id, card) => {
    const L = coneLayout(card.problem.figure as ConeUnfoldFigure);
    const m = mount(card);
    const far = L.at(L.a1 - L.theta * 0.999);
    expect(m.drag(far[0], far[1])).toBe(false);
    // The second knob is A's string end.
    expect(m.drag(L.O[0], L.O[1])).toBe(false);
    expect(m.drag(L.target[0], L.target[1])).toBe(true);
    expect(host.textContent).toContain(answerText(card));
  });

  it.each(hs('cone_unfold'))('展開 %s: half open does not snap', (_id, card) => {
    const L = coneLayout(card.problem.figure as ConeUnfoldFigure);
    const m = mount(card);
    const half = L.at(L.a1 - L.theta * 0.5);
    m.drag(half[0], half[1]);
    expect(host.textContent).not.toMatch(/A′|B′/);
  });

  const cellCentre = ([b, s]: [number, number]): [number, number] => [160 + (b - 0.5) * 50, 70 + (s - 0.5) * 50];
  it.each(hs('dice_grid'))('面積図 %s: snaps when exactly the matching cells are painted', (_id, card) => {
    const cells = diceCells(card.problem.figure as DiceGridFigure);
    const m = mount(card);
    const paint = host.querySelector('[data-part="paint"]')!;
    // A cell that does not match is refused.
    const off = [1, 2, 3, 4, 5, 6].flatMap((b) => [1, 2, 3, 4, 5, 6].map((s) => [b, s] as [number, number])).find(([b, s]) => !cells.some((c) => c[0] === b && c[1] === s));
    if (off) {
      m.stroke(paint, [cellCentre(off)]);
      expect(host.querySelectorAll('[data-cell]')).toHaveLength(0);
    }
    // All but one: not yet.
    if (cells.length > 1) expect(m.stroke(paint, cells.slice(0, -1).map(cellCentre))).toBe(false);
    expect(m.stroke(paint, [cellCentre(cells.at(-1)!)])).toBe(true);
    expect(host.querySelectorAll('[data-cell]')).toHaveLength(cells.length);
  });

  it.each(hs('const_sum'))('差一定 %s: the split snaps at the centre only', (_id, card) => {
    const T = sumBar(card.problem.figure as ConstSumFigure).total;
    const X = (v: number) => 60 + (v * 480) / T;
    const m = mount(card);
    expect(m.drag(X(T * 0.35), 88)).toBe(false);
    expect(m.drag(X(T / 2), 88)).toBe(true);
    expect(host.textContent).toContain(answerText(card));
  });

  it.each(hs('triangle_cevians'))('てんびん %s: the fulcrum balances only where AD and BE cross', (_id, card) => {
    const L = ceviansLayout(card.problem.figure as TriangleCeviansFigure);
    const at = (k: number) => [L.L0[0] + (L.L1[0] - L.L0[0]) * k, L.L0[1] + (L.L1[1] - L.L0[1]) * k] as const;
    const m = mount(card);
    expect(m.drag(...at(L.target > 0.5 ? L.target - 0.15 : L.target + 0.15))).toBe(false);
    expect(m.drag(...at(L.target))).toBe(true);
    expect(host.textContent).toContain(answerText(card));
  });
});
