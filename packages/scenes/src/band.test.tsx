import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCard, loadBundle } from './bundle';
import { formatExact } from './format';
import { LensScene } from './LensScene';
import { motionPreviewTimeline, shortTimeline } from './motion/timeline';
import { tokens } from './tokens';
import type { LensCard, ParallelBandFigure } from './types';
import { allSceneCards } from './variant';

// slide-001 is a draft until WO-004 merges: CI runs these tests on a drafts-included bundle.
const slide = getCard('slide-001');
const bandCards = allSceneCards(loadBundle()).filter((c) => c.problem.figure.type === 'parallel_band');
const band = (c: LensCard) => c.problem.figure as ParallelBandFigure;
const texts = (html: string) => [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1]!.trim()).filter(Boolean);

afterEach(() => vi.restoreAllMocks());

describe.skipIf(!slide)('slide-001 (parallel band)', () => {
  it('has the card and its 4 variants', () => {
    expect(bandCards.filter((c) => c.id.startsWith('slide-001')).map((c) => c.id)).toEqual(['slide-001', 'slide-001-v1', 'slide-001-v2', 'slide-001-v3', 'slide-001-v4']);
  });

  it.each(bandCards.map((c) => [c.id, c] as const))('%s renders every keyframe at t = 0 and 1, both themes, purely and without warnings', (_id, card) => {
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

  it.each(bandCards.map((c) => [c.id, c] as const))('%s never shows AB / BC / CD: the only bare lengths are AD and the gap', (_id, card) => {
    const fig = band(card);
    const allowed = new Set([formatExact(fig.total_base), String(fig.band_height)]);
    const keyframes = card.animation!.keyframes;
    for (let k = 0; k < keyframes.length; k++) {
      const numbers = texts(renderToStaticMarkup(<LensScene card={card} keyframe={k} t={1} />)).filter((s) => /^[\d.]+$/.test(s));
      for (const n of numbers) expect(allowed).toContain(n);
    }
    const beats = shortTimeline(card, tokens)!;
    for (let k = 0; k < beats.length; k++) {
      const html = renderToStaticMarkup(<LensScene card={card} keyframe={k} t={1} motion={beats} theme="short_dark" />);
      for (const n of texts(html).filter((s) => /^[\d.]+$/.test(s))) expect(allowed).toContain(n);
    }
  });

  it('keeps every base fixed while its apex slides along ℓ', () => {
    const card = slide!;
    const k = card.animation!.keyframes.indexOf('slide_apexes');
    const polys = (t: number) =>
      [...renderToStaticMarkup(<LensScene card={card} keyframe={k} t={t} />).matchAll(/<polygon points="([^"]+)" fill="[^"]+" fill-opacity/g)].map((m) =>
        m[1]!.split(' ').map((p) => p.split(',').map(Number)),
      );
    const before = polys(0);
    const after = polys(1);
    expect(after).toHaveLength(before.length);
    before.forEach((tri, i) => {
      expect(after[i]![0]).toEqual(tri[0]); // base start
      expect(after[i]![1]).toEqual(tri[1]); // base end
      expect(after[i]![2]![1]).toBe(tri[2]![1]); // apex stays on ℓ
    });
    // Every apex ends at the meeting point.
    expect(new Set(after.map((tri) => tri[2]![0])).size).toBe(1);
  });

  it('runs the study-pace beat engine, one slide beat per apex', () => {
    for (const card of bandCards) {
      const beats = motionPreviewTimeline(card, tokens)!;
      expect(beats.map((b) => b.name)).toEqual(['trap', 'lens_activate', 'mark_parallel', ...band(card).apex_x.map(() => 'slide_apex'), 'merge_triangle', 'answer']);
      for (let k = 0; k < beats.length; k++) {
        for (const theme of ['base', 'short_dark'] as const) {
          const html = renderToStaticMarkup(<LensScene card={card} keyframe={k} t={0.5} motion={beats} theme={theme} />);
          expect(renderToStaticMarkup(<LensScene card={card} keyframe={k} t={0.5} motion={beats} theme={theme} />)).toBe(html);
        }
      }
      const end = renderToStaticMarkup(<LensScene card={card} keyframe={beats.length - 1} t={1} motion={beats} theme="short_dark" />);
      expect(end).toContain(card.lens_route.steps.find((s) => s.op === 'result')!.ja);
    }
  });

  it('shows each variant with its own sentence', () => {
    for (const v of bandCards.filter((c) => c.id.startsWith('slide-001-v'))) {
      const original = slide!.variants.find((x) => x.id === v.id)!;
      expect(v.problem.text_ja).toBe(original.text_ja);
      expect(v.problem.text_ja).not.toBe(slide!.problem.text_ja);
    }
  });
});
