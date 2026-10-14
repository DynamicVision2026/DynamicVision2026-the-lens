import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCard, loadBundle } from './bundle';
import { LensScene } from './LensScene';
import { motionPreviewTimeline, shortTimeline } from './motion/timeline';
import { planeLayout } from './corner';
import { NetThreeFigure, UnfoldFigure } from './primitives';
import { tokens } from './tokens';
import type { BoxUnfoldFigure, LensCard } from './types';
import { unfoldLayout } from './unfold';
import { allSceneCards } from './variant';

// unfold-001 is a draft until WO-008 merges: CI runs these tests on a drafts-included bundle.
const unfold = getCard('unfold-001');
// The surface path over two faces; WO-018's edges-only and three-face cards have their own block below.
const unfoldCards = allSceneCards(loadBundle()).filter((c) => c.problem.figure.type === 'box_unfold' && (c.problem.figure as { path?: string }).path !== 'edges' && (c.problem.figure as { route?: string }).route !== 'three_faces');
const fig = (c: LensCard) => c.problem.figure as BoxUnfoldFigure;
const last = (c: LensCard) => c.animation!.keyframes.length - 1;
const dataY = (html: string, part: string) => Number(new RegExp(`data-part="${part}" data-y="([\\d.]+)"`).exec(html)?.[1]);
const textNodes = (html: string) => [...html.matchAll(/>([^<]+)</g)].map((m) => m[1]!).join(' ');

afterEach(() => vi.restoreAllMocks());

describe.skipIf(!unfold)('unfold-001 (box net)', () => {
  it('has the card and its 4 variants, with answers 3, 8, 6, 5 and 11', () => {
    expect(unfoldCards.filter((c) => c.id.startsWith('unfold-001')).map((c) => c.id)).toEqual(['unfold-001', 'unfold-001-v1', 'unfold-001-v2', 'unfold-001-v3', 'unfold-001-v4']);
    expect(unfoldCards.filter((c) => c.id.startsWith('unfold-001')).map((c) => c.answer.value)).toEqual(['3', '8', '6', '5', '11']);
  });

  it.each(unfoldCards.map((c) => [c.id, c] as const))('%s draws P at the answer height on BF, apart from the midpoint guess', (_id, card) => {
    const f = fig(card);
    const layout = unfoldLayout(f, 0, 0, 1000, 1000, 0, 0);
    const html = renderToStaticMarkup(
      <svg>
        <UnfoldFigure fig={f} layout={layout} crossY={Number(card.answer.value)} answerText="" tokens={tokens} ink="ink" chalk="chalk" accent="lens" palette={['p0', 'p1']} font="f" weight={400} labelSize={16} figureStroke={1} lensStroke={2} dash="3 2" bracket={{ offset: 20, tick: 5, numberSize: 16, strokeWidth: 1 }} show={1} tryPath={1} tryDim={1} unfold={1} straight={1} similar={1} answer={1} tint={0.2} idPrefix="t" />
      </svg>,
    );
    const [px, py] = layout.at(f.a, Number(card.answer.value));
    expect(html).toContain(`<circle cx="${px}" cy="${py}"`);
    expect(dataY(html, 'cross')).toBeCloseTo(py);
    // The midpoint guess is a different point from P.
    expect(f.h / 2).not.toBe(Number(card.answer.value));
  });

  it.each(unfoldCards.map((c) => [c.id, c] as const))('%s: the midpoint "?" is visibly not where the straight line crosses BF', (_id, card) => {
    const k = card.animation!.keyframes.indexOf('draw_straight');
    const html = renderToStaticMarkup(<LensScene card={card} keyframe={k} t={1} />);
    expect(Math.abs(dataY(html, 'midpoint') - dataY(html, 'cross'))).toBeGreaterThan(10);
  });

  it.each(unfoldCards.map((c) => [c.id, c] as const))('%s renders every keyframe at t = 0, 0.5 and 1, both themes, purely and without warnings', (_id, card) => {
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

  it('prints the given lengths and net_width, and no number outside the figure, the steps or the answer', () => {
    for (const card of unfoldCards) {
      const f = fig(card);
      const allowed = new Set([String(f.a), String(f.b), String(f.h), f.net_width, ...card.lens_route.steps.flatMap((s) => s.ja.match(/\d+/g) ?? []), card.answer.value]);
      for (let k = 0; k <= last(card); k++) {
        const html = textNodes(renderToStaticMarkup(<LensScene card={card} keyframe={k} t={1} />));
        for (const n of html.match(/\d+/g) ?? []) expect(allowed, `${card.id} keyframe ${k} prints ${n}`).toContain(n);
      }
      const html = renderToStaticMarkup(<LensScene card={card} keyframe={card.animation!.keyframes.indexOf('unfold_faces')} t={1} />);
      for (const v of [f.a, f.b, f.h, f.net_width]) expect(html).toContain(`>${v}${f.unit}<`);
    }
  });

  it('runs the study-pace beat engine on the Mirror straight-line and similar-triangle beats', () => {
    for (const card of unfoldCards) {
      const beats = motionPreviewTimeline(card, tokens)!;
      expect(beats.map((b) => b.name)).toEqual(['trap', 'lens_activate', 'unfold_faces', 'draw_straight', 'mark_similar', 'answer']);
      for (let k = 0; k < beats.length; k++) {
        for (const theme of ['base', 'short_dark'] as const) {
          const html = renderToStaticMarkup(<LensScene card={card} keyframe={k} t={0.5} motion={beats} theme={theme} />);
          expect(renderToStaticMarkup(<LensScene card={card} keyframe={k} t={0.5} motion={beats} theme={theme} />)).toBe(html);
        }
      }
      const end = renderToStaticMarkup(<LensScene card={card} keyframe={beats.length - 1} t={1} motion={beats} theme="short_dark" />);
      expect(end).toContain(card.answer.display_ja ?? `${card.answer.value}${card.problem.unit}`);
      expect(shortTimeline(card, tokens)).not.toBeNull();
    }
  });

  it('shows each variant with its own sentence', () => {
    for (const v of unfoldCards.filter((c) => c.id.startsWith('unfold-001-v'))) expect(v.problem.text_ja).not.toBe(unfold!.problem.text_ja);
    const v1 = unfoldCards.find((c) => c.id === 'unfold-001-v1')!;
    expect(textNodes(renderToStaticMarkup(<LensScene card={v1} keyframe={0} t={1} />))).toContain(`${v1.problem.figure.type === 'box_unfold' ? v1.problem.figure.a : ''}cm`);
  });
});

// WO-018: unfold-no-lens (edges only, nothing opens) and unfold-004 (three faces, Q on CG).
const all = allSceneCards(loadBundle());
const edges = all.filter((c) => c.problem.figure.type === 'box_unfold' && fig(c).path === 'edges');
const three = all.filter((c) => c.problem.figure.type === 'box_unfold' && fig(c).route === 'three_faces');

describe.skipIf(edges.length + three.length === 0)('WO-018 展開 figures', () => {
  it.each([...edges, ...three].map((c) => [c.id, c] as const))('%s renders every keyframe at t = 0, 0.5 and 1, both themes, purely and without warnings', (_id, card) => {
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

  it.each(edges.map((c) => [c.id, c] as const))('%s: nothing opens and no net width is shown; the edges A→B→C→G light up', (_id, card) => {
    const f = fig(card);
    const html = renderToStaticMarkup(<LensScene card={card} keyframe={card.animation!.keyframes.indexOf('draw_straight')} t={1} />);
    if (![f.a, f.b, f.h].map(String).includes(f.net_width)) expect(textNodes(html)).not.toContain(`${f.net_width}${f.unit}`);
    for (const v of [f.a, f.b, f.h]) expect(textNodes(html)).toContain(`${v}${f.unit}`);
    expect([...html.matchAll(/<polyline points="([^"]+)"/g)].some((m) => m[1]!.split(' ').length === 4)).toBe(true);
  });

  it.each(three.map((c) => [c.id, c] as const))('%s: three faces open; Q sits at the answer on CG; the given lengths are printed', (_id, card) => {
    const f = fig(card);
    const layout = planeLayout(0, 2 * f.a + f.b, 0, f.h, 0, 0, 1000, 1000, 0);
    const html = renderToStaticMarkup(
      <svg>
        <NetThreeFigure fig={f} layout={layout} crossY={Number(card.answer.value)} answerText="ans" tokens={tokens} ink="ink" chalk="chalk" accent="lens" palette={['p0', 'p1']} font="f" weight={400} labelSize={16} figureStroke={1} lensStroke={2} dash="3 2" bracket={{ offset: 20, tick: 5, numberSize: 16, strokeWidth: 1 }} tint={0.2} show={1} tryPath={1} tryDim={1} unfold={1} straight={1} similar={1} answer={1} />
      </svg>,
    );
    const [qx, qy] = layout.at(f.a + f.b, Number(card.answer.value));
    expect(html).toContain(`<circle cx="${qx}" cy="${qy}"`);
    for (const v of [f.a, f.b, f.h, f.net_width]) expect(textNodes(html)).toContain(`${v}${f.unit}`);
    for (const l of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'P', 'Q']) expect(textNodes(html)).toContain(l);
  });
});
