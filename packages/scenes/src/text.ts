// Deterministic line wrapping for SVG text (SVG has no automatic wrapping).

/** Approximate advance of one character in em: full width for CJK, about half for Latin and digits. */
function advance(ch: string): number {
  return /[\u0000-ɏ -⁯]/.test(ch) ? 0.56 : 1;
}

export function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const maxEm = maxWidth / fontSize;
  const lines: string[] = [];
  let line = '';
  let width = 0;
  for (const ch of text) {
    const w = advance(ch);
    if (width + w > maxEm && line.length > 0) {
      lines.push(line);
      line = ch === ' ' ? '' : ch;
      width = ch === ' ' ? 0 : w;
    } else {
      line += ch;
      width += w;
    }
  }
  if (line) lines.push(line);
  return lines;
}
