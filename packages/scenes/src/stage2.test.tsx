// WO-020: the Stage 2 coordinate figures and the Stage 3 mass-point triangle, and stageSteps (ADR-003).
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadBundle } from './bundle';
import { stageSteps } from './chain';
import { coordFrame, coordText } from './coord';
import { LensScene } from './LensScene';
import { weightsIn } from './primitives';
import type { CoordEqualAreaFigure, CoordMirrorAreaFigure, CoordPolygonFigure, LensCard, TriangleCeviansFigure } from './types';
import { allSceneCards, hasScene, STAGE3_TYPES } from './variant';

// WO-023 adds the Middle School modes and the Stage 3 graph and shape figures.
const TYPES = ['coord_polygon', 'coord_equal_area', 'coord_mirror_area', 'triangle_cevians', 'coord_y_split', 'coord_quad_tri', ...STAGE3_TYPES];
const cards = allSceneCards(loadBundle()).filter((c) => TYPES.includes(c.problem.figure.type));
const of = (type: string) => cards.filter((c) => c.problem.figure.type === type).map((c) => [c.id, c] as const);
const words = (html: string) => [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1]!.trim().replace(/&#x27;/g, "'"));
const last = (c: LensCard) => c.animation!.keyframes.length - 1;

afterEach(() => vi.restoreAllMocks());

describe.skipIf(cards.length === 0)('WO-020 figures', () => {
  it('covers every Stage 2/3 figure type', () => {
    for (const t of TYPES) expect(of(t).length, t).toBeGreaterThan(1);
    for (const [, c] of cards.map((c) => [c.id, c] as const)) expect(hasScene(c)).toBe(true);
  });

  it.each(cards.map((c) => [c.id, c] as const))('%s renders every keyframe at t = 0, 0.5 and 1, both themes, purely and without warnings', (_id, card) => {
    const warn = vi.spyOn(console, 'warn');
    for (let k = 0; k <= last(card); k++) {
      for (const t of [0, 0.5, 1]) {
        for (const theme of ['base', 'short_dark'] as const) {
          const a = renderToStaticMarkup(<LensScene card={card} keyframe={k} t={t} theme={theme} />);
          expect(renderToStaticMarkup(<LensScene card={card} keyframe={k} t={t} theme={theme} />)).toBe(a);
        }
      }
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(of('coord_polygon'))('%s labels every vertex with its given coordinates on axes through the origin', (_id, card) => {
    const f = card.problem.figure as CoordPolygonFigure;
    const html = renderToStaticMarkup(<LensScene card={card} keyframe={0} t={1} />);
    f.points.forEach((p, i) => expect(words(html)).toContain(`${'ABCD'[i]}${coordText(p)}`));
    expect(words(html)).toEqual(expect.arrayContaining(['x', 'y', 'O']));
    // The grid holds the origin.
    const cf = coordFrame(f.points, 0, 0, 100, 100);
    const [ox, oy] = cf.g([0, 0]);
    expect(ox).toBeGreaterThan(0);
    expect(oy).toBeGreaterThan(0);
  });

  it.each(of('coord_equal_area'))('%s puts P on the y-axis at the answer only once it is shown', (_id, card) => {
    const f = card.problem.figure as CoordEqualAreaFigure;
    const end = words(renderToStaticMarkup(<LensScene card={card} keyframe={last(card)} t={1} />));
    expect(end.some((w) => w.startsWith('P(0, '))).toBe(true);
    const before = words(renderToStaticMarkup(<LensScene card={card} keyframe={card.animation!.keyframes.indexOf('slide_vertex')} t={1} />));
    expect(before.some((w) => w.startsWith('P(0, '))).toBe(false);
    for (const [n, p] of [['A', f.A], ['B', f.B], ['C', f.C]] as const) expect(end).toContain(`${n}${coordText(p)}`);
  });

  // ask: max_diff (kj-mirror-f01) has its own drawing and test below: line AB extended to the axis, no B'.
  it.each(of('coord_mirror_area').filter(([, c]) => (c.problem.figure as { ask?: string }).ask !== 'max_diff'))('%s prints P with a coordinate only when the answer is its x', (_id, card) => {
    const f = card.problem.figure as CoordMirrorAreaFigure;
    const end = words(renderToStaticMarkup(<LensScene card={card} keyframe={last(card)} t={1} />));
    const withCoord = end.filter((w) => /^P\(/.test(w));
    if (f.ask === 'p_x') expect(withCoord).toHaveLength(1);
    else expect(withCoord).toHaveLength(0);
    if (f.side !== 'opposite') expect(words(renderToStaticMarkup(<LensScene card={card} keyframe={card.animation!.keyframes.indexOf('reflect_b')} t={1} />))).toContain("B'");
  });

  it.each(of('triangle_cevians'))('%s prints the given ratios, and weights only from the figure or the steps', (_id, card) => {
    const f = card.problem.figure as TriangleCeviansFigure;
    const allowed = new Set([f.bd, f.dc, f.ce, f.ea].map(String));
    // The caption band can wrap a step's number across lines, so its single digits are allowed too.
    for (const s of card.lens_route.steps) for (const n of [...(s.ja.match(/\d+/g) ?? []), ...(s.ja.match(/\d/g) ?? [])]) allowed.add(n);
    for (const n of card.answer.value.match(/\d+/g) ?? []) allowed.add(n);
    for (let k = 0; k <= last(card); k++) {
      const html = renderToStaticMarkup(<LensScene card={card} keyframe={k} t={1} />);
      // Numbers in the figure (the caption band repeats the steps, which are allowed anyway).
      for (const n of words(html).flatMap((w) => w.match(/\d+/g) ?? [])) expect(allowed, `${card.id} kf ${k} prints ${n}`).toContain(n);
    }
  });

  it.each(of('triangle_cevians'))('%s states its answer like its anchor (a ratio or a multiple)', (_id, card) => {
    const f = card.problem.figure as TriangleCeviansFigure;
    const end = words(renderToStaticMarkup(<LensScene card={card} keyframe={last(card)} t={1} />)).join(' ');
    if (f.ask === 'area_pbc' || f.ask === 'area_abd') expect(end).toMatch(/倍/);
    else expect(end).toMatch(f.ask === 'bp_pe' ? /BP:PE＝\d+:\d+/ : /AP:PD＝\d+:\d+/);
  });

  it.each(of('coord_mirror_area').filter(([, c]) => (c.problem.figure as CoordMirrorAreaFigure).ask === 'max_diff'))('%s (max_diff): line AB extended to P, no reflection', (_id, card) => {
    const kfs = card.animation!.keyframes;
    const end = renderToStaticMarkup(<LensScene card={card} keyframe={kfs.length - 1} t={1} />);
    expect(words(end)).not.toContain("B'");
    expect(words(end).some((w) => w.startsWith('P('))).toBe(true);
  });

  it.each(cards.filter((c) => c.problem.figure.type.startsWith('coord_')).map((c) => [c.id, c] as const))('%s keeps every vertex label inside the figure', (_id, card) => {
    const html = renderToStaticMarkup(<LensScene card={card} keyframe={0} t={1} />);
    for (const m of html.matchAll(/<text x="([\d.-]+)"[^>]*>([A-Z]\([^<]+\))<\/text>/g)) {
      const half = m[2]!.length * 4;
      expect(Number(m[1]) - half, `${card.id} ${m[2]}`).toBeGreaterThan(0);
      expect(Number(m[1]) + half, `${card.id} ${m[2]}`).toBeLessThan(480);
    }
  });

  it('reads the one-scale weights as the step writes them', () => {
    expect(weightsIn({ ja: 'Cのおもりをそろえると A:B:C＝6:20:15' })).toEqual({ A: '6', B: '20', C: '15' });
    expect(weightsIn({ ja: '辺BCのてんびん' })).toBeNull();
  });
});

describe('stageSteps (ADR-003)', () => {
  const chained = cards.filter((c) => c.chain?.length);
  it.skipIf(chained.length === 0).each(chained.map((c) => [c.id, c] as const))('%s: the stages split the route without gaps or overlaps', (_id, card) => {
    const all = card.chain!.flatMap((_, k) => stageSteps(card, k));
    expect(all).toEqual(card.lens_route.steps);
    expect(stageSteps(card, null)).toEqual(card.lens_route.steps);
  });
  it('a card without a chain keeps its whole route', () => {
    const c = loadBundle().cards[0]!;
    expect(stageSteps(c, 0)).toEqual(c.lens_route.steps);
  });
});
