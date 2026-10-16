// Shapes of `passes[].book` and `tokens.layout.book` (bundle 1.3, WO-021). @lens/scenes' types predate
// them, so the book reads them through these local interfaces.
import type { Bundle, LensId, Pass, Tokens } from '@lens/scenes';

export type BookStatus = 'planned' | 'building' | 'proof' | 'live';

export interface BookChapter {
  lens: LensId;
  principle_ja: string | null;
  example1: string;
  example2: string | null;
  boundary: string | null;
  boundary_line: string | null;
  practice: { card: string; variants: string[] }[];
  qr: string | null;
}

export interface Book {
  id: string;
  status: BookStatus;
  series_ja: string;
  title_ja: string;
  subtitle_ja: string;
  audience_ja: string;
  author_ja: string;
  publisher_ja: string;
  interior: 'bw' | 'standard_color';
  amazon_url: string | null;
  /** KDP list price in yen, tax included (WO-027 §5). */
  price_jpy?: number | null;
  practice_variants: number;
  page_estimate: number;
  front_matter: {
    hajimeni_ja: string;
    tsukaikata_ja: string[];
    qr_ja: string;
    honesty_ja: string;
    parent_ja: string;
  };
  chapters: BookChapter[];
  review: { card: string; variant: string }[];
}

export interface BookLayout {
  trim?: string;
  spread?: { left: string; right: string; bottom_bar: string };
  margin_mm: { inner: number; outer: number; top: number; bottom: number };
  bleed_mm: number;
}

export type BookPass = Pass & { book?: Book };
export type BookTokens = Tokens & { layout: Tokens['layout'] & { book: BookLayout } };
export type BookBundle = Omit<Bundle, 'passes' | 'tokens'> & { passes?: BookPass[]; tokens: BookTokens };
