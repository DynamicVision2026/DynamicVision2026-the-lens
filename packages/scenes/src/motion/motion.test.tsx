import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCard, loadBundle } from '../bundle';
import { formatExact } from '../format';
import { LensScene } from '../LensScene';
import { tokens } from '../tokens';
import type { LensCard } from '../types';
import { beatAt, motionPreviewTimeline, studyStepMs, timelineDuration, type Beat } from './timeline';

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

const render = (card: LensCard, beats: Beat[], k: number, t: number, theme: 'base' | 'short_dark' = 'base') =>
  renderToStaticMarkup(<LensScene card={card} keyframe={k} t={t} motion={beats} theme={theme} />);

/** Text content of every <text>/<tspan>, in document order. */
const texts = (html: string) => [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1]!.trim()).filter(Boolean);

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
      expect(geometry(render(card001, beats, k, 0.6, 'short_dark'))).toEqual(geometry(render(card001, beats, k, 0.6)));
    }
  });

  it('short_dark uses the theme colours, including its step palette', () => {
    const dark = renderToStaticMarkup(<LensScene card={card001} keyframe={1} t={1} theme="short_dark" />);
    expect(dark).toContain(tokens.themes!.short_dark!.color!.lens!.enclose!.value!);
    expect(dark).not.toContain(tokens.color.lens.enclose.value);
    const beats = preview(card001);
    const k = beats.findIndex((b) => b.name === 'corner_step');
    const darkStep = render(card001, beats, k, 1, 'short_dark');
    expect(darkStep).toContain(tokens.themes!.short_dark!.color!.step!.palette![0]!.value!);
    expect(render(card001, beats, k, 1)).toContain(tokens.color.step.palette[0]!.value);
  });
});

describe('study-pace motion preview', () => {
  it('is 30 s (900 frames) for 4-corner cards and follows the number of sub steps', () => {
    for (const card of standard) {
      const subs = card.lens_route.steps.filter((s) => s.op === 'sub').length;
      const beats = preview(card);
      expect(beats.filter((b) => b.name === 'corner_step')).toHaveLength(subs);
      if (subs === 4) expect(timelineDuration(beats)).toBe(30_000);
    }
    expect(motionPreviewTimeline(getCard('enclose-f01')!, tokens)).toBeNull();
    expect(motionPreviewTimeline(getCard('enclose-no-lens')!, tokens)).toBeNull();
  });

  it('gives every calculation step at least 3.5 s on screen', () => {
    expect(studyStepMs(tokens)).toBeGreaterThanOrEqual(3500);
    for (const b of preview(card001).filter((b) => b.name === 'box_step' || b.name === 'corner_step')) {
      expect(b.durationMs).toBeGreaterThanOrEqual(3500);
    }
  });

  it('maps time to beats', () => {
    const beats = preview(card001);
    expect(beatAt(beats, 0)).toEqual({ index: 0, t: 0 });
    expect(beatAt(beats, 2000)).toEqual({ index: 0, t: 0.5 });
    expect(beatAt(beats, 99_999)).toEqual({ index: beats.length - 1, t: 1 });
  });

  it.each(standard.map((c) => [c.id, c] as const))('%s renders every beat, both themes, purely and without warnings', (_id, card) => {
    const warn = vi.spyOn(console, 'warn');
    const beats = preview(card);
    for (let k = 0; k < beats.length; k++) {
      for (const t of [0, 0.37, 1]) {
        for (const theme of ['base', 'short_dark'] as const) {
          expect(render(card, beats, k, t, theme)).toBe(render(card, beats, k, t, theme));
        }
      }
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('shows the box step 6 × 6 = 36, then each corner formula from its detail, on its own', () => {
    const beats = preview(card001);
    const box = texts(render(card001, beats, beats.findIndex((b) => b.name === 'box_step'), 1));
    expect(box).toContain('6 × 6 = 36');
    expect(box).toEqual(expect.arrayContaining(['6']));
    const expected = ['5 × 2 ÷ 2 = 5', '2 × 4 ÷ 2 = 4', '4 × 3 ÷ 2 = 6', '1 × 3 ÷ 2 = 1.5'];
    beats.forEach((b, k) => {
      if (b.name !== 'corner_step') return;
      const html = texts(render(card001, beats, k, 1));
      const cards = html.filter((s) => s.includes('÷ 2 ='));
      expect(cards).toEqual([expected[b.index!]]);
      // Its badge number and the base/height numbers come from the step's detail.
      const d = card001.lens_route.steps.filter((s) => s.op === 'sub')[b.index!]!.detail!;
      if (d.kind !== 'corner') throw new Error('corner detail expected');
      expect(html).toEqual(expect.arrayContaining([String(d.n), String(d.base), String(d.height)]));
    });
  });

  it('builds the equation from step values in step colours, never running totals', () => {
    const beats = preview(card001);
    const html = render(card001, beats, beats.findIndex((b) => b.name === 'subtract'), 1, 'short_dark');
    const terms = [...html.matchAll(/<tspan fill="([^"]+)" opacity="[^"]*">([^<]*)<\/tspan>/g)];
    expect(terms.map((m) => m[2]).join('')).toBe('36 − 5 − 4 − 6 − 1.5');
    const palette = tokens.themes!.short_dark!.color!.step!.palette!;
    expect(terms.slice(1).map((m) => m[1])).toEqual(palette.map((p) => p?.value));
    for (const total of ['31', '27', '21']) expect(texts(html)).not.toContain(total);
  });

  it('ends on the result line, display_ja and trigger from the bundle', () => {
    const beats = preview(card001);
    const html = render(card001, beats, beats.length - 1, 1, 'short_dark');
    const result = card001.lens_route.steps.find((s) => s.op === 'result')!;
    expect(html).toContain(result.ja);
    expect(html).toContain(card001.answer.display_ja!);
    expect(html).toContain(card001.trigger.ja);
    expect(formatExact(result.value!)).toBe('19.5');
  });

  it('shows the lens label beside the icon when given', () => {
    const beats = preview(card001);
    const k = beats.findIndex((b) => b.name === 'lens_activate');
    const html = renderToStaticMarkup(<LensScene card={card001} keyframe={k} t={1} motion={beats} lensLabel="囲む" />);
    expect(texts(html)).toContain('囲む');
  });
});
