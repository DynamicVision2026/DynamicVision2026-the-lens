import { tc } from './bundle';
// Display formatting for exact SymPy strings. Formatting only: never derives a new value.
import type { LensCard } from './types';

interface Fraction {
  num: bigint;
  den: bigint;
}

function parseExact(value: string): Fraction | null {
  const m = /^\s*(-?\d+)\s*(?:\/\s*(\d+))?\s*$/.exec(value);
  if (!m) return null;
  const den = m[2] ? BigInt(m[2]) : 1n;
  return den === 0n ? null : { num: BigInt(m[1]!), den };
}

/** "39/2" → "19.5", "29" → "29", "1/3" → "1/3" (only terminating decimals become decimals). */
export function formatExact(value: string): string {
  const f = parseExact(value);
  if (!f) return value;
  let den = f.den;
  let twos = 0;
  let fives = 0;
  while (den % 2n === 0n) { den /= 2n; twos++; }
  while (den % 5n === 0n) { den /= 5n; fives++; }
  if (den !== 1n) return `${f.num}/${f.den}`;
  const places = Math.max(twos, fives);
  const scaled = (f.num * 10n ** BigInt(places)) / f.den;
  const negative = scaled < 0n;
  const digits = (negative ? -scaled : scaled).toString().padStart(places + 1, '0');
  const int = digits.slice(0, digits.length - places);
  const frac = places > 0 ? `.${digits.slice(digits.length - places)}` : '';
  return `${negative ? '-' : ''}${int}${frac}`;
}

/** Approximate number, for count-up animation only. The final frame always shows formatExact. */
export function approxNumber(value: string): number | null {
  const f = parseExact(value);
  return f ? Number(f.num) / Number(f.den) : null;
}

/** Count-up text at progress t: interpolated with the final value's decimal places, exact at t = 1. */
export function countUp(value: string, t: number): string {
  if (t >= 1) return formatExact(value);
  const target = approxNumber(value);
  if (target === null) return formatExact(value);
  const exact = formatExact(value);
  const places = exact.includes('.') ? exact.split('.')[1]!.length : 0;
  return (target * Math.max(0, t)).toFixed(places);
}

/** The answer as shown to a child: `display_ja` if present, else the exact value plus the unit. */
export function answerText(card: LensCard): string {
  if (card.answer.display_ja) return card.answer.display_ja;
  const f = card.problem.figure;
  // WO-020 mass points: a variant has no display_ja, so it reads like its anchor's (「AP:PD＝5:1」, 「3/17倍」).
  // The exact value n/d is rewritten as n:d, never recomputed.
  if (f.type === 'triangle_cevians') {
    if (f.ask === 'area_pbc' || f.ask === 'area_abd') return `${formatExact(card.answer.value)}${tc('倍')}`;
    const [n, d = '1'] = card.answer.value.split('/');
    return `${f.ask === 'bp_pe' ? 'BP:PE' : 'AP:PD'}＝${n}:${d}`;
  }
  // Print minus (U+2212) like the rest of the text (audit 2026-10-16: 「-5」).
  return `${formatExact(card.answer.value).replace(/^-/, '−')}${card.problem.unit}`;
}

/** Fills a time_cost label template such as "+{min}分{sec}秒". Without {min}, {sec} is the total. */
export function timeLabel(template: string, seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hasMin = template.includes('{min}');
  const min = Math.floor(total / 60);
  const sec = hasMin ? total % 60 : total;
  return template.replace('{min}', String(min)).replace('{sec}', String(sec));
}
