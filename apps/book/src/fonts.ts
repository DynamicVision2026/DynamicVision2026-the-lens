// Embedded fonts (SIL OFL) for the PDF: @fontsource CSS with its url(./files/…) rewritten to absolute
// file URLs, so Chromium embeds the subsets the book uses. Headings and figures use the token families
// (Noto Sans JP, Inter, Klee One); body text uses Noto Serif JP (WO-021 §2).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Body family for the book. tokens.json has no book body token yet (stub: architect issue to add
 * `type.family_book`); the name is the one @fontsource/noto-serif-jp registers.
 */
export const BODY_FAMILY = 'Noto Serif JP';

const FACES: [pkg: string, weights: number[]][] = [
  ['@fontsource/noto-serif-jp', [400, 700]],
  ['@fontsource/noto-sans-jp', [400, 500, 700]],
  ['@fontsource/inter', [400, 500, 700]],
  ['@fontsource/klee-one', [400]],
];

export function fontFaceCss(): string {
  const require = createRequire(import.meta.url);
  const out: string[] = [];
  for (const [pkg, weights] of FACES) {
    for (const w of weights) {
      const cssPath = require.resolve(`${pkg}/${w}.css`);
      const filesUrl = pathToFileURL(join(dirname(cssPath), 'files')).href;
      // woff2 only: every Chromium reads it, and it keeps the stylesheet small.
      out.push(
        readFileSync(cssPath, 'utf8')
          .replace(/url\(\.\/files\/([^)]+)\)/g, (_m, f: string) => `url(${filesUrl}/${f})`)
          .replace(/,\s*url\([^)]+\.woff\) format\('woff'\)/g, ''),
      );
    }
  }
  return out.join('\n');
}
