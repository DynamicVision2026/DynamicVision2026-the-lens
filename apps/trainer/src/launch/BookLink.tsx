// WO-021 §5 / WO-026 §5: 「紙の問題集（Amazon）」, only once the Pass's paperback is live on Amazon
// (book.status === 'live' and amazon_url set in catalog/<pass>/book.yaml). Nothing shows before that.
import { loadBundle } from '@lens/scenes';
import { t } from '../i18n/ja';
import { track } from './analytics';

export interface BookInfo {
  id?: string;
  status?: string;
  amazon_url?: string | null;
  title_ja?: string;
  subtitle_ja?: string;
  audience_ja?: string;
  price_jpy?: number | null;
}

/** The Amazon link of a Pass's book, or null while the book is not live. */
export function bookUrl(book: BookInfo | null | undefined): string | null {
  return book?.status === 'live' && book.amazon_url ? book.amazon_url : null;
}

export function passBook(passId: string): BookInfo | undefined {
  return (loadBundle().passes?.find((p) => p.id === passId) as { book?: BookInfo } | undefined)?.book;
}

export function BookLink({ passId, className }: { passId: string; className?: string }) {
  const url = bookUrl(passBook(passId));
  if (!url) return null;
  return (
    <a className={className ?? 'book-link'} href={url} target="_blank" rel="noopener" onClick={() => track({ name: 'book_click', params: { pass: passId } })}>
      {t('book.amazon')}
    </a>
  );
}
