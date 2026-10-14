// WO-023: the Stage 3 figures (tools/stage3.py types). Positions come from the figure fields; every printed
// number comes from the text, the figure fields, the steps or the answer, and the answer only once shown.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { answerText } from './format';
import { loadBundle } from './bundle';
import { LensScene } from './LensScene';
import { areaSpan, diceCells, familyPoint, mirrorPoints, rootsQ, diffQ, sumBar } from './stage3';
import type { ConstSumFigure, DiceGridFigure, LensCard, LineMirrorFigure, ParabolaAreaFigure, ParamFamilyFigure } from './types';
import { allSceneCards, STAGE3_TYPES } from './variant';

const cards = allSceneCards(loadBundle()).filter((c) => (STAGE3_TYPES as readonly string[]).includes(c.problem.figure.type));
const of = (type: string) => cards.filter((c) => c.problem.figure.type === type).map((c) => [c.id, c] as const);
const last = (c: LensCard) => c.animation!.keyframes.length - 1;
const html = (c: LensCard, k: number) => renderToStaticMarkup(<LensScene card={c} keyframe={k} t={1} />);
/** The figure's printed text (no tick numbers, no caption band: the band prints steps). */
const figureTexts = (svg: string) =>
  [...svg.matchAll(/<text(?![^>]*data-tick)[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1]!.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&'));
const numbers = (s: string) => s.match(/\d+/g) ?? [];

describe('WO-023 Stage 3 figures', () => {
  it('has every Stage 3 type, with its variants', () => {
    for (const t of STAGE3_TYPES) expect(of(t).length, t).toBeGreaterThanOrEqual(5);
  });

  it.each(cards.map((c) => [c.id, c] as const))('%s prints only numbers from its text, figure fields, steps or answer', (_id, card) => {
    const source = new Set([...numbers(card.problem.text_ja), ...numbers(JSON.stringify(card.problem.figure)), ...card.lens_route.steps.flatMap((s) => numbers(s.ja)), ...numbers(answerText(card))]);
    for (let k = 0; k <= last(card); k++) for (const n of figureTexts(html(card, k)).flatMap(numbers)) expect(source, `${card.id} keyframe ${k} prints ${n}`).toContain(n);
  });

  it.each(cards.map((c) => [c.id, c] as const))('%s shows its answer in the figure only on show_answer', (_id, card) => {
    const k = card.animation!.keyframes.indexOf('show_answer');
    expect(k).toBe(last(card));
    for (let i = 0; i < k; i++) expect(html(card, i)).not.toContain('data-part="answer"');
    // Families draw it beside the fixed point, the region, the chord…; the text band always shows it.
    expect(html(card, k)).toContain(answerText(card).replace(/'/g, '&#x27;'));
  });
});

describe('positions', () => {
  it.each(of('parabola_area'))('%s marks α and β where f − g crosses zero (lens cards), or draws the given bounds', (_id, card) => {
    const f = card.problem.figure as ParabolaAreaFigure;
    const [lo, hi] = areaSpan(f);
    if (f.bounds) expect([lo, hi]).toEqual(f.bounds);
    else {
      expect(rootsQ(diffQ(f.f, f.g))).toEqual([lo, hi]);
      const k = card.animation!.keyframes.indexOf('mark_crossings');
      expect(html(card, k - 1)).not.toContain('data-part="crossings"');
      expect(html(card, k)).toContain('data-part="crossings"');
    }
  });

  it.each(of('line_mirror'))('%s reflects B only when A and B are on the same side and the card asks for a sum', (_id, card) => {
    const f = card.problem.figure as LineMirrorFigure;
    const m = mirrorPoints(f);
    const out = html(card, last(card));
    expect(m.reflect).toBe(f.ask !== 'max_diff' && f.side !== 'opposite');
    expect(out.includes('data-part="reflect"')).toBe(m.reflect && card.animation!.keyframes.includes('reflect_point'));
    // P lies on ℓ.
    expect(m.P[1]).toBeCloseTo(f.line[0] * m.P[0] + f.line[1], 9);
  });

  it.each(of('param_family').filter(([, c]) => ((c.problem.figure as ParamFamilyFigure).ask ?? 'point') === 'point'))('%s draws the fixed point at the answer, where the two brackets meet', (_id, card) => {
    const F = familyPoint(card.problem.figure as ParamFamilyFigure)!;
    expect(`(${F.map((v) => (v < 0 ? `−${-v}` : String(v))).join(', ')})`).toBe(answerText(card));
    const out = html(card, last(card));
    for (const part of ['bracket-a', 'bracket-rest', 'fixed']) expect(out).toContain(`data-part="${part}"`);
  });

  it.each(of('dice_grid'))('%s shades exactly the cells the steps count', (_id, card) => {
    const f = card.problem.figure as DiceGridFigure;
    const out = html(card, last(card));
    const shaded = (out.match(/data-part="cell"/g) ?? []).length;
    if ((f.dice ?? 2) === 3) {
      expect(shaded).toBe(0);
      expect(out).toContain('data-part="no-table"');
      return;
    }
    expect(shaded).toBe(diceCells(f).length);
    // The table count the steps print (「= 14マス」), for the table cards.
    const counted = card.lens_route.steps.map((s) => [...s.ja.matchAll(/= (\d+)マス/g)].at(-1)?.[1]).find(Boolean);
    if (counted) expect(shaded).toBe(Number(counted));
  });

  it.each(of('const_sum'))('%s ends with the split at the centre (or at the wall, or at the given difference)', (_id, card) => {
    const f = card.problem.figure as ConstSumFigure;
    const bar = sumBar(f);
    const x = Number(/data-part="split" data-x="([\d.]+)"/.exec(html(card, last(card)))?.[1]);
    expect(x).toBeCloseTo(bar.end, 9);
    if (f.x_min === undefined && f.ask !== 'given_diff') expect(bar.end).toBeCloseTo(bar.total / 2, 9);
    if (f.x_min !== undefined) expect(html(card, 0)).toContain('data-part="wall"');
  });

  it.each(of('cone_unfold'))('%s draws the chord, or the path through the apex when the sector is 180° or more', (_id, card) => {
    const f = card.problem.figure as { ask: string; expect?: string; r: number; l: number };
    const out = html(card, last(card));
    if (f.ask === 'side_area') return expect(out).toContain('data-part="sector"');
    expect((360 * f.r) / f.l >= 180).toBe(f.expect === 'through_apex');
    expect(out).toContain(f.expect === 'through_apex' ? 'data-part="apex-path"' : 'data-part="chord"');
  });
});
