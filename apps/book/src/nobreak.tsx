// WO-026 §7 MUST 1: no line break inside a coordinate, a ratio or a short equation. Runs of math in the
// Japanese text (「B(1, −3)」「BD:DC＝3:4」「AB＝6cm」「y = x + 1」「8−(−4) = 12」) print as one unbreakable
// piece; a long run breaks only before a top-level + or − (never next to 「=」 or inside parentheses).
// Also never a line that starts with ² / ³ or a lone 「か。」. Layout only: the text itself is unchanged.
import { Fragment, type ReactNode } from 'react';

/** Characters of a math run: Latin letters and digits, operators, brackets, primes, powers, roots, units. */
const RUN = /[A-Za-z0-9.'′()[\]{}+\-−×÷/=＝:：<>≦≧≤≥²³√π°|^αβθℓ](?:[A-Za-z0-9.,'′()[\]{}+\-−×÷/=＝:：<>≦≧≤≥²³√π°|^αβθℓ ]*[A-Za-z0-9.'′()[\]{}+\-−×÷/=＝:：<>≦≧≤≥²³√π°|^αβθℓ])?/g;
/** A run of at most this many characters never breaks; a longer one breaks only before + or −. */
export const NOWRAP_MAX = 24;

export interface Segment {
  text: string;
  /** Print without a line break inside. */
  nb: boolean;
}

/** Splits a long run before each top-level 「 + 」「 − 」 (a space, the operator, a space), outside brackets. */
function splitLong(run: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < run.length; i++) {
    const c = run[i]!;
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && c === ' ' && (run[i + 1] === '+' || run[i + 1] === '−' || run[i + 1] === '-') && run[i + 2] === ' ' && i > start) {
      out.push(run.slice(start, i + 1));
      start = i + 1;
    }
  }
  out.push(run.slice(start));
  return out;
}

/** Only worth a span when the run could break inside: it has a space, or a mark a browser breaks before. */
const BREAKABLE = /[ (（²³=＝:：−+×÷/]/;

export function segments(text: string): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  const plain = (s: string) => {
    if (!s) return;
    // A lone 「か。」 never starts a line: keep it with the character before it.
    const re = /.か。/g;
    let i = 0;
    for (let m = re.exec(s); m; m = re.exec(s)) {
      if (m.index > i) out.push({ text: s.slice(i, m.index), nb: false });
      out.push({ text: m[0], nb: true });
      i = m.index + m[0].length;
    }
    if (i < s.length) out.push({ text: s.slice(i), nb: false });
  };
  for (const m of text.matchAll(RUN)) {
    let run = m[0];
    let i = m.index!;
    // A run that starts with ² / ³ keeps the character before it (never a line that starts with ²).
    if (/^[²³]/.test(run) && i > at) {
      i -= 1;
      run = text[i] + run;
    }
    plain(text.slice(at, i));
    at = i + run.length;
    if (!BREAKABLE.test(run) && run.length < 3) {
      out.push({ text: run, nb: false });
      continue;
    }
    const pieces = run.length <= NOWRAP_MAX ? [run] : splitLong(run);
    for (const p of pieces) out.push({ text: p, nb: true });
  }
  plain(text.slice(at));
  // Merge neighbouring plain pieces.
  const merged: Segment[] = [];
  for (const s of out) {
    const last = merged[merged.length - 1];
    if (last && !last.nb && !s.nb) last.text += s.text;
    else merged.push({ ...s });
  }
  return merged;
}

/** Text with its math runs unbreakable (`<span class="nb">`). */
export function MathText({ text }: { text: string }): ReactNode {
  return (
    <>
      {segments(text).map((s, i) =>
        s.nb ? (
          <span key={i} className="nb">
            {s.text}
          </span>
        ) : (
          <Fragment key={i}>{s.text}</Fragment>
        ),
      )}
    </>
  );
}
