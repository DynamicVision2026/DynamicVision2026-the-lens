import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCard, loadBundle } from './bundle';
import { LensScene } from './LensScene';
import { mirrorLayout, touchX } from './mirror';
import { motionPreviewTimeline } from './motion/timeline';
import { bridgeLayout, cornerLayout } from './corner';
import { BridgeFigure, CornerFigure, MirrorFigure } from './primitives';
import { tokens } from './tokens';
import type { LensCard, MirrorCornerFigure, MirrorPathFigure, RiverBridgeFigure } from './types';
import { allSceneCards } from './variant';

// mirror-001 is a draft until WO-005 merges: CI runs these tests on a drafts-included bundle.
const mirror = getCard('mirror-001');
// The reflection figure; WO-018's opposite side, mirror_corner and river_bridge have their own block below.
const mirrorCards = allSceneCards(loadBundle()).filter((c) => c.problem.figure.type === 'mirror_path' && (c.problem.figure as { side?: string }).side !== 'opposite');
const fig = (c: LensCard) => c.problem.figure as MirrorPathFigure;

afterEach(() => vi.restoreAllMocks());

describe.skipIf(!mirror)('mirror-001 (shortest path)', () => {
  it('has the card and its 4 variants, with answers 4, 12, 3, 6 and 8', () => {
    expect(mirrorCards.filter((c) => c.id.startsWith('mirror-001')).map((c) => c.id)).toEqual(['mirror-001', 'mirror-001-v1', 'mirror-001-v2', 'mirror-001-v3', 'mirror-001-v4']);
    expect(mirrorCards.filter((c) => c.id.startsWith('mirror-001')).map((c) => c.answer.value)).toEqual(['4', '12', '3', '6', '8']);
  });

  it.each(mirrorCards.map((c) => [c.id, c] as const))('%s draws X at the answer on AB, apart from the midpoint guess', (_id, card) => {
    const f = fig(card);
    const layout = mirrorLayout(f, 0, 0, 1000, 1000, 0);
    const html = renderToStaticMarkup(
      <svg>
        <MirrorFigure fig={f} layout={layout} touchX={touchX(card)} tokens={tokens} ink="ink" chalk="chalk" accent="lens" palette={['p0', 'p1']} font="f" weight={400} labelSize={16} figureStroke={1} lensStroke={2} dash="3 2" bracket={{ offset: 20, tick: 5, numberSize: 16, strokeWidth: 1 }} show={1} tryPath={1} tryDim={1} reflect={1} straight={1} similar={1} tint={0.2} idPrefix="t" />
      </svg>,
    );
    const [xx, xy] = layout.at(Number(card.answer.value), 0);
    expect(html).toContain(`<circle cx="${xx}" cy="${xy}"`);
    // The midpoint guess is a different point from X.
    expect(f.ab / 2).not.toBe(Number(card.answer.value));
    expect(layout.at(f.ab / 2, 0)[0]).not.toBe(xx);
  });

  it.each(mirrorCards.map((c) => [c.id, c] as const))('%s renders every keyframe at t = 0 and 1, both themes, purely and without warnings', (_id, card) => {
    const warn = vi.spyOn(console, 'warn');
    const keyframes = card.animation!.keyframes;
    for (let k = 0; k < keyframes.length; k++) {
      for (const t of [0, 1]) {
        for (const theme of ['base', 'short_dark'] as const) {
          const a = renderToStaticMarkup(<LensScene card={card} keyframe={k} t={t} theme={theme} />);
          expect(renderToStaticMarkup(<LensScene card={card} keyframe={k} t={t} theme={theme} />)).toBe(a);
        }
      }
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('prints only the given lengths (PA, QB, AB) as lengths', () => {
    for (const card of mirrorCards) {
      const f = fig(card);
      const html = renderToStaticMarkup(<LensScene card={card} keyframe={card.animation!.keyframes.length - 1} t={1} />);
      for (const v of [f.pa, f.qb, f.ab]) expect(html).toContain(`>${v}${f.unit}<`);
    }
  });

  it('runs the study-pace beat engine with its own figure beats', () => {
    for (const card of mirrorCards) {
      const beats = motionPreviewTimeline(card, tokens)!;
      expect(beats.map((b) => b.name)).toEqual(['trap', 'lens_activate', 'reflect_point', 'draw_straight', 'mark_similar', 'answer']);
      for (let k = 0; k < beats.length; k++) {
        for (const theme of ['base', 'short_dark'] as const) {
          const html = renderToStaticMarkup(<LensScene card={card} keyframe={k} t={0.5} motion={beats} theme={theme} />);
          expect(renderToStaticMarkup(<LensScene card={card} keyframe={k} t={0.5} motion={beats} theme={theme} />)).toBe(html);
        }
      }
      const end = renderToStaticMarkup(<LensScene card={card} keyframe={beats.length - 1} t={1} motion={beats} theme="short_dark" />);
      expect(end).toContain(card.answer.display_ja ?? `${card.answer.value}${card.problem.unit}`);
    }
  });

  it('shows each variant with its own sentence', () => {
    for (const v of mirrorCards.slice(1)) expect(v.problem.text_ja).not.toBe(mirror!.problem.text_ja);
  });
});

// WO-018: mirror-no-lens (Q across the river), mirror-004 (reflect twice in a corner), mirror-f01 (the bridge).
const all = allSceneCards(loadBundle());
const opposite = all.filter((c) => c.problem.figure.type === 'mirror_path' && (c.problem.figure as { side?: string }).side === 'opposite');
const corner = all.filter((c) => c.problem.figure.type === 'mirror_corner');
const bridge = all.filter((c) => c.problem.figure.type === 'river_bridge');
const wo18 = [...opposite, ...corner, ...bridge];
const style = { tokens, ink: 'ink', chalk: 'chalk', accent: 'lens', font: 'f', weight: 400, labelSize: 16, figureStroke: 1, lensStroke: 2, dash: '3 2', bracket: { offset: 20, tick: 5, numberSize: 16, strokeWidth: 1 } };
const words = (html: string) => [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1]!.trim().replace(/&#x27;/g, "'"));

describe.skipIf(wo18.length === 0)('WO-018 折り返す figures', () => {
  it('covers the three draft cards and their variants', () => {
    for (const list of [opposite, corner, bridge]) expect(list.length).toBeGreaterThan(1);
  });

  it.each(wo18.map((c) => [c.id, c] as const))('%s renders every keyframe at t = 0, 0.5 and 1, both themes, purely and without warnings', (_id, card) => {
    const warn = vi.spyOn(console, 'warn');
    for (let k = 0; k < card.animation!.keyframes.length; k++) {
      for (const t of [0, 0.5, 1]) {
        for (const theme of ['base', 'short_dark'] as const) {
          const a = renderToStaticMarkup(<LensScene card={card} keyframe={k} t={t} theme={theme} />);
          expect(renderToStaticMarkup(<LensScene card={card} keyframe={k} t={t} theme={theme} />)).toBe(a);
        }
      }
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(opposite.map((c) => [c.id, c] as const))('%s: Q is below the river, X at the answer, no reflection', (_id, card) => {
    const f = fig(card);
    const layout = mirrorLayout(f, 0, 0, 1000, 1000, 0);
    const html = renderToStaticMarkup(
      <svg>
        <MirrorFigure fig={f} layout={layout} touchX={touchX(card)} {...style} palette={['p0', 'p1']} show={1} tryPath={0} tryDim={1} reflect={1} straight={1} similar={1} tint={0.2} idPrefix="t" />
      </svg>,
    );
    const [qx, qy] = layout.at(f.ab, -f.qb);
    expect(qy).toBeGreaterThan(layout.riverY);
    expect(html).toContain(`<circle cx="${qx}" cy="${qy}"`);
    const [xx, xy] = layout.at(Number(card.answer.value), 0);
    expect(html).toContain(`<circle cx="${xx}" cy="${xy}"`);
    expect(words(html)).not.toContain(f.point_labels.Q_reflected);
    for (const v of [f.pa, f.qb, f.ab]) expect(words(html)).toContain(`${v}${f.unit}`);
  });

  it.each(corner.map((c) => [c.id, c] as const))('%s: the touch point on ℓ sits at the answer; the given distances are printed', (_id, card) => {
    const f = card.problem.figure as MirrorCornerFigure;
    const layout = cornerLayout(f, 0, 0, 1000, 1000, 0);
    const html = renderToStaticMarkup(
      <svg>
        <CornerFigure fig={f} layout={layout} touchX={touchX(card)} answerText="ans" {...style} show={1} first={1} second={1} straight={1} touch={1} answer={1} />
      </svg>,
    );
    const [tx, ty] = layout.at(Number(card.answer.value), 0);
    expect(html).toContain(`<circle cx="${tx}" cy="${ty}"`);
    for (const v of [...f.P, ...f.Q]) expect(words(html)).toContain(`${v}${f.unit}`);
    expect(words(html)).toEqual(expect.arrayContaining(["P'", "Q'", 'ans']));
  });

  it.each(bridge.map((c) => [c.id, c] as const))('%s: the bridge crosses at the answer, perpendicular to the banks', (_id, card) => {
    const f = card.problem.figure as RiverBridgeFigure;
    const layout = bridgeLayout(f, 0, 0, 1000, 1000, 0);
    const html = renderToStaticMarkup(
      <svg>
        <BridgeFigure fig={f} layout={layout} bridgeX={touchX(card)} answerText="ans" water="w" tint={0.2} {...style} show={1} tryPath={1} tryDim={1} first={1} second={1} straight={1} answer={1} />
      </svg>,
    );
    const [x1, y1] = layout.at(Number(card.answer.value), 0);
    const [x2, y2] = layout.at(Number(card.answer.value), -f.w);
    expect(html).toContain(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`);
    for (const v of [f.pa, f.qb, f.ab, f.w]) expect(words(html)).toContain(`${v}${f.unit}`);
  });
});
