import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCard, loadBundle } from '../bundle';
import { hasScene } from '../variant';
import { formatExact, timeLabel } from '../format';
import { LensScene } from '../LensScene';
import { tokens } from '../tokens';
import type { LensCard } from '../types';
import { beatAt, motionPreviewTimeline, shortTimeline, studyStepMs, timelineDuration, type Beat } from './timeline';
import { SHORT_COPY } from './MotionScene';

const bundle = loadBundle();
const standard = bundle.cards.filter((c) => c.kind === 'standard' && c.problem.figure.type === 'grid_polygon');
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
    for (const card of bundle.cards.filter(hasScene)) {
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
    // The last equation text is the visible one (a glow copy may sit behind it).
    const terms = [...html.matchAll(/<tspan fill="([^"]+)" opacity="[^"]*">([^<]*)<\/tspan>/g)].slice(-5);
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
    // The trigger may wrap in the title band: compare the joined visible text.
    expect([...html.matchAll(/>([^<]+)</g)].map((m) => m[1]).join('')).toContain(card001.trigger.ja);
    expect(formatExact(result.value!)).toBe('19.5');
  });

  it('shows the full equation with ? placeholders for future terms at every step', () => {
    const beats = preview(card001);
    const k = beats.findIndex((b) => b.name === 'corner_step' && b.index === 1);
    const html = render(card001, beats, k, 0.5);
    const terms = [...html.matchAll(/<tspan fill="[^"]+" opacity="([^"]*)">([^<]*)<\/tspan>/g)].slice(-5);
    expect(terms.map((m) => m[2]).join('')).toBe('36 − 5 − ? − ? − ?');
    const future = tokens.layout.short.equation_terms.future_opacity;
    expect(terms.slice(2).every((m) => Number(m[1]) === future)).toBe(true);
  });

  it('draws done pieces as outlines only (no fill), the current one filled', () => {
    const beats = preview(card001);
    const k = beats.findIndex((b) => b.name === 'corner_step' && b.index === 2);
    const html = render(card001, beats, k, 1, 'short_dark');
    const { pieces } = tokens.layout.short;
    const palette = tokens.themes!.short_dark!.color!.step!.palette!;
    const polygonOf = (c: string) => html.match(new RegExp(`<polygon[^>]*fill="${c}"[^>]*>`))?.[0] ?? '';
    expect(polygonOf(palette[0]!.value!)).toContain(`fill-opacity="${pieces.done.fill_opacity}"`);
    expect(polygonOf(palette[2]!.value!)).toContain(`fill-opacity="${pieces.current.fill_opacity}"`);
  });

  it('stripes the current piece in its full step colour, from layout.short.pieces.current', () => {
    const beats = preview(card001);
    const k = beats.findIndex((b) => b.name === 'corner_step' && b.index === 1);
    const html = render(card001, beats, k, 1, 'short_dark');
    const stripes = tokens.layout.short.pieces.current.stripes;
    if (!stripes) return; // tokens before 1.4: plain tint only
    const pink = tokens.themes!.short_dark!.color!.step!.palette![1]!.value!;
    const pattern = html.match(/<pattern[^>]*>.*?<\/pattern>/s)?.[0] ?? '';
    expect(pattern).toContain(`width="${stripes.period_px}"`);
    expect(pattern).toContain(`rotate(${stripes.angle_deg})`);
    expect(pattern).toContain(`<rect x="0" y="0" width="${stripes.stripe_px}" height="${stripes.period_px}" fill="${pink}"`);
    expect(html).toMatch(new RegExp(`fill="url\\(#lens-enclose-001-stripes-1\\)" opacity="${stripes.opacity}"`));
    // Only the current piece is striped.
    expect(html.match(/<pattern/g)).toHaveLength(1);
  });

  it('keeps every text inside the safe area (y 220–1540)', () => {
    const { safe_top_px: top, safe_bottom_px: bottom, size_px } = tokens.layout.short;
    for (const card of standard) {
      const beats = preview(card);
      for (let k = 0; k < beats.length; k++) {
        const html = render(card, beats, k, 1);
        for (const m of html.matchAll(/<text[^>]* y="([-\d.]+)"/g)) {
          const y = Number(m[1]);
          expect(y).toBeGreaterThanOrEqual(top);
          expect(y).toBeLessThanOrEqual(size_px[1] - bottom);
        }
      }
    }
  });

  it('meets the phone-size minimums (390 px wide phone)', () => {
    const { type_px: T, size_px } = tokens.layout.short;
    const phone = 390 / size_px[0];
    expect(T.formula * phone).toBeGreaterThanOrEqual(26);
    expect(T.equation * phone).toBeGreaterThanOrEqual(23);
    expect(T.vertex_label * phone).toBeGreaterThanOrEqual(16);
  });

  it('shows the lens label beside the icon when given', () => {
    const beats = preview(card001);
    const k = beats.findIndex((b) => b.name === 'lens_activate');
    const html = renderToStaticMarkup(<LensScene card={card001} keyframe={k} t={1} motion={beats} lensLabel="囲む" />);
    expect(texts(html)).toContain('囲む');
  });
});

describe('full Short (WO-003 step 2)', () => {
  const beatsOf = (card: LensCard) => {
    const beats = shortTimeline(card, tokens);
    if (!beats) throw new Error(`no Short for ${card.id}`);
    return beats;
  };
  const labels = Object.fromEntries(Object.entries(bundle.labels.lenses).map(([k, v]) => [k, v.ja]));
  const renderShort = (card: LensCard, k: number, t: number) =>
    renderToStaticMarkup(<LensScene card={card} keyframe={k} t={t} motion={beatsOf(card)} theme="short_dark" optionLabels={labels} lensLabel={labels[card.lens]} />);

  it('frames the study walkthrough with hook, freeze and end card', () => {
    const names = beatsOf(card001).map((b) => b.name);
    expect(names.slice(0, 4)).toEqual(['hook', 'trap', 'freeze', 'lens_activate']);
    expect(names.at(-1)).toBe('end_card');
    expect(timelineDuration(beatsOf(card001))).toBe(timelineDuration(preview(card001)) + 3000 + 3500 + 3500);
  });

  it('asks the question from the bundle in the hook', () => {
    expect(texts(renderShort(card001, 0, 1)).join('')).toContain(card001.problem.text_ja.slice(0, 10));
  });

  it('shows the four lens buttons with bundle labels in the freeze', () => {
    const k = beatsOf(card001).findIndex((b) => b.name === 'freeze');
    const t = texts(renderShort(card001, k, 1));
    expect(t).toContain(SHORT_COPY.freeze);
    for (const opt of card001.picker.options) expect(t).toContain(bundle.labels.lenses[opt]!.ja);
  });

  it('clears the lens buttons before the first step brings in the equation row', () => {
    const beats = beatsOf(card001);
    const k = beats.findIndex((b) => b.name === 'lens_activate');
    // Still there while the correct one lights up…
    // (The other lenses' labels appear only on the buttons; the correct one is also on the lens chip.)
    const others = card001.picker.options.filter((o) => o !== card001.lens).map((o) => bundle.labels.lenses[o]!.ja);
    for (const label of others) expect(texts(renderShort(card001, k, 0.2))).toContain(label);
    // …and gone by the start of the next beat.
    const next = texts(renderShort(card001, k + 1, 0));
    for (const label of others) expect(next).not.toContain(label);
  });

  it('ends on the trigger, the time saved and the series card', () => {
    const beats = beatsOf(card001);
    const t = texts(renderShort(card001, beats.length - 1, 1));
    expect(t.join('')).toContain(card001.trigger.ja.slice(0, 8));
    expect(t).toContain(SHORT_COPY.series);
    expect(t).toContain(SHORT_COPY.url);
    expect(t).toContain(timeLabel(tokens.time_cost.saved_label_ja, card001.trap_route.time_cost_sec - card001.lens_route.time_cost_sec));
  });

  it.each(standard.map((c) => [c.id, c] as const))('%s: every Short beat renders purely, inside the safe area', (_id, card) => {
    const { safe_top_px: top, safe_bottom_px: bottom, size_px } = tokens.layout.short;
    const beats = beatsOf(card);
    for (let k = 0; k < beats.length; k++) {
      for (const t of [0, 0.5, 1]) {
        const html = renderShort(card, k, t);
        expect(renderShort(card, k, t)).toBe(html);
        for (const m of html.matchAll(/<text[^>]* y="([-\d.]+)"/g)) {
          expect(Number(m[1])).toBeGreaterThanOrEqual(top);
          expect(Number(m[1])).toBeLessThanOrEqual(size_px[1] - bottom);
        }
      }
    }
  });
});
