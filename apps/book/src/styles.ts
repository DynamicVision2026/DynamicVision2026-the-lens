// The interior stylesheet, built from tokens (layout.book, color.*.print, stroke, type). Sizes are pt.
import { BODY_FAMILY } from './fonts';
import { printPalette } from './print';
import type { BookTokens } from './types';

export const TRIM_MM = { width: 182, height: 257 } as const;

/**
 * Scene labels name a Latin family (Inter) or the hand family alone, so a Japanese glyph in them (枚, 円…)
 * would fall back to a system font. CSS beats SVG presentation attributes: add Noto Sans JP behind them.
 */
export function figureFontCss(t: BookTokens): string {
  const ja = `"${t.type.family_ja}"`;
  return [
    `svg [font-family*="${t.type.family_num}"] { font-family: "${t.type.family_num}", ${ja}, sans-serif; }`,
    `svg [font-family*="${t.type.family_hand}"] { font-family: "${t.type.family_hand}", ${ja}, cursive; }`,
  ].join('\n');
}

export function interiorCss(t: BookTokens): string {
  const m = t.layout.book.margin_mm;
  const c = printPalette(t);
  const s = t.type.scale;
  const sans = `"${t.type.family_ja}", sans-serif`;
  const num = `"${t.type.family_num}", "${t.type.family_ja}", sans-serif`;
  const hand = `"${t.type.family_hand}", "${t.type.family_ja}", cursive`;
  const serif = `"${BODY_FAMILY}", "${t.type.family_ja}", serif`;
  const pt = (n: number) => `${n}pt`;
  const lensW = pt(t.stroke.lens.width);
  const trapW = pt(t.stroke.trap.width);
  const figW = pt(t.stroke.figure.width);
  const gridW = pt(t.stroke.grid.width);
  return `
@page { size: ${TRIM_MM.width}mm ${TRIM_MM.height}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: ${c.paper}; color: ${c.ink}; }
body { font-family: ${serif}; font-size: ${pt(s.step.size)}; line-height: ${s.step.line}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1, h2, h3, h4, .sans { font-family: ${sans}; margin: 0; }
p { margin: 0 0 3mm; }
.num { font-family: ${num}; }

section.page { position: relative; width: ${TRIM_MM.width}mm; height: ${TRIM_MM.height}mm; overflow: hidden;
  padding: ${m.top}mm ${m.outer}mm ${m.bottom}mm ${m.inner}mm; break-after: page; page-break-after: always; }
section.page.verso { padding: ${m.top}mm ${m.inner}mm ${m.bottom}mm ${m.outer}mm; }
section.page:last-child { break-after: auto; page-break-after: auto; }
.body { position: relative; height: 100%; display: flex; flex-direction: column; }
.folio { position: absolute; bottom: ${m.bottom / 2 - 2}mm; font-family: ${num}; font-size: ${pt(s.label.size - 1)}; color: ${c.quiet}; }
section.recto .folio { right: ${m.outer}mm; }
section.verso .folio { left: ${m.outer}mm; }
.runhead { font-family: ${sans}; font-size: ${pt(s.label.size)}; font-weight: ${s.label.weight}; color: ${c.quiet};
  border-bottom: ${gridW} solid ${c.grid}; padding-bottom: 1.5mm; margin-bottom: 4mm; display: flex; justify-content: space-between; gap: 4mm; }

.title-page { justify-content: center; text-align: left; }
.series { font-family: ${sans}; font-size: ${pt(s.title.size - 4)}; font-weight: 500; color: ${c.quiet}; margin-bottom: 8mm; }
.book-title { font-size: ${pt(s.display.size + 4)}; font-weight: ${s.display.weight}; line-height: ${s.display.line}; margin-bottom: 6mm; }
.book-subtitle { font-family: ${sans}; font-size: ${pt(s.title.size - 2)}; font-weight: 500; margin-bottom: 14mm; }
.audience { display: inline-block; font-family: ${sans}; font-size: ${pt(s.label.size + 1)}; border: ${figW} solid ${c.ink}; padding: 1.5mm 4mm; align-self: flex-start; }
.title-foot { margin-top: auto; font-family: ${sans}; font-size: ${pt(s.label.size)}; color: ${c.quiet}; line-height: 1.6; }
.title-rule { width: 40mm; border-top: ${lensW} solid ${c.ink}; margin: 0 0 10mm; }

h2.page-title { font-size: ${pt(s.title.size)}; font-weight: ${s.title.weight}; line-height: ${s.title.line}; margin-bottom: 8mm;
  padding-bottom: 2mm; border-bottom: ${lensW} solid ${c.ink}; }
.prose { font-size: ${pt(s.problem.size - 2)}; line-height: 1.9; }
.prose p { margin-bottom: 4mm; text-indent: 1em; }
ol.howto { margin: 0 0 8mm; padding: 0; list-style: none; counter-reset: howto; }
ol.howto li { counter-increment: howto; position: relative; padding-left: 10mm; margin-bottom: 4mm; font-size: ${pt(s.problem.size - 2)}; line-height: 1.7; }
ol.howto li::before { content: counter(howto); position: absolute; left: 0; top: 0.4mm; width: 6.5mm; height: 6.5mm; border-radius: 50%;
  background: ${c.ink}; color: ${c.paper}; font-family: ${num}; font-size: ${pt(s.label.size)}; font-weight: 700; text-align: center; line-height: 6.5mm; }
.note { border-left: ${lensW} solid ${c.ink}; padding: 1mm 0 1mm 4mm; margin-bottom: 5mm; font-size: ${pt(s.step.size - 1)}; line-height: 1.7; }
.note.quiet { border-left: ${trapW} dashed ${c.trapInk}; color: ${c.ink}; }

ul.toc { list-style: none; margin: 0; padding: 0; }
ul.toc li { display: flex; align-items: baseline; font-family: ${sans}; font-size: ${pt(s.problem.size - 1)}; margin-bottom: 4.5mm; }
ul.toc .lead { flex: 1; border-bottom: ${gridW} dotted ${c.quiet}; margin: 0 3mm; transform: translateY(-1mm); }

.opener { justify-content: center; }
.opener .chapter-no { font-family: ${sans}; font-size: ${pt(s.title.size - 4)}; font-weight: 700; color: ${c.quiet}; letter-spacing: 0.2em; }
.opener .lens-icon { width: 34mm; height: 34mm; margin: 6mm 0; }
.opener h1 { font-size: ${pt(s.display.size + 12)}; font-weight: 700; line-height: 1.2; margin-bottom: 8mm; }
.opener .principle { border-top: ${lensW} solid ${c.ink}; border-bottom: ${gridW} solid ${c.ink}; padding: 5mm 0; margin-bottom: 12mm; }
.opener .principle h3 { font-size: ${pt(s.label.size)}; color: ${c.quiet}; margin-bottom: 2mm; }
.opener .principle p { font-size: ${pt(s.problem.size)}; line-height: 1.8; margin: 0; }
.qr-block { display: flex; align-items: center; gap: 4mm; }
.qr-block .qr { width: 24mm; height: 24mm; }
.qr-block .cap { font-family: ${sans}; font-size: ${pt(s.label.size + 1)}; font-weight: 700; }

.problem-row { display: flex; gap: 5mm; align-items: flex-start; }
.problem-row .ptext { flex: 1; font-size: ${pt(s.problem.size)}; font-weight: 400; line-height: ${s.problem.line}; }
.fig { flex: none; }
.fig svg { display: block; width: 100%; height: auto; }
${figureFontCss(t)}
.fig-pending { width: 100%; aspect-ratio: 4 / 3; border: ${trapW} dashed ${c.quiet}; display: flex; align-items: center; justify-content: center;
  font-family: ${sans}; font-size: ${pt(s.label.size)}; color: ${c.quiet}; }
.fig.w-lg { width: 70mm; } .fig.w-md { width: 58mm; } .fig.w-sm { width: 50mm; } .fig.w-xs { width: 36mm; }
.fig.w-lg svg { max-height: 80mm; } .fig.w-md svg { max-height: 66mm; } .fig.w-sm svg { max-height: 58mm; } .fig.w-xs svg { max-height: 36mm; }

.side-head { display: flex; align-items: center; gap: 3mm; margin: 5mm 0 3mm; }
.side-head h2 { font-size: ${pt(s.title.size)}; font-weight: ${s.title.weight}; }
.side-head .tag { font-family: ${sans}; font-size: ${pt(s.label.size)}; color: ${c.quiet}; }
.side-head svg { width: 9mm; height: 9mm; flex: none; }
.trap-head h2 { color: ${c.trapInk}; }
.trap-mark { width: 9mm; height: 9mm; border: ${trapW} dashed ${c.trapInk}; border-radius: 50%; flex: none; }

ol.steps { list-style: none; margin: 0; padding: 0; }
ol.steps li { position: relative; padding-left: 8mm; margin-bottom: 2.4mm; font-size: ${pt(s.step.size)}; line-height: ${s.step.line}; }
ol.steps.trap { border-left: ${trapW} dashed ${c.trapInk}; padding-left: 3mm; }
ol.steps.trap li { font-family: ${hand}; color: ${c.trapInk}; }
ol.steps.trap li::before { content: "…"; position: absolute; left: 1mm; }
ol.steps.lens { border-left: ${lensW} solid ${c.ink}; padding-left: 3mm; }
ol.steps.lens li .badge { position: absolute; left: 0; top: 0.5mm; width: 5.5mm; height: 5.5mm; border-radius: 50%; background: ${c.ink}; color: ${c.paper};
  font-family: ${num}; font-size: ${pt(s.label.size - 2)}; font-weight: 700; text-align: center; line-height: 5.5mm; }
.time { font-family: ${sans}; font-size: ${pt(s.label.size)}; margin-top: 3mm; display: flex; align-items: center; gap: 2mm; }
.time .bar { display: inline-block; height: ${t.time_cost.bar_height / 2}mm; background: ${c.ink}; }
.time.trap .bar { background: ${c.trapInk}; }
.time .badge-src { border: ${gridW} solid ${c.quiet}; color: ${c.quiet}; padding: 0 1.5mm; font-size: ${pt(s.label.size - 2)}; }
.solve-row { display: flex; gap: 5mm; align-items: flex-start; }
.solve-row ol { flex: 1; }
.answer-line { font-family: ${sans}; font-size: ${pt(s.problem.size)}; font-weight: 700; margin-top: 3mm; }

.bottom-bar { margin-top: auto; display: flex; align-items: center; gap: 4mm; border-top: ${lensW} solid ${c.ink}; padding-top: 3mm; }
.bottom-bar .trigger { flex: 1; font-family: ${sans}; font-size: ${pt(s.trigger.size - 2)}; font-weight: ${s.trigger.weight}; line-height: ${s.trigger.line}; }
.bottom-bar .trigger .k { display: block; font-size: ${pt(s.label.size - 1)}; font-weight: 500; color: ${c.quiet}; margin-bottom: 0.5mm; }
.bottom-bar .qr { width: 17mm; height: 17mm; flex: none; }
.bottom-bar .qr-wrap { display: flex; flex-direction: column; align-items: center; }
.bottom-bar .qr-cap { font-family: ${sans}; font-size: ${pt(s.label.size - 3)}; color: ${c.quiet}; white-space: nowrap; margin-top: 0.5mm; }

.boundary-head { display: flex; align-items: baseline; gap: 4mm; margin-bottom: 6mm; padding-bottom: 2mm; border-bottom: ${lensW} solid ${c.ink}; }
.boundary-head h2 { font-size: ${pt(s.title.size)}; }
.boundary-head .other { font-family: ${sans}; font-size: ${pt(s.title.size - 4)}; font-weight: 700; border: ${figW} solid ${c.ink}; padding: 0.5mm 3mm; }
.boundary-line { margin-top: 8mm; border: ${lensW} solid ${c.ink}; padding: 4mm 5mm; }
.boundary-line .k { font-family: ${sans}; font-size: ${pt(s.label.size)}; color: ${c.quiet}; margin-bottom: 1mm; }
.boundary-line p { font-family: ${sans}; font-size: ${pt(s.trigger.size)}; font-weight: 700; line-height: 1.6; margin: 0; }

.section-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 1mm 3mm; margin-bottom: 4mm; padding-bottom: 1.5mm; border-bottom: ${lensW} solid ${c.ink}; }
.section-head h2 { font-size: ${pt(s.title.size)}; }
.section-head .lead { font-family: ${sans}; font-size: ${pt(s.label.size)}; color: ${c.quiet}; }
.problems { flex: 1; display: flex; flex-direction: column; }
.problem { flex: 1 0 auto; display: flex; flex-direction: column; border-top: ${gridW} solid ${c.grid}; padding-top: 3mm; }
.problem:first-child { border-top: none; padding-top: 0; }
.plabel { font-family: ${sans}; font-size: ${pt(s.problem.size - 1)}; font-weight: 700; margin-bottom: 1.5mm; display: flex; align-items: center; gap: 2mm; }
.plabel .sim { font-size: ${pt(s.label.size - 1)}; font-weight: 500; border: ${gridW} solid ${c.ink}; padding: 0 1.5mm; }
.which { margin-top: 2mm; font-family: ${sans}; font-size: ${pt(s.label.size)}; font-weight: 700; display: flex; align-items: center; gap: 2mm; }
.which .box { display: inline-block; width: 26mm; height: 7mm; border: ${figW} solid ${c.ink}; }
.work { flex: 1; }

.review-item { flex: 1 0 auto; display: flex; flex-direction: column; border-top: ${gridW} solid ${c.grid}; padding-top: 2.5mm; }
.review-item:first-child { border-top: none; padding-top: 0; }
.review-item .ptext { font-size: ${pt(s.problem.size - 4)}; line-height: 1.5; }
.ticks { display: flex; flex-wrap: wrap; gap: 1mm 2.2mm; margin-top: 1.5mm; font-family: ${sans}; font-size: ${pt(s.label.size - 3)}; }
.fig.w-xs .fig-pending { aspect-ratio: 3 / 2; }
.ticks span { display: inline-flex; align-items: center; gap: 1mm; white-space: nowrap; }
.ticks i { display: inline-block; width: 3.4mm; height: 3.4mm; border: ${gridW} solid ${c.ink}; }

.answers { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm 6mm; align-content: start; }
.ans { border-top: ${gridW} solid ${c.grid}; padding-top: 2mm; }
.ans .row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 1mm 3mm; font-family: ${sans}; }
.ans .lbl { font-weight: 700; font-size: ${pt(s.label.size + 1)}; }
.ans .val { font-weight: 700; font-size: ${pt(s.step.size)}; }
.ans .lens { font-size: ${pt(s.label.size - 2)}; border: ${gridW} solid ${c.ink}; padding: 0 1.5mm; }
.ans ol { margin: 1.5mm 0 0 4.5mm; padding: 0; font-size: ${pt(s.label.size - 2.5)}; line-height: 1.45; color: ${c.ink}; }
.ans ol li { margin: 0; }

.memo-page .rule { height: 100%; background-image: linear-gradient(${c.grid} ${gridW}, transparent ${gridW}); background-size: 100% 9mm; }
.memo-page h3 { font-size: ${pt(s.label.size)}; color: ${c.quiet}; margin-bottom: 3mm; }
.colophon { justify-content: flex-end; }
.colophon .box { border-top: ${lensW} solid ${c.ink}; padding-top: 4mm; font-family: ${sans}; font-size: ${pt(s.label.size)}; line-height: 1.9; }
.colophon .box .t { font-size: ${pt(s.step.size)}; font-weight: 700; }
.colophon dl { display: grid; grid-template-columns: 18mm 1fr; margin: 2mm 0; }
.colophon dt { color: ${c.quiet}; }
.colophon dd { margin: 0; }
`;
}
