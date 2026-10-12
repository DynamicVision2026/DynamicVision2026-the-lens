// Deterministic line wrapping for SVG text (SVG has no automatic wrapping).

/** Approximate advance of one character in em: full width for CJK, about half for Latin and digits. */
function advance(ch: string): number {
  return /[\u0000-ɏ -⁯]/.test(ch) ? 0.56 : 1;
}

/** Breakable units: each CJK character on its own; runs of Latin letters, digits and . stay whole (e.g. "6cm"). */
function units(text: string): string[] {
  return text.match(/[A-Za-z0-9.²]+|[\s\S]/gu) ?? [];
}

export function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const maxEm = maxWidth / fontSize;
  const lines: string[] = [];
  let line = '';
  let width = 0;
  for (const unit of units(text)) {
    const w = [...unit].reduce((sum, ch) => sum + advance(ch), 0);
    if (width + w > maxEm && line.length > 0) {
      lines.push(line);
      line = unit === ' ' ? '' : unit;
      width = unit === ' ' ? 0 : w;
    } else {
      line += unit;
      width += w;
    }
  }
  if (line) lines.push(line);
  return lines;
}
