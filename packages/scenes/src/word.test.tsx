import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCard, loadBundle } from './bundle';
import { LensScene } from './LensScene';
import { motionPreviewTimeline, shortTimeline } from './motion/timeline';
import type { LensCard, WordProblemFigure } from './types';
import { tokens } from './tokens';
import { allSceneCards } from './variant';
import { afterEquals, diagramKeyframes } from './wordProblem';

// area-001 and constant-001 are drafts until WO-006 merges: CI runs these tests on a drafts-included bundle.
const area = getCard('area-001');
const constant = getCard('constant-001');
const wordCards = allSceneCards(loadBundle()).filter(
  (c) => c.problem.figure.type === 'word_problem' && ['two_kinds_total', 'age_ratio'].includes((c.problem.figure as WordProblemFigure).kind),
);
const fig = (c: LensCard) => c.problem.figure as WordProblemFigure;
const last = (c: LensCard) => c.animation!.keyframes.length - 1;
const answerText = (c: LensCard) => c.answer.display_ja ?? `${c.answer.value}${c.problem.unit ?? ''}`;
const textNodes = (html: string) => [...html.matchAll(/>([^<]+)</g)].map((m) => m[1]!).join(' ');

afterEach(() => vi.restoreAllMocks());

describe.skipIf(!area || !constant)('word problems (面積図, 差一定)', () => {
  it('has both cards and their 4 variants each', () => {
    // Data-driven: more anchor cards of these kinds arrive from catalog work (Architect, Oct 13).
    const ids = wordCards.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['area-001', 'constant-001']));
    for (const anchor of ids.filter((id) => !/-v\d+$/.test(id))) {
      expect(ids.filter((id) => id.startsWith(`${anchor}-v`))).toHaveLength(4);
    }
  });

  it.each(wordCards.map((c) => [c.id, c] as const))('%s renders every keyframe at t = 0, 0.5 and 1, both themes, purely and without warnings', (_id, card) => {
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

  it('shows each variant with its own sentence and numbers', () => {
    const v1 = wordCards.find((c) => c.id === 'area-001-v1')!;
    expect(v1.problem.text_ja).not.toBe(area!.problem.text_ja);
    const html = textNodes(renderToStaticMarkup(<LensScene card={v1} keyframe={0} t={1} />));
    for (const s of ['100', '50', '19', '1700']) expect(html).toContain(s);
    for (const v of wordCards.filter((c) => c.id.includes('-v'))) {
      const base = v.id.startsWith('area') ? area! : constant!;
      expect(v.problem.text_ja).not.toBe(base.problem.text_ja);
    }
  });

  it('every step the diagram labels has a number after its 「=」', () => {
    // Area labels steps 1–3 (all-b total, gap, strip height); Constant labels steps 0–2 (difference, parts, one part).
    const labelled: Partial<Record<WordProblemFigure['kind'], number[]>> = { two_kinds_total: [1, 2, 3], age_ratio: [0, 1, 2] };
    for (const card of wordCards) {
      for (const i of labelled[fig(card).kind]!) expect(afterEquals(card.lens_route.steps[i]), `${card.id} step ${i}`).not.toBeNull();
      expect(afterEquals(card.lens_route.steps.find((s) => s.op === 'result'))).not.toBeNull();
    }
  });

  it('prints no number that is not in the story, the steps or the answer', () => {
    for (const card of wordCards) {
      const allowed = new Set(
        [card.problem.text_ja, ...card.lens_route.steps.map((s) => s.ja), card.answer.display_ja ?? '', card.answer.value]
          .flatMap((s) => s.match(/\d+/g) ?? []),
      );
      for (let k = 0; k <= last(card); k++) {
        const html = textNodes(renderToStaticMarkup(<LensScene card={card} keyframe={k} t={1} />));
        for (const n of html.match(/\d+/g) ?? []) expect(allowed, `${card.id} keyframe ${k} prints ${n}`).toContain(n);
      }
      const end = renderToStaticMarkup(<LensScene card={card} keyframe={last(card)} t={1} />);
      expect(end).toContain(answerText(card));
    }
  });

  it('keeps the age difference the same length while the bars grow', () => {
    for (const card of wordCards.filter((c) => fig(c).kind === 'age_ratio')) {
      const k = card.animation!.keyframes.indexOf('grow_bars');
      const widths = [0, 0.5, 1].map((t) => {
        const html = renderToStaticMarkup(<LensScene card={card} keyframe={k} t={t} />);
        return /data-part="difference"[^>]*width="([\d.]+)"/.exec(html)?.[1];
      });
      expect(widths[0]).toBeDefined();
      expect(new Set(widths).size).toBe(1);
    }
  });

  it('runs the study-pace beat engine with one figure beat per diagram keyframe', () => {
    for (const card of wordCards) {
      const beats = motionPreviewTimeline(card, tokens)!;
      expect(beats.map((b) => b.name)).toEqual(['trap', 'lens_activate', ...diagramKeyframes(card).map(() => 'figure_step'), 'answer']);
      expect(beats.filter((b) => b.name === 'figure_step').map((b) => b.key)).toEqual(diagramKeyframes(card));
      for (let k = 0; k < beats.length; k++) {
        for (const theme of ['base', 'short_dark'] as const) {
          const html = renderToStaticMarkup(<LensScene card={card} keyframe={k} t={0.5} motion={beats} theme={theme} />);
          expect(renderToStaticMarkup(<LensScene card={card} keyframe={k} t={0.5} motion={beats} theme={theme} />)).toBe(html);
        }
      }
      const end = renderToStaticMarkup(<LensScene card={card} keyframe={beats.length - 1} t={1} motion={beats} theme="short_dark" />);
      expect(end).toContain(answerText(card));
      expect(shortTimeline(card, tokens)).not.toBeNull();
    }
  });
});

