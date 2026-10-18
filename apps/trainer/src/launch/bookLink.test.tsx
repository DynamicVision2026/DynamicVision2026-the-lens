// WO-026 §5: 「紙の問題集（Amazon）」 shows only when the Pass's book is live with an Amazon URL.
import { loadBundle } from '@lens/scenes';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n/ja';
import { BookLink, bookUrl } from './BookLink';
import { LANDING } from './copy';
import { Books, Courses } from './Landing';

const AMAZON = 'https://www.amazon.co.jp/dp/B000000000';

afterEach(() => vi.restoreAllMocks());

/** The bundle with only one Pass's book live (the others back in proof). */
function liveBundle(passId: string) {
  const b = loadBundle();
  const book = (p: object) => (p as { book?: object }).book;
  return {
    ...b,
    passes: b.passes!.map((p) =>
      p.id === passId ? { ...p, book: { ...book(p), status: 'live', amazon_url: AMAZON } } : { ...p, book: { ...book(p), status: 'proof', amazon_url: null } },
    ),
  };
}

describe('paperback link (WO-026 §5)', () => {
  it('needs both status live and an amazon_url', () => {
    expect(bookUrl({ status: 'live', amazon_url: AMAZON })).toBe(AMAZON);
    expect(bookUrl({ status: 'proof', amazon_url: AMAZON })).toBeNull();
    expect(bookUrl({ status: 'live', amazon_url: null })).toBeNull();
    expect(bookUrl(undefined)).toBeNull();
  });

  it('as shipped: all three books are live on Amazon', () => {
    expect(renderToStaticMarkup(<BookLink passId="chugaku_juken" />)).toContain('href="https://www.amazon.co.jp/dp/B0HN7PVL1K"');
    expect(renderToStaticMarkup(<BookLink passId="koukou_juken" />)).toContain('href="https://www.amazon.co.jp/dp/B0HN81B2JY"');
    expect(renderToStaticMarkup(<BookLink passId="daigaku_juken" />)).toContain('href="https://www.amazon.co.jp/dp/B0HNFWS6MJ"');
    expect(renderToStaticMarkup(<Courses />).split(t('book.amazon')).length - 1).toBe(3);
  });

  it('books section: a card per book with its cover, each linking to Amazon', () => {
    const html = renderToStaticMarkup(<Books />);
    expect(html).toContain('id="books"');
    expect(html.split('class="lp2-bookcard"').length - 1).toBe(3);
    for (const id of ['lens-book-chugaku-1', 'lens-book-koukou-1', 'lens-book-daigaku-1']) expect(html).toContain(`src="/books/${id}.jpg"`);
    expect(html.split(LANDING.books.buy).length - 1).toBe(3);
    expect(html.split(LANDING.books.soon).length - 1).toBe(0);
    expect(html).toContain('¥2,580（税込）');
    expect(html.match(/target="_blank" rel="noopener"/g)?.length).toBe(3);
  });

  it('books section stays hidden while no book is live', async () => {
    const scenes = await import('@lens/scenes');
    const b = loadBundle();
    const none = { ...b, passes: b.passes!.map((p) => ({ ...p, book: { ...(p as { book?: object }).book, status: 'proof', amazon_url: null } })) };
    vi.spyOn(scenes, 'loadBundle').mockReturnValue(none as ReturnType<typeof loadBundle>);
    expect(renderToStaticMarkup(<Books />)).toBe('');
  });

  it('once live: a new-tab link on that Pass card only', async () => {
    const scenes = await import('@lens/scenes');
    vi.spyOn(scenes, 'loadBundle').mockReturnValue(liveBundle('koukou_juken') as ReturnType<typeof loadBundle>);
    const link = renderToStaticMarkup(<BookLink passId="koukou_juken" />);
    expect(link).toContain(`href="${AMAZON}"`);
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener"');
    expect(link).toContain(t('book.amazon'));
    expect(renderToStaticMarkup(<BookLink passId="chugaku_juken" />)).toBe('');
    expect(renderToStaticMarkup(<Courses />).split(t('book.amazon')).length - 1).toBe(1);
  });
});
