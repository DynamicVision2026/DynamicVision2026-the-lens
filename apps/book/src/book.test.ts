// WO-021 §4: every book renders to HTML (no browser), carries every referenced id, stays near its page
// estimate, prints no number that is not in the problem, and prints each answer from the bundle.
import { describe, expect, it } from 'vitest';
import { answerText, withVariant, type LensCard } from '@lens/scenes';
import { titleLines } from './copy';
import { readFileSync } from 'node:fs';
import type { KdpConfig } from './Cover';
import { renderFigure } from './figure';
import { DESCRIPTION_MAX, description, listingSheet } from './listing';
import { planBook } from './plan';
import { bookBundle, renderCover, renderInterior } from './render';

const bundle = bookBundle();
const passes = (bundle.passes ?? []).filter((p) => p.book);
const cards = new Map(bundle.cards.map((c) => [c.id, c]));
const kdp = JSON.parse(readFileSync(new URL('../kdp.json', import.meta.url), 'utf8')) as KdpConfig;

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
    const rendered = renderInterior(bundle, passId);
    const { plan } = rendered;
    // Unbreakable math spans (WO-026 §7) wrap text but never change it: read the HTML without them.
    const html = rendered.html.replace(/<span class="nb">([^<]*)<\/span>/g, '$1');
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
      // WO-026 §7 SHOULD 10: boundary pages have their answers too.
      const numbered = [...plan.chapters.flatMap((c) => [...(c.boundaryAnswer ? [c.boundaryAnswer] : []), ...c.practice]), ...plan.review];
      expect(printed.size).toBe(numbered.length);
      for (const ch of plan.chapters) if (ch.boundary) expect(printed.has(`boundary-${ch.boundary.id}`)).toBe(true);
      for (const p of numbered) {
        const card = p.id.startsWith('boundary-') ? resolve(p.id.slice('boundary-'.length)) : resolve(p.id);
        expect(printed.get(p.id)).toBe(answerText(card));
      }
    });

    it('prints the answer on the right page of every example (WO-026 §7 SHOULD 9)', () => {
      const printed = new Map([...html.matchAll(/data-example-answer="([^"]+)"><span class="k">[^<]*<\/span>([^<]*)</g)].map((m) => [m[1]!, unescape(m[2]!)]));
      for (const ch of plan.chapters) for (const ex of ch.examples) expect(printed.get(ex.id), ex.id).toBe(answerText(ex));
    });

    // WO-026 §3: KDP minimum 24 pages, even, and the book's own kdp.json entry (KDP's white-paper spine).
    it('has a kdp.json entry for its page count, spine width and spine text', () => {
      const pages = plan.pages.length;
      expect(pages).toBeGreaterThanOrEqual(24);
      const e = kdp.books[book.id]!;
      expect(e, book.id).toBeDefined();
      expect(e.pages).toBe(pages);
      expect(e.spine_mm).toBeCloseTo(pages * kdp.spine_mm_per_page, 2);
      expect(e.spine_text).toBe(pages >= kdp.spine_text_min_pages);
      const { geometry } = renderCover(bundle, plan, kdp);
      expect(geometry.spine).toBe(e.spine_mm);
    });

    // WO-026 §4: docs/kdp/<book.id>.md is the generated sheet (run `pnpm book <passId>` after a change).
    it('has its KDP listing sheet, up to date, with 内容紹介 within 4,000 characters', () => {
      expect(description(plan).length).toBeLessThanOrEqual(DESCRIPTION_MAX);
      for (const ch of plan.chapters) expect(description(plan)).toContain(ch.lensName);
      const committed = readFileSync(new URL(`../../../docs/kdp/${book.id}.md`, import.meta.url), 'utf8');
      expect(committed).toBe(listingSheet(plan));
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
        // Axis tick numbers (data-tick, WO-020 coordinate figures) are the scale, not values of the problem.
        const texts = [...fig.svg.matchAll(/<text(?![^>]*data-tick)[^>]*>([\s\S]*?)<\/text>/g)].map((m) => unescape(m[1]!.replace(/<[^>]+>/g, '')));
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

  it('draws every Stage 1 figure: no 「図（準備中）」 placeholder in chugaku_juken', () => {
    const { html, log } = renderInterior(bundle, 'chugaku_juken');
    expect([...log.placeholders.keys()]).toEqual([]);
    expect(html).not.toContain('class="fig-pending"');
  });

  // WO-023: the Stage 2/3 figures are drawn too (the steps-only word problem prints no picture by design).
  it.each(['koukou_juken', 'daigaku_juken'])('draws every figure: no 「図（準備中）」 placeholder in %s', (passId) => {
    const { html, log } = renderInterior(bundle, passId);
    expect([...log.placeholders.keys()]).toEqual([]);
    expect(html).not.toContain('class="fig-pending"');
  });

  it('draws the water/salt lever and the chase road solved (WO-015/017 end states)', () => {
    for (const id of ['balance-002', 'balance-003', 'freeze-002']) {
      const card = resolve(id);
      const solved = renderFigure(card, 'solved', bundle.tokens);
      expect(solved.svg, id).toContain('<svg');
      expect(solved.svg).toContain(answerText(card).replace(/[^0-9]/g, '').slice(0, 1));
      // Like every word problem, the problem itself is only its sentence.
      expect(renderFigure(card, 'problem', bundle.tokens).none).toBe(true);
    }
  });

  it('cover: title breaks before ワークブック, and the front figure prints no answer or formula', () => {
    expect(titleLines('視点レンズ 中学受験算数ワークブック')).toEqual(['視点レンズ 中学受験算数', 'ワークブック']);
    expect(titleLines('次元を落とす')).toEqual(['次元を落とす']);
    const plan = planBook(bundle, 'chugaku_juken');
    const { html } = renderCover(bundle, plan, kdp);
    const first = plan.chapters[0]!.examples[0]!;
    const front = html.slice(html.indexOf('class="panel front"'));
    const texts = [...front.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1]!.replace(/<[^>]+>/g, ''));
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) {
      expect(t).not.toMatch(/[=＝]/);
      expect(t).not.toBe(answerText(first));
    }
    expect(front).toContain('<span class="line">ワークブック</span>');
  });
});
