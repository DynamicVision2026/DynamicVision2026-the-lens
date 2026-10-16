// WO-026 §5: 「紙の問題集（Amazon）」 shows only when the Pass's book is live with an Amazon URL.
import { loadBundle } from '@lens/scenes';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n/ja';
import { BookLink, bookUrl } from './BookLink';
import { Courses } from './Landing';

const AMAZON = 'https://www.amazon.co.jp/dp/B000000000';

afterEach(() => vi.restoreAllMocks());

/** The bundle with one Pass's book set live. */
function liveBundle(passId: string) {
  const b = loadBundle();
  return { ...b, passes: b.passes!.map((p) => (p.id === passId ? { ...p, book: { ...(p as { book?: object }).book, status: 'live', amazon_url: AMAZON } } : p)) };
}

describe('paperback link (WO-026 §5)', () => {
  it('needs both status live and an amazon_url', () => {
    expect(bookUrl({ status: 'live', amazon_url: AMAZON })).toBe(AMAZON);
    expect(bookUrl({ status: 'proof', amazon_url: AMAZON })).toBeNull();
    expect(bookUrl({ status: 'live', amazon_url: null })).toBeNull();
    expect(bookUrl(undefined)).toBeNull();
  });

  it('shows nothing today (every book is still in proof)', () => {
    for (const p of loadBundle().passes!) expect(renderToStaticMarkup(<BookLink passId={p.id} />)).toBe('');
    expect(renderToStaticMarkup(<Courses />)).not.toContain(t('book.amazon'));
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
