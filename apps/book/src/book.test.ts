// WO-021 §4: every book renders to HTML (no browser), carries every referenced id, stays near its page
// estimate, prints no number that is not in the problem, and prints each answer from the bundle.
import { describe, expect, it } from 'vitest';
import { answerText, withVariant, type LensCard } from '@lens/scenes';
import { renderFigure } from './figure';
import { planBook } from './plan';
import { bookBundle, renderInterior } from './render';

const bundle = bookBundle();
const passes = (bundle.passes ?? []).filter((p) => p.book);
const cards = new Map(bundle.cards.map((c) => [c.id, c]));

/** The drawable card for a card id or a variant id. */
function resolve(id: string): LensCard {
  const direct = cards.get(id);
  if (direct) return direct;
  for (const c of bundle.cards) {
    const v = c.variants.find((x) => x.id === id);
    if (v) return withVariant(c, v);
  }
  throw new Error(`unknown id ${id}`);
}

const unescape = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const numbers = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map(String);

describe('paperback books', () => {
  it('has the three Pass books', () => {
    expect(passes.map((p) => p.id).sort()).toEqual(['chugaku_juken', 'daigaku_juken', 'koukou_juken']);
  });

  describe.each(passes.map((p) => [p.id] as const))('%s', (passId) => {
    const { html, plan } = renderInterior(bundle, passId);
    const book = plan.book;
    const attr = (name: string) => new Set([...html.matchAll(new RegExp(`data-${name}="([^"]+)"`, 'g'))].map((m) => m[1]!));

    it('renders to HTML without throwing', () => {
      expect(() => renderInterior(bundle, passId)).not.toThrow();
      expect(html).toContain('<section class="page');
    });

    it('shows every example, boundary, practice, 類題 and review id', () => {
      const examples = attr('example');
      const boundaries = attr('boundary');
      const problems = attr('problem');
      const reviews = attr('review');
      for (const ch of book.chapters) {
        expect(examples).toContain(ch.example1);
        if (ch.example2) expect(examples).toContain(ch.example2);
        if (ch.boundary) expect(boundaries).toContain(ch.boundary);
        for (const p of ch.practice) {
          expect(problems).toContain(p.card);
          for (const v of p.variants) expect(problems).toContain(v);
        }
      }
      for (const r of book.review) expect(reviews).toContain(r.variant);
    });

    it('has an even page count within ±15% of page_estimate', () => {
      const pages = (html.match(/<section class="page /g) ?? []).length;
      expect(pages).toBe(plan.pages.length);
      expect(pages % 2).toBe(0);
      expect(Math.abs(pages - book.page_estimate)).toBeLessThanOrEqual(Math.ceil(book.page_estimate * 0.15));
    });

    it('prints each answer exactly as the card or variant gives it', () => {
      const printed = new Map([...html.matchAll(/data-answer-value="([^"]+)">([^<]*)</g)].map((m) => [m[1]!, unescape(m[2]!)]));
      const numbered = [...plan.chapters.flatMap((c) => c.practice), ...plan.review];
      expect(printed.size).toBe(numbered.length);
      for (const p of numbered) {
        const card = resolve(p.id);
        expect(printed.get(p.id)).toBe(answerText(card));
      }
    });

    it('numbers practice problems within each chapter and the answers use the same labels', () => {
      for (const ch of plan.chapters) ch.practice.forEach((p, i) => expect(p.num).toBe(i + 1));
      const labels = [...plan.chapters.flatMap((c) => c.practice), ...plan.review].map((p) => p.label);
      expect(new Set(labels).size).toBe(labels.length);
      for (const l of labels) expect(html).toContain(l);
    });

    it('no-math check: every number in a problem is in its text or figure fields', () => {
      const problems = [...plan.chapters.flatMap((c) => c.practice), ...plan.review];
      for (const p of problems) {
        const card = p.card;
        const source = new Set([...numbers(card.problem.text_ja), ...numbers(JSON.stringify(card.problem.figure))]);
        // The problem text is printed verbatim from the bundle.
        expect(html).toContain(card.problem.text_ja.replace(/&/g, '&amp;'));
        const fig = renderFigure(card, 'problem', bundle.tokens);
        if (!fig.svg) continue;
        const texts = [...fig.svg.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) => unescape(m[1]!.replace(/<[^>]+>/g, '')));
        for (const n of texts.flatMap(numbers)) expect(source, `${p.id} prints ${n}`).toContain(n);
      }
    });
  });

  it('plans the chugaku_juken book from the bundle (8 chapters, 16 review items)', () => {
    const plan = planBook(bundle, 'chugaku_juken');
    expect(plan.chapters.length).toBe(plan.book.chapters.length);
    expect(plan.review.length).toBe(plan.book.review.length);
    expect(plan.pages[0]!.kind).toBe('title');
    expect(plan.pages.at(-1)!.kind).toBe('colophon');
    // Example spreads open on a left (even) page.
    plan.pages.forEach((pg, i) => {
      if (pg.kind === 'spread') expect((i + 1) % 2 === 0).toBe(pg.side === 'left');
    });
  });
});
