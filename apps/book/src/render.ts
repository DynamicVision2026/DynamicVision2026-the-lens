// One HTML document per book (interior) and one for its cover. No browser needed: tests use these directly.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadBundle } from '@lens/scenes';
import { Interior, type RenderLog } from './Book';
import { Cover, coverCss, coverGeometry, type CoverGeometry, type KdpConfig } from './Cover';
import { CROP_SCRIPT } from './crop';
import { fontFaceCss } from './fonts';
import { planBook, type BookPlan } from './plan';
import { interiorCss } from './styles';
import type { BookBundle } from './types';

export function bookBundle(): BookBundle {
  return loadBundle() as unknown as BookBundle;
}

export interface RenderOptions {
  /** Publication date for the colophon (YYYY-MM-DD). */
  date?: string | null;
  /** Embed @font-face rules for the PDF (off in tests). */
  fonts?: boolean;
}

export interface InteriorResult {
  html: string;
  plan: BookPlan;
  log: RenderLog;
}

function doc(title: string, css: string, body: string, fonts: boolean): string {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>${title}</title>
<style>${fonts ? fontFaceCss() : ''}
${css}</style></head>
<body>${body}<script>${CROP_SCRIPT}</script></body></html>
`;
}

export function renderInterior(bundle: BookBundle, passId: string, opts: RenderOptions = {}): InteriorResult {
  const plan = planBook(bundle, passId);
  const log: RenderLog = { placeholders: new Map() };
  const ctx = { bundle, tokens: bundle.tokens, plan, log, date: opts.date ?? null };
  const body = renderToStaticMarkup(createElement(Interior, { ctx }));
  return { html: doc(plan.book.title_ja, interiorCss(bundle.tokens), body, opts.fonts ?? false), plan, log };
}

export function renderCover(bundle: BookBundle, plan: BookPlan, kdp: KdpConfig, opts: RenderOptions = {}): { html: string; geometry: CoverGeometry } {
  const geometry = coverGeometry(bundle.tokens, kdp, plan.book.id, plan.pages.length);
  const body = renderToStaticMarkup(createElement(Cover, { bundle, plan, g: geometry }));
  return { html: doc(plan.book.title_ja, coverCss(bundle.tokens, geometry, kdp), body, opts.fonts ?? false), geometry };
}
