import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCard, loadBundle } from './bundle';
import { LensScene } from './LensScene';
import { motionPreviewTimeline, shortTimeline } from './motion/timeline';
import { tokens } from './tokens';
import type { LensCard, WordProblemFigure } from './types';
import { allSceneCards } from './variant';
import { allAfterEquals, diagramKeyframes, expressionIn, ratioIn } from './wordProblem';

// balance-001 and freeze-001 are drafts until WO-007 merges: CI runs these tests on a drafts-included bundle.
const balance = getCard('balance-001');
const freeze = getCard('freeze-001');
const kindOf = (c: LensCard) => (c.problem.figure as WordProblemFigure).kind;
const cards = allSceneCards(loadBundle()).filter((c) => c.problem.figure.type === 'word_problem' && ['mixture', 'meeting'].includes(kindOf(c)));
const last = (c: LensCard) => c.animation!.keyframes.length - 1;
const answerText = (c: LensCard) => c.answer.display_ja ?? `${c.answer.value}${c.problem.unit ?? ''}`;
const textNodes = (html: string) => [...html.matchAll(/>([^<]+)</g)].map((m) => m[1]!).join(' ');
const dataX = (html: string, part: string) => Number(new RegExp(`data-part="${part}" data-x="([\\d.]+)"`).exec(html)?.[1]);
const at = (card: LensCard, key: string, t = 1) => renderToStaticMarkup(<LensScene card={card} keyframe={card.animation!.keyframes.indexOf(key)} t={t} />);

afterEach(() => vi.restoreAllMocks());

describe.skipIf(!balance || !freeze)('word problems (てんびん, 止める)', () => {
  it('has both cards and their 4 variants each', () => {
    expect(cards.map((c) => c.id)).toEqual([
      'balance-001', 'balance-001-v1', 'balance-001-v2', 'balance-001-v3', 'balance-001-v4',
      'freeze-001', 'freeze-001-v1', 'freeze-001-v2', 'freeze-001-v3', 'freeze-001-v4',
    ]);
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

  it('shows each variant with its own sentence and numbers', () => {
    const v1 = cards.find((c) => c.id === 'freeze-001-v1')!;
    const story = textNodes(renderToStaticMarkup(<LensScene card={v1} keyframe={0} t={1} />));
    for (const s of ['2800', '100', '40']) expect(story).toContain(s);
    expect(renderToStaticMarkup(<LensScene card={v1} keyframe={last(v1)} t={1} />)).toContain('20分後');
    for (const v of cards.filter((c) => c.id.includes('-v'))) {
      expect(v.problem.text_ja).not.toBe((v.id.startsWith('balance') ? balance : freeze)!.problem.text_ja);
    }
  });

  it('reads every number the diagrams print from its step', () => {
    for (const card of cards) {
      const steps = card.lens_route.steps;
      if (kindOf(card) === 'mixture') {
        expect(allAfterEquals(steps[1]), card.id).toHaveLength(2);
        expect(ratioIn(steps[2]), card.id).not.toBeNull();
      } else {
        expect(expressionIn(steps[0]), card.id).not.toBeNull();
      }
    }
  });

  it('prints no number that is not in the story, the steps or the answer', () => {
    for (const card of cards) {
      const allowed = new Set(
        [card.problem.text_ja, ...card.lens_route.steps.map((s) => s.ja), answerText(card), card.answer.value].flatMap((s) => s.match(/\d+/g) ?? []),
      );
      for (let k = 0; k <= last(card); k++) {
        const html = textNodes(renderToStaticMarkup(<LensScene card={card} keyframe={k} t={1} />));
        for (const n of html.match(/\d+/g) ?? []) expect(allowed, `${card.id} keyframe ${k} prints ${n}`).toContain(n);
      }
      expect(renderToStaticMarkup(<LensScene card={card} keyframe={last(card)} t={1} />)).toContain(answerText(card));
    }
  });

  it('the lever: the heavier side sits nearer the pivot', () => {
    for (const card of cards.filter((c) => kindOf(c) === 'mixture')) {
      const html = at(card, 'invert_ratio');
      const [left, pivot, right] = [dataX(html, 'weight-left'), dataX(html, 'pivot'), dataX(html, 'weight-right')];
      const heavierRight = Number(card.answer.value) > (card.problem.figure as WordProblemFigure).params.w1!;
      expect(right - pivot < pivot - left, card.id).toBe(heavierRight);
    }
  });

  it('the road: the halfway "?" is visibly not where they meet', () => {
    for (const card of cards.filter((c) => kindOf(c) === 'meeting')) {
      const half = dataX(at(card, 'both_walk'), 'halfway');
      const meet = dataX(renderToStaticMarkup(<LensScene card={card} keyframe={last(card)} t={1} />), 'meet');
      expect(Math.abs(meet - half), card.id).toBeGreaterThan(10);
    }
  });

  it('runs the study-pace beat engine with one figure beat per diagram keyframe', () => {
    for (const card of cards) {
      const beats = motionPreviewTimeline(card, tokens)!;
      expect(beats.map((b) => b.name)).toEqual(['trap', 'lens_activate', ...diagramKeyframes(card).map(() => 'figure_step'), 'answer']);
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
