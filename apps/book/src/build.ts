// pnpm --filter @lens/book build <passId> [--date YYYY-MM-DD]
//   → apps/book/dist/<book.id>/interior.html, interior.pdf, cover.html, cover.pdf
// HTML from React SSR, PDF from Playwright Chromium (same approach as tools/print_pdf.mjs).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { KdpConfig } from './Cover';
import { bookBundle, renderCover, renderInterior } from './render';

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FALLBACK_CHROMIUM = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell.real';

type Browser = Awaited<ReturnType<typeof import('playwright')['chromium']['launch']>>;

async function launch(): Promise<Browser> {
  const { chromium } = await import('playwright');
  if (process.env.CHROMIUM) return chromium.launch({ executablePath: process.env.CHROMIUM });
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ executablePath: FALLBACK_CHROMIUM });
  }
}

async function toPdf(browser: Browser, htmlPath: string, pdfPath: string): Promise<{ overflow: number[] }> {
  const page = await browser.newPage();
  await page.goto('file://' + htmlPath, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector('html[data-cropped]', { state: 'attached' });
  // Pages whose content runs past the bottom margin (overflow is clipped, so report it).
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll('section.page'))
      .filter((s) => {
        const body = s.querySelector('.body') as HTMLElement | null;
        if (!body) return false;
        const limit = body.getBoundingClientRect().bottom + 0.5;
        return Array.from(body.querySelectorAll('*')).some((el) => el.getBoundingClientRect().bottom > limit);
      })
      .map((s) => Number((s as HTMLElement).dataset.page)),
  );
  await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
  await page.close();
  return { overflow };
}

export async function main(argv: string[]): Promise<number> {
  const args = argv.filter((a) => !a.startsWith('--'));
  const dateIdx = argv.indexOf('--date');
  const date = dateIdx >= 0 ? argv[dateIdx + 1] ?? null : null;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error(`--date must be YYYY-MM-DD (got "${date}")`);
    return 1;
  }
  const passId = args.filter((a) => a !== date)[0];
  const bundle = bookBundle();
  if (!passId) {
    console.error(`usage: pnpm book <passId> [--date YYYY-MM-DD]\npasses with a book: ${(bundle.passes ?? []).filter((p) => p.book).map((p) => p.id).join(', ')}`);
    return 1;
  }
  const kdp = JSON.parse(readFileSync(join(APP_DIR, 'kdp.json'), 'utf8')) as KdpConfig;
  const interior = renderInterior(bundle, passId, { date, fonts: true });
  const { book } = interior.plan;
  const cover = renderCover(bundle, interior.plan, kdp, { fonts: true });

  const out = join(APP_DIR, 'dist', book.id);
  mkdirSync(out, { recursive: true });
  const files = {
    interiorHtml: join(out, 'interior.html'),
    interiorPdf: join(out, 'interior.pdf'),
    coverHtml: join(out, 'cover.html'),
    coverPdf: join(out, 'cover.pdf'),
  };
  writeFileSync(files.interiorHtml, interior.html);
  writeFileSync(files.coverHtml, cover.html);

  const pages = interior.plan.pages.length;
  const est = book.page_estimate;
  console.log(`book ${book.id} (${passId}, ${book.status}): ${pages} pages (estimate ${est}, ${(((pages - est) / est) * 100).toFixed(0)}%)`);
  if (pages < 24) console.log(`  NOTE  ${pages} pages is under the KDP minimum of 24`);
  console.log(`  cover: ${cover.geometry.width.toFixed(1)} × ${cover.geometry.height.toFixed(1)} mm, spine ${cover.geometry.spine} mm (kdp.json placeholder), spine text ${cover.geometry.spineText ? 'on' : 'off'}`);
  if (interior.log.placeholders.size > 0) {
    console.log(`  figures not drawable yet (「図（準備中）」 placeholder): ${interior.log.placeholders.size}`);
    for (const [id, reason] of interior.log.placeholders) console.log(`    ${id}  (${reason})`);
  }

  const browser = await launch();
  try {
    const r = await toPdf(browser, files.interiorHtml, files.interiorPdf);
    await toPdf(browser, files.coverHtml, files.coverPdf);
    if (r.overflow.length > 0) console.log(`  WARN  content runs past the bottom margin on pages: ${r.overflow.join(', ')}`);
  } finally {
    await browser.close();
  }
  for (const f of Object.values(files)) console.log(`  ${f}`);
  return 0;
}
