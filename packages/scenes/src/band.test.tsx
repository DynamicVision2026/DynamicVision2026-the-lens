import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCard, loadBundle } from './bundle';
import { formatExact } from './format';
import { LensScene } from './LensScene';
import { motionPreviewTimeline, shortTimeline } from './motion/timeline';
import { tokens } from './tokens';
import type { LensCard, ParallelBandFigure } from './types';
import { allSceneCards } from './variant';
import { bandMode } from './band';

// slide-001 is a draft until WO-004 merges: CI runs these tests on a drafts-included bundle.
const slide = getCard('slide-001');
// The classic band; the WO-018 modes (one triangle, non-parallel lines, ask for the gap) have their own block below.
const classicBand = (f: Record<string, unknown>) => !f.apex_heights && f.ask !== 'band_height' && (f.apex_x as unknown[]).length > 1;
const bandCards = allSceneCards(loadBundle()).filter((c) => c.problem.figure.type === 'parallel_band' && classicBand(c.problem.figure as unknown as Record<string, unknown>));
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

// WO-018: slide-no-lens (one triangle), slide-f01 (ℓ not parallel), slide-004 (the gap is asked).
const wo18 = allSceneCards(loadBundle()).filter((c) => c.problem.figure.type === 'parallel_band' && !classicBand(c.problem.figure as unknown as Record<string, unknown>));
const numbersIn = (html: string) => texts(html).flatMap((s) => s.match(/\d+(?:\.\d+)?/g) ?? []);

describe.skipIf(wo18.length === 0)('WO-018 band modes', () => {
  it('covers the three draft cards and their variants', () => {
    for (const id of ['slide-no-lens', 'slide-f01', 'slide-004']) expect(wo18.filter((c) => c.id.startsWith(id)).length).toBeGreaterThan(1);
  });

  it.each(wo18.map((c) => [c.id, c] as const))('%s renders every keyframe at t = 0 and 1, both themes, purely and without warnings', (_id, card) => {
    const warn = vi.spyOn(console, 'warn');
    for (let k = 0; k < card.animation!.keyframes.length; k++) {
      for (const t of [0, 1]) {
        for (const theme of ['base', 'short_dark'] as const) {
          const a = renderToStaticMarkup(<LensScene card={card} keyframe={k} t={t} theme={theme} />);
          expect(renderToStaticMarkup(<LensScene card={card} keyframe={k} t={t} theme={theme} />)).toBe(a);
        }
      }
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(wo18.filter((c) => bandMode(band(c)) === 'nonparallel').map((c) => [c.id, c] as const))('%s: ℓ is tilted through the apexes, has no ∥ marks, nothing slides; each base and height is printed', (_id, card) => {
    const fig = band(card);
    const kfs = card.animation!.keyframes;
    const html = (k: number, t = 1) => renderToStaticMarkup(<LensScene card={card} keyframe={k} t={t} />);
    const lines = [...html(0).matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)].map((m) => m.slice(1).map(Number));
    expect(lines.some(([, y1, , y2]) => Math.abs(y1! - y2!) > 5)).toBe(true);
    expect(html(0)).not.toMatch(/<path d="M [^"]+ L [^"]+ L [^"]+"/);
    const tris = (h: string) => [...h.matchAll(/<polygon points="([^"]+)" fill="[^"]+" fill-opacity/g)].map((m) => m[1]);
    const k = kfs.indexOf('slide_apexes');
    expect(tris(html(k, 1))).toEqual(tris(html(k, 0)));
    const allowed = new Set([...fig.apex_heights!.map(String), formatExact(fig.total_base), ...fig.bottom_x.slice(1).map((x, i) => String(x - fig.bottom_x[i]!))]);
    for (const n of numbersIn(html(0))) expect(allowed).toContain(n);
    for (const h of fig.apex_heights!) expect(texts(html(0))).toContain(String(h));
    // The heights are collinear in the data (PR 101), so ℓ passes exactly through every apex.
    const apexes = tris(html(0)).map((pts) => pts!.split(' ')[2]!.split(',').map(Number) as [number, number]);
    const [a, b] = [apexes[0]!, apexes[apexes.length - 1]!];
    for (const q of apexes) expect(Math.abs((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]))).toBeLessThan(1e-6 * Math.hypot(b[0] - a[0], b[1] - a[1]) * 1000);
  });

  it.each(wo18.filter((c) => bandMode(band(c)) === 'ask_height').map((c) => [c.id, c] as const))('%s: the gap reads 「?cm」 until the answer, with the given total area', (_id, card) => {
    const fig = band(card);
    const kfs = card.animation!.keyframes;
    const before = renderToStaticMarkup(<LensScene card={card} keyframe={kfs.indexOf('merge_triangle')} t={1} />);
    expect(texts(before)).toContain('?cm');
    expect(before).toContain(`${formatExact(fig.total_area!)}cm²`);
    expect(texts(before).filter((s) => s.includes('cm')).some((s) => s.startsWith(String(fig.band_height)))).toBe(false);
    const after = renderToStaticMarkup(<LensScene card={card} keyframe={kfs.indexOf('show_answer')} t={1} />);
    expect(texts(after)).not.toContain('?cm');
    expect(after).toContain(card.answer.display_ja ?? `${card.answer.value}cm`);
  });

  it.each(wo18.filter((c) => bandMode(band(c)) === 'single').map((c) => [c.id, c] as const))('%s: one triangle with its base and height, nothing else', (_id, card) => {
    const fig = band(card);
    const html = renderToStaticMarkup(<LensScene card={card} keyframe={0} t={1} />);
    expect([...html.matchAll(/fill-opacity/g)].length).toBe(1);
    expect(new Set(numbersIn(html))).toEqual(new Set([formatExact(fig.total_base), String(fig.band_height)]));
  });
});
