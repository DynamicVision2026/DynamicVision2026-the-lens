import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCard, loadBundle } from '../bundle';
import { LensScene } from '../LensScene';
import { tokens } from '../tokens';
import type { LensCard } from '../types';
import { beatAt, motionPreviewTimeline, timelineDuration } from './timeline';

const bundle = loadBundle();
const standard = bundle.cards.filter((c) => c.kind === 'standard');
const card001 = getCard('enclose-001')!;

afterEach(() => vi.restoreAllMocks());

/**
 * Geometry attributes only, so colour and opacity changes are ignored. The glow is a colour effect:
 * its filter lives in <defs> (dropped here) and its blurred copies repeat existing geometry.
 */
function geometry(html: string): string[] {
  const attrs = html.replace(/<defs>.*?<\/defs>/gs, '').match(/\s(points|x|y|x1|y1|x2|y2|cx|cy|r|d|width|height|viewBox|transform|font-size)="[^"]*"/g) ?? [];
  return [...new Set(attrs.map((a) => a.trim()))].sort();
}

function preview(card: LensCard) {
  const beats = motionPreviewTimeline(card, tokens);
  if (!beats) throw new Error(`no preview for ${card.id}`);
  return beats;
}

describe('theme', () => {
  it('short_dark changes only colours, not geometry', () => {
    for (const card of bundle.cards) {
      const keyframes = card.animation?.keyframes ?? [];
      for (let k = 0; k < keyframes.length; k++) {
        const base = renderToStaticMarkup(<LensScene card={card} keyframe={k} t={1} />);
        const dark = renderToStaticMarkup(<LensScene card={card} keyframe={k} t={1} theme="short_dark" />);
        expect(geometry(dark)).toEqual(geometry(base));
      }
    }
    const beats = preview(card001);
    for (let k = 0; k < beats.length; k++) {
      const base = renderToStaticMarkup(<LensScene card={card001} keyframe={k} t={0.6} motion={beats} />);
      const dark = renderToStaticMarkup(<LensScene card={card001} keyframe={k} t={0.6} motion={beats} theme="short_dark" />);
      expect(geometry(dark)).toEqual(geometry(base));
    }
  });

  it('short_dark uses the theme colours and leaves the base tokens untouched', () => {
    const dark = renderToStaticMarkup(<LensScene card={card001} keyframe={1} t={1} theme="short_dark" />);
    expect(dark).toContain(tokens.themes!.short_dark!.color!.lens!.enclose!.value!);
    expect(dark).not.toContain(tokens.color.lens.enclose.value);
    expect(tokens.color.paper.value).not.toBe(tokens.themes!.short_dark!.color!.paper!.value);
  });
});

describe('motion preview', () => {
  it('is 10 s (300 frames at 30 fps) for every standard Enclose card', () => {
    for (const card of standard) {
      expect(timelineDuration(preview(card))).toBe(10_000);
    }
    expect(motionPreviewTimeline(getCard('enclose-f01')!, tokens)).toBeNull();
  });

  it('maps time to beats', () => {
    const beats = preview(card001);
    expect(beatAt(beats, 0)).toEqual({ index: 0, t: 0 });
    expect(beatAt(beats, 750)).toEqual({ index: 0, t: 0.5 });
    expect(beatAt(beats, 1500)).toEqual({ index: 1, t: 0 });
    expect(beatAt(beats, 99_999)).toEqual({ index: beats.length - 1, t: 1 });
  });

  it.each(standard.map((c) => [c.id, c] as const))('%s renders every beat, both themes, purely and without warnings', (_id, card) => {
    const warn = vi.spyOn(console, 'warn');
    const beats = preview(card);
    for (let k = 0; k < beats.length; k++) {
      for (const t of [0, 0.37, 1]) {
        for (const theme of ['base', 'short_dark'] as const) {
          const a = renderToStaticMarkup(<LensScene card={card} keyframe={k} t={t} motion={beats} theme={theme} />);
          expect(renderToStaticMarkup(<LensScene card={card} keyframe={k} t={t} motion={beats} theme={theme} />)).toBe(a);
        }
      }
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('puts corner labels on corners in step order (5 · 4 · 6 · 1.5 for enclose-001)', () => {
    const beats = preview(card001);
    const k = beats.findIndex((b) => b.name === 'light_corners');
    const html = renderToStaticMarkup(<LensScene card={card001} keyframe={k} t={1} motion={beats} />);
    const labels = [...html.matchAll(/dominant-baseline="central">([^<]+)<\/text>/g)].map((m) => m[1]);
    expect(labels.filter((l) => /^[\d.]+$/.test(l!))).toEqual(['5', '4', '6', '1.5']);
  });

  it('builds the equation from step values, never running totals', () => {
    const beats = preview(card001);
    const k = beats.findIndex((b) => b.name === 'collapse');
    const html = renderToStaticMarkup(<LensScene card={card001} keyframe={k} t={1} motion={beats} />);
    const terms = [...html.matchAll(/<tspan opacity="[^"]*">([^<]*)<\/tspan>/g)].map((m) => m[1]).join('');
    expect(terms).toBe('36 − 5 − 4 − 6 − 1.5');
  });

  it('ends on the result line, display_ja and trigger from the bundle', () => {
    const beats = preview(card001);
    const html = renderToStaticMarkup(<LensScene card={card001} keyframe={beats.length - 1} t={1} motion={beats} theme="short_dark" />);
    const result = card001.lens_route.steps.find((s) => s.op === 'result')!;
    expect(html).toContain(result.ja);
    expect(html).toContain(card001.answer.display_ja!);
    expect(html).toContain(card001.trigger.ja);
  });
});
