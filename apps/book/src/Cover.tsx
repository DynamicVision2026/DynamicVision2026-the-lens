// KDP full-wrap cover: back + spine + front with bleed (WO-021 §3). Spine width comes from kdp.json.
// Design (Oct 16): the landing page's palette (tokens color.landing, WO-024): ground, navy text, the
// course's band colour and lens colour per book, the series word 視点レンズ large enough to read as an
// Amazon thumbnail, the first example seen through a lens, and the book's 8 lenses as coloured chips. The cover is printed in colour by KDP even for a B&W interior.
import { renderToStaticMarkup } from 'react-dom/server';
import { LensIcon, lensColor, type Tokens } from '@lens/scenes';
import { COPY, SITE_URL, sentences, titleLines } from './copy';
import { renderFigure } from './figure';
import type { BookPlan } from './plan';
import { printPalette } from './print';
import { qrSvg } from './qr';
import { figureFontCss, TRIM_MM } from './styles';
import type { BookBundle, BookTokens } from './types';

/** One book's KDP entry (WO-026 §3): its page count, spine width and whether the spine carries text. */
export interface KdpBook {
  pages: number;
  spine_mm: number;
  spine_text: boolean;
}

export interface KdpConfig {
  spine_mm_per_page: number;
  spine_text_min_pages: number;
  barcode_mm: { width: number; height: number; margin: number };
  books: Record<string, KdpBook>;
}

/** The book's own kdp.json entry; throws when it is missing or was made for another page count. */
export function kdpBook(kdp: KdpConfig, bookId: string, pageCount: number): KdpBook {
  const e = kdp.books[bookId];
  if (!e) throw new Error(`kdp.json has no entry for "${bookId}"`);
  if (e.pages !== pageCount) {
    const spine = Math.round(pageCount * kdp.spine_mm_per_page * 100) / 100;
    throw new Error(`kdp.json "${bookId}" is for ${e.pages} pages but the book has ${pageCount}: set pages ${pageCount}, spine_mm ${spine}, spine_text ${pageCount >= kdp.spine_text_min_pages}`);
  }
  return e;
}

export interface CoverGeometry {
  bleed: number;
  spine: number;
  width: number;
  height: number;
  spineText: boolean;
}

export function coverGeometry(t: BookTokens, kdp: KdpConfig, bookId: string, pageCount: number): CoverGeometry {
  const bleed = t.layout.book.bleed_mm;
  const e = kdpBook(kdp, bookId, pageCount);
  return {
    bleed,
    spine: e.spine_mm,
    width: 2 * bleed + 2 * TRIM_MM.width + e.spine_mm,
    height: 2 * bleed + TRIM_MM.height,
    spineText: e.spine_text,
  };
}

/** The first two sentences of はじめに for the back cover, ending at 「。」 (WO-026 §7). */
function excerpt(text: string): string {
  return sentences(text, 2);
}

/** Each book in its course's landing colours (tokens color.landing): the band and the lens of its course card. */
const BOOK_STYLE: Record<string, { band: string; lens: string; label: string }> = {
  chugaku_juken: { band: 'band_chugaku', lens: 'enclose', label: '小5・小6・算数' },
  koukou_juken: { band: 'band_koukou', lens: 'slide', label: '中1〜中3・数学' },
  daigaku_juken: { band: 'band_daigaku', lens: 'balance', label: '高1〜高3・数学' },
};

export interface CoverStyle {
  ground: string;
  card: string;
  navy: string;
  text: string;
  muted: string;
  onNavy: string;
  line: string;
  band: string;
  accent: string;
  label: string;
}

/** The landing page's palette (WO-024, Lens.dc.html) for one book. */
export function coverStyle(t: BookTokens, passId: string): CoverStyle {
  const L = ((t.color as unknown as Record<string, unknown>).landing ?? {}) as Record<string, { value: string }>;
  const v = (k: string, d: string) => L[k]?.value ?? d;
  const st = BOOK_STYLE[passId] ?? BOOK_STYLE.chugaku_juken!;
  return {
    ground: v('ground', '#EEF0F4'),
    card: v('card', '#FFFFFF'),
    navy: v('navy', '#1B1F3A'),
    text: v('text', '#3A4170'),
    muted: v('muted', '#5B628F'),
    onNavy: v('on_navy', '#C9CDEA'),
    line: v('line', '#D9DCE6'),
    band: v(st.band, '#A9D8F2'),
    accent: lensColor(t as unknown as Tokens, st.lens as never),
    label: st.label,
  };
}

export function coverCss(t: BookTokens, g: CoverGeometry, kdp: KdpConfig, k: CoverStyle = coverStyle(t, 'chugaku_juken')): string {
  const c = printPalette(t);
  const sans = `"${t.type.family_ja}", sans-serif`;
  const num = `"${t.type.family_num}", "${t.type.family_ja}", sans-serif`;
  const safe = 6.35; // KDP keeps text 0.25 in inside the trim.
  const pad = safe + 6;
  const panel = TRIM_MM.width;
  const bandH = 112; // mm from the trim top: the course-card band
  const lensD = 92;
  const spineFont = Math.min(9, Math.max(5, g.spine * 1.1));
  return `
@page { size: ${g.width}mm ${g.height}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: ${k.ground}; color: ${k.navy}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.cover { position: relative; width: ${g.width}mm; height: ${g.height}mm; overflow: hidden; font-family: ${sans}; background: ${k.ground}; }
.panel { position: absolute; top: ${g.bleed}mm; width: ${panel}mm; height: ${TRIM_MM.height}mm; padding: ${pad}mm; display: flex; flex-direction: column; }
.back { left: ${g.bleed}mm; }
.front { left: ${g.bleed + panel + g.spine}mm; }
.front .band { position: absolute; left: 0; right: -${g.bleed}mm; top: -${g.bleed}mm; height: ${g.bleed + bandH}mm; background: ${k.band}; }
.front > * { position: relative; }
.front .band { position: absolute; }
.front .top { display: flex; justify-content: space-between; align-items: center; }
.front .logo { display: flex; align-items: center; gap: 2mm; font-size: 11pt; font-weight: 900; letter-spacing: 0.04em; color: ${k.navy}; }
.front .logo svg { width: 7mm; height: 7mm; color: ${k.navy}; }
.front .lvl { background: ${k.card}; color: ${k.navy}; border-radius: 10mm; padding: 1.2mm 4mm; font-size: 9pt; font-weight: 700; letter-spacing: 0.04em; }
.front h1 { margin: 9mm 0 0; font-weight: 900; line-height: 1.1; word-break: keep-all; color: ${k.navy}; }
.front h1 .big { display: block; font-size: 66pt; letter-spacing: -0.01em; }
.front h1 .rest { display: inline-block; margin-top: 4mm; font-size: 22pt; font-weight: 900; letter-spacing: 0.02em;
  background: linear-gradient(transparent 58%, ${k.card} 58%, ${k.card} 92%, transparent 92%); padding: 0 1mm; }
.front h1 .line { display: inline; }
.front .sub { margin-top: 3.5mm; font-size: 13pt; font-weight: 700; color: ${k.text}; letter-spacing: 0.02em; }
.front .stage { flex: 1; display: flex; align-items: center; justify-content: center; }
.front .lens { width: ${lensD}mm; height: ${lensD}mm; border-radius: 50%; background: ${c.paper}; border: 2.4mm solid ${k.accent};
  box-shadow: 0 0 0 2.2mm ${k.card}, 0 0 0 2.8mm ${k.line}; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.front .lens .fig { width: ${lensD * 0.66}mm; }
.front .lens .fig svg { display: block; width: 100%; height: auto; max-height: ${lensD * 0.66}mm; }
.front .chips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2.2mm 2.6mm; }
.front .chip { text-align: center; border-radius: 10mm; padding: 1.8mm 2mm; font-size: 10pt; font-weight: 700; color: #FFFFFF; white-space: nowrap; }
.front .foot { margin-top: 6mm; display: flex; justify-content: space-between; align-items: baseline; font-size: 9.5pt; color: ${k.muted}; }
.front .foot .author { font-family: ${num}; font-size: 13pt; font-weight: 700; color: ${k.navy}; letter-spacing: 0.04em; }

.spine { position: absolute; top: 0; left: ${g.bleed + panel}mm; width: ${g.spine}mm; height: ${g.height}mm; background: ${k.navy}; }
.spine .bar { position: absolute; left: 0; right: 0; top: 0; height: ${g.bleed + 26}mm; background: ${k.band}; }
.spine .txt { position: absolute; left: 0; right: 0; top: ${g.bleed + 34}mm; bottom: ${g.bleed + 12}mm; display: flex; align-items: flex-start; justify-content: center;
  writing-mode: vertical-rl; font-size: ${spineFont}pt; font-weight: 700; letter-spacing: 0.08em; color: #FFFFFF; white-space: nowrap; }
.spine .txt .au { margin-top: auto; font-weight: 500; color: ${k.onNavy}; }

.back .label { font-size: 9pt; font-weight: 700; letter-spacing: 0.12em; color: ${k.accent}; }
.back .ex { margin-top: 5mm; font-size: 12pt; line-height: 1.95; color: ${k.navy}; }
.back .lensbox { margin-top: 9mm; background: ${k.card}; border-radius: 3mm; padding: 5mm 6mm; }
.back .lensbox .h { font-size: 9pt; font-weight: 700; color: ${k.muted}; letter-spacing: 0.06em; margin-bottom: 3mm; }
.back .lensbox ol { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 2.2mm 6mm; }
.back .lensbox li { display: flex; align-items: center; gap: 2mm; font-size: 10pt; font-weight: 700; color: ${k.navy}; }
.back .lensbox li .no { font-family: ${num}; color: ${k.muted}; font-weight: 500; width: 4mm; }
.back .lensbox li svg { width: 4.6mm; height: 4.6mm; }
.back .hon { margin-top: 7mm; border-left: 1mm solid ${k.accent}; padding-left: 4mm; font-size: 9.5pt; line-height: 1.8; color: ${k.text}; }
.back .qrrow { margin-top: 8mm; display: flex; align-items: center; gap: 5mm; font-size: 9.5pt; line-height: 1.6; color: ${k.navy}; }
.back .qrrow .tile { background: ${c.paper}; border-radius: 2mm; padding: 2mm; width: 28mm; height: 28mm; flex: none; }
.back .qrrow .tile svg { display: block; width: 100%; height: 100%; }
.back .qrrow .url { font-family: ${num}; color: ${k.muted}; }
.back .pub { margin-top: auto; font-size: 8.5pt; line-height: 1.7; color: ${k.muted}; max-width: ${panel - 2 * pad - kdp.barcode_mm.width - 6}mm; }
${figureFontCss(t)}
.barcode-zone { position: absolute; right: ${g.bleed + panel + g.spine + kdp.barcode_mm.margin}mm; bottom: ${g.bleed + kdp.barcode_mm.margin}mm;
  width: ${kdp.barcode_mm.width}mm; height: ${kdp.barcode_mm.height}mm; background: ${c.paper}; }
`;
}

/**
 * The first example as seen through the lens: the solved figure (the lens at work) unless it carries a
 * worded caption, which can state the result; then the plain problem figure. Never an answer on the cover.
 */
function coverFigure(card: Parameters<typeof renderFigure>[0], t: BookTokens, paper: string) {
  const solved = renderFigure(card, 'solved', t, { color: true, paper, noAnswer: card });
  const captions = [...(solved.svg ?? '').matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1]!.replace(/<[^>]+>/g, ''));
  if (solved.svg && !captions.some((x) => /[\u3040-\u30ff\u4e00-\u9fff]{2,}|[:：]/.test(x))) return solved;
  const problem = renderFigure(card, 'problem', t, { color: true, paper });
  return problem.svg ? problem : solved;
}

/** The landing page's logo mark (Landing.tsx Logo): a lens with a rising stroke. */
const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" fill="none" stroke="currentColor"><circle cx="15" cy="15" r="11" stroke-width="2.5"/><path d="M23 23 L31 31" stroke-width="3" stroke-linecap="round"/><path d="M10 18 L15 10 L20 18" stroke-width="2.2" stroke-linejoin="round"/></svg>';

function iconSvg(t: BookTokens, lens: string, color: string): string {
  const inner = renderToStaticMarkup(<LensIcon lens={lens as never} tokens={t as unknown as Tokens} color={color} size={24} />);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 28 28">${inner}</svg>`;
}

/** 「視点レンズ 中学受験算数ワークブック」 → big 「視点レンズ」 + the rest, still breaking before ワークブック. */
function coverTitle(title: string, series: string): { big: string; rest: string[] } {
  const word = series.replace(/（.*$/, '').trim();
  const lines = titleLines(title);
  if (word && lines[0]!.startsWith(word)) return { big: word, rest: [lines[0]!.slice(word.length).trim(), ...lines.slice(1)].filter(Boolean) };
  return { big: lines[0]!, rest: lines.slice(1) };
}

export function Cover({ bundle, plan, g }: { bundle: BookBundle; plan: BookPlan; g: CoverGeometry }) {
  const t = bundle.tokens;
  const c = printPalette(t);
  const k = coverStyle(t, plan.passId);
  const { book } = plan;
  const first = plan.chapters[0]?.examples[0];
  const fig = first ? coverFigure(first, t, c.paper) : null;
  const title = coverTitle(book.title_ja, book.series_ja);
  const lenses = plan.chapters.map((ch) => ({ lens: ch.chapter.lens as string, name: ch.lensName }));
  const lc = (lens: string) => lensColor(t as unknown as Tokens, lens as never);
  const chip = (lens: string) => iconSvg(t, lens, lc(lens));
  return (
    <div className="cover">
      <div className="panel back">
        <div className="label">はじめに</div>
        <div className="ex">{excerpt(book.front_matter.hajimeni_ja)}</div>
        <div className="lensbox">
          <div className="h">この本の8つのレンズ</div>
          <ol>
            {lenses.map((l, i) => (
              <li key={l.lens}>
                <span className="no">{i + 1}</span>
                <span dangerouslySetInnerHTML={{ __html: chip(l.lens) }} />
                {l.name}
              </li>
            ))}
          </ol>
        </div>
        <div className="hon">{book.front_matter.honesty_ja}</div>
        <div className="qrrow">
          <div className="tile" dangerouslySetInnerHTML={{ __html: qrSvg(SITE_URL, c.ink, c.paper) }} />
          <div>
            {COPY.backQrCaption}
            <br />
            <span className="url">{SITE_URL}</span>
          </div>
        </div>
        <div className="pub">
          {book.publisher_ja}
          <br />
          {COPY.copyright}
        </div>
      </div>
      <div className="spine">
        <div className="bar" />
        {g.spineText ? (
          <div className="txt">
            <span>{book.title_ja}</span>
            <span className="au">{book.author_ja}</span>
          </div>
        ) : null}
      </div>
      <div className="panel front">
        <div className="band" />
        <div className="top">
          <span className="logo">
            <span dangerouslySetInnerHTML={{ __html: LOGO_SVG }} />
            {book.series_ja.replace(/（.*$/, '')}
          </span>
          <span className="lvl">{k.label}</span>
        </div>
        <h1>
          <span className="big">{title.big}</span>
          <span className="rest">
            {title.rest.map((line) => (
              <span key={line} className="line">
                {line}
              </span>
            ))}
          </span>
        </h1>
        <div className="sub">{book.subtitle_ja}</div>
        <div className="stage">
          <div className="lens">{fig?.svg ? <div className="fig" dangerouslySetInnerHTML={{ __html: fig.svg }} /> : <div className="fig" />}</div>
        </div>
        <div className="chips">
          {lenses.map((l) => (
            <div key={l.lens} className="chip" style={{ background: lc(l.lens) }}>
              {l.name}
            </div>
          ))}
        </div>
        <div className="foot">
          <span>{book.audience_ja}</span>
          <span className="author">{book.author_ja}</span>
        </div>
      </div>
      <div className="barcode-zone" />
    </div>
  );
}
