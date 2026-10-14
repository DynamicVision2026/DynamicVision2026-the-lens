// KDP full-wrap cover: back + spine + front with bleed (WO-021 §3). Spine width comes from kdp.json.
import { COPY, SITE_URL } from './copy';
import { renderFigure } from './figure';
import { BODY_FAMILY } from './fonts';
import type { BookPlan } from './plan';
import { printPalette } from './print';
import { qrSvg } from './qr';
import { figureFontCss, TRIM_MM } from './styles';
import type { BookBundle, BookTokens } from './types';

export interface KdpConfig {
  spine_mm_per_page: number;
  spine_mm: number | null;
  spine_text_min_pages: number;
  barcode_mm: { width: number; height: number; margin: number };
}

export interface CoverGeometry {
  bleed: number;
  spine: number;
  width: number;
  height: number;
  spineText: boolean;
}

export function coverGeometry(t: BookTokens, kdp: KdpConfig, pageCount: number): CoverGeometry {
  const bleed = t.layout.book.bleed_mm;
  const spine = kdp.spine_mm ?? Math.round(pageCount * kdp.spine_mm_per_page * 100) / 100;
  return {
    bleed,
    spine,
    width: 2 * bleed + 2 * TRIM_MM.width + spine,
    height: 2 * bleed + TRIM_MM.height,
    spineText: pageCount >= kdp.spine_text_min_pages,
  };
}

/** The first sentence(s) of はじめに for the back cover. */
function excerpt(text: string): string {
  return text.split(/\s+/).filter(Boolean).slice(0, 2).join('');
}

export function coverCss(t: BookTokens, g: CoverGeometry, kdp: KdpConfig): string {
  const c = printPalette(t);
  const s = t.type.scale;
  const sans = `"${t.type.family_ja}", sans-serif`;
  const serif = `"${BODY_FAMILY}", "${t.type.family_ja}", serif`;
  const safe = 6.35; // KDP keeps text 0.25 in inside the trim.
  const panel = TRIM_MM.width;
  return `
@page { size: ${g.width}mm ${g.height}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: ${c.paper}; color: ${c.ink}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.cover { position: relative; width: ${g.width}mm; height: ${g.height}mm; overflow: hidden; font-family: ${sans}; }
.panel { position: absolute; top: ${g.bleed}mm; width: ${panel}mm; height: ${TRIM_MM.height}mm; padding: ${safe + 6}mm ${safe + 6}mm; display: flex; flex-direction: column; }
.back { left: ${g.bleed}mm; }
.front { left: ${g.bleed + panel + g.spine}mm; }
.spine { position: absolute; top: 0; left: ${g.bleed + panel}mm; width: ${g.spine}mm; height: ${g.height}mm; background: ${c.ink}; color: ${c.paper};
  display: flex; align-items: center; justify-content: center; writing-mode: vertical-rl; font-size: ${Math.min(10, Math.max(5, g.spine * 0.55))}pt; font-weight: 700; letter-spacing: 0.1em; }
.band { position: absolute; left: 0; right: -${g.bleed}mm; top: -${g.bleed}mm; height: ${g.bleed + 22}mm; background: ${c.ink}; }
.front .series { font-size: ${s.label.size + 1}pt; font-weight: 500; color: ${c.paper}; margin-top: -${safe - 1}mm; height: 16mm; display: flex; align-items: center; position: relative; }
.front h1 { font-size: ${s.display.size + 2}pt; line-height: 1.25; margin: 6mm 0 3mm; }
.front .sub { font-size: ${s.title.size - 4}pt; font-weight: 500; margin-bottom: 4mm; }
.front .aud { align-self: flex-start; border: ${t.stroke.figure.width}pt solid ${c.ink}; padding: 1mm 3mm; font-size: ${s.label.size}pt; font-weight: 700; }
.front .fig { margin: auto auto 0; width: 112mm; }
.front .fig svg { display: block; width: 100%; height: auto; max-height: 125mm; }
.front .author { font-size: ${s.label.size}pt; margin-top: 3mm; text-align: right; }
.back .ex { font-family: ${serif}; font-size: ${s.step.size - 1}pt; line-height: 1.9; margin-top: 10mm; }
.back .hon { margin-top: 6mm; border-left: ${t.stroke.lens.width}pt solid ${c.ink}; padding-left: 4mm; font-size: ${s.label.size}pt; line-height: 1.8; }
.back .qrrow { margin-top: 10mm; display: flex; align-items: center; gap: 4mm; font-size: ${s.label.size}pt; }
.back .qrrow svg { width: 24mm; height: 24mm; }
.back .pub { margin-top: auto; font-size: ${s.label.size - 1}pt; color: ${c.quiet}; max-width: ${panel - 2 * (safe + 6) - kdp.barcode_mm.width - 6}mm; }
${figureFontCss(t)}
.barcode-zone { position: absolute; right: ${g.bleed + panel + g.spine + kdp.barcode_mm.margin}mm; bottom: ${g.bleed + kdp.barcode_mm.margin}mm;
  width: ${kdp.barcode_mm.width}mm; height: ${kdp.barcode_mm.height}mm; background: ${c.paper}; }
`;
}

export function Cover({ bundle, plan, g }: { bundle: BookBundle; plan: BookPlan; g: CoverGeometry }) {
  const t = bundle.tokens;
  const c = printPalette(t);
  const { book } = plan;
  const first = plan.chapters[0]?.examples[0];
  const fig = first ? renderFigure(first, 'solved', t, { color: true, paper: c.paper }) : null;
  return (
    <div className="cover">
      <div className="panel back">
        <div className="ex">{excerpt(book.front_matter.hajimeni_ja)}</div>
        <div className="hon">{book.front_matter.honesty_ja}</div>
        <div className="qrrow">
          <div dangerouslySetInnerHTML={{ __html: qrSvg(SITE_URL, c.ink, c.paper) }} />
          <div>
            {COPY.backQrCaption}
            <br />
            {SITE_URL}
          </div>
        </div>
        <div className="pub">
          {book.publisher_ja}
          <br />
          {COPY.copyright}
        </div>
      </div>
      <div className="spine">{g.spineText ? `${book.title_ja}　${book.author_ja}` : ''}</div>
      <div className="panel front">
        <div className="band" />
        <div className="series">{book.series_ja}</div>
        <h1>{book.title_ja}</h1>
        <div className="sub">{book.subtitle_ja}</div>
        <div className="aud">{book.audience_ja}</div>
        {fig?.svg ? <div className="fig" dangerouslySetInnerHTML={{ __html: fig.svg }} /> : <div className="fig" />}
        <div className="author">{book.author_ja}</div>
      </div>
      <div className="barcode-zone" />
    </div>
  );
}
