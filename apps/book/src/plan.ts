// Turns `passes[].book` into an ordered list of pages (WO-021 §2). Pure data: no rendering here.
import { answerText, withVariant, type LensCard, type LensId } from '@lens/scenes';
import { circled, COPY } from './copy';
import type { Book, BookBundle, BookChapter } from './types';

/** One numbered problem (a practice card, its 類題, or a review item), already merged with its variant. */
export interface Problem {
  /** Card id or variant id. */
  id: string;
  card: LensCard;
  base: LensCard;
  variant: boolean;
  num: number;
  /** e.g. 「囲む ⑤」 or 「総まとめ ③」; the answers use the same label. */
  label: string;
}

export interface ChapterPlan {
  no: number;
  chapter: BookChapter;
  lensName: string;
  examples: LensCard[];
  boundary: LensCard | null;
  practice: Problem[];
}

export type Page =
  | { kind: 'title' }
  | { kind: 'hajimeni' }
  | { kind: 'tsukaikata' }
  | { kind: 'contents' }
  | { kind: 'opener'; ch: ChapterPlan }
  | { kind: 'spread'; side: 'left' | 'right'; ch: ChapterPlan; exampleNo: number; card: LensCard }
  | { kind: 'boundary'; ch: ChapterPlan; card: LensCard }
  | { kind: 'practice'; ch: ChapterPlan; items: Problem[]; first: boolean }
  | { kind: 'review'; items: Problem[]; first: boolean }
  | { kind: 'answers'; items: Problem[]; first: boolean }
  | { kind: 'memo' }
  | { kind: 'colophon' };

export interface BookPlan {
  passId: string;
  book: Book;
  chapters: ChapterPlan[];
  review: Problem[];
  pages: Page[];
  /** Contents entries with their (1-based) page numbers. */
  toc: { label: string; page: number }[];
}

export const PER_PAGE = { practice: 2, review: 4, answers: 6 } as const;

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

export function lensName(bundle: BookBundle, lens: string): string {
  return bundle.labels.lenses[lens]?.ja ?? lens;
}

/** The move a problem is solved with: the picker's correct option (e.g. "direct"), else the card's lens. */
export function solvingLens(card: LensCard): LensId | 'direct' {
  return (card.picker?.correct as LensId | 'direct' | undefined) ?? card.lens;
}

/** The printed answer: `display_ja` for a card; the variant's exact answer plus the card unit. */
export function answerOf(problem: Problem): string {
  return answerText(problem.card);
}

export function planBook(bundle: BookBundle, passId: string): BookPlan {
  const pass = bundle.passes?.find((p) => p.id === passId);
  if (!pass) throw new Error(`No pass "${passId}" in build/bundle.json`);
  const book = pass.book;
  if (!book) throw new Error(`Pass "${passId}" has no book`);

  const cards = new Map(bundle.cards.map((c) => [c.id, c]));
  const card = (id: string): LensCard => {
    const c = cards.get(id);
    if (!c) throw new Error(`book ${book.id}: card "${id}" is not in the bundle`);
    return c;
  };
  const variantOf = (cardId: string, variantId: string): LensCard => {
    const base = card(cardId);
    const v = base.variants.find((x) => x.id === variantId);
    if (!v) throw new Error(`book ${book.id}: variant "${variantId}" is not on card "${cardId}"`);
    return withVariant(base, v);
  };

  const chapters: ChapterPlan[] = book.chapters.map((chapter, i) => {
    const name = lensName(bundle, chapter.lens);
    const practice: Problem[] = [];
    for (const p of chapter.practice) {
      const base = card(p.card);
      const push = (c: LensCard, variant: boolean) =>
        practice.push({ id: c.id, card: c, base, variant, num: practice.length + 1, label: `${name} ${circled(practice.length + 1)}` });
      push(base, false);
      for (const v of p.variants) push(variantOf(p.card, v), true);
    }
    return {
      no: i + 1,
      chapter,
      lensName: name,
      examples: [chapter.example1, chapter.example2].filter((x): x is string => !!x).map(card),
      boundary: chapter.boundary ? card(chapter.boundary) : null,
      practice,
    };
  });

  const review: Problem[] = book.review.map((r, i) => ({
    id: r.variant,
    card: variantOf(r.card, r.variant),
    base: card(r.card),
    variant: true,
    num: i + 1,
    label: `${COPY.reviewShort} ${circled(i + 1)}`,
  }));

  // Page order. Page 1 is a right-hand page, so odd pages are right-hand (recto) pages.
  const pages: Page[] = [{ kind: 'title' }, { kind: 'hajimeni' }, { kind: 'tsukaikata' }, { kind: 'contents' }];
  const toc: { label: string; page: number }[] = [];
  const padTo = (parity: 'odd' | 'even') => {
    const next = pages.length + 1;
    if ((next % 2 === 1) !== (parity === 'odd')) pages.push({ kind: 'memo' });
  };
  for (const ch of chapters) {
    // The opener is a right-hand page, so each example spread opens on a left (even) page.
    padTo('odd');
    toc.push({ label: `${COPY.chapter(ch.no)}　${ch.lensName}`, page: pages.length + 1 });
    pages.push({ kind: 'opener', ch });
    ch.examples.forEach((c, i) => {
      padTo('even');
      pages.push({ kind: 'spread', side: 'left', ch, exampleNo: i + 1, card: c });
      pages.push({ kind: 'spread', side: 'right', ch, exampleNo: i + 1, card: c });
    });
    if (ch.boundary) pages.push({ kind: 'boundary', ch, card: ch.boundary });
    chunk(ch.practice, PER_PAGE.practice).forEach((items, i) => pages.push({ kind: 'practice', ch, items, first: i === 0 }));
  }
  if (review.length > 0) {
    toc.push({ label: COPY.review, page: pages.length + 1 });
    chunk(review, PER_PAGE.review).forEach((items, i) => pages.push({ kind: 'review', items, first: i === 0 }));
  }
  toc.push({ label: COPY.answers, page: pages.length + 1 });
  const answers = [...chapters.flatMap((c) => c.practice), ...review];
  chunk(answers, PER_PAGE.answers).forEach((items, i) => pages.push({ kind: 'answers', items, first: i === 0 }));
  // The colophon is the last page and the page count must be even.
  if ((pages.length + 1) % 2 === 1) pages.push({ kind: 'memo' });
  pages.push({ kind: 'colophon' });

  return { passId, book, chapters, review, pages, toc };
}
