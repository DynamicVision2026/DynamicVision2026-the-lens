// Print (B&W) colours from tokens: each token's `print` value, e.g. a CSS colour or "60% black".
import type { ColorToken } from '@lens/scenes';
import type { BookTokens } from './types';

/** "60% black" → a grey; a CSS colour passes through; no print value falls back to the screen value. */
export function printColor(token: ColorToken): string {
  const p = token.print?.trim();
  if (!p) return token.value;
  const m = /^(\d+(?:\.\d+)?)%\s*black/i.exec(p);
  if (m) {
    const level = Math.round(255 * (1 - Number(m[1]) / 100));
    return `rgb(${level}, ${level}, ${level})`;
  }
  return p.split(/\s+/)[0]!;
}

export interface PrintPalette {
  paper: string;
  ink: string;
  quiet: string;
  grid: string;
  trapInk: string;
  trapTint: string;
}

export function printPalette(t: BookTokens): PrintPalette {
  return {
    paper: printColor(t.color.paper),
    ink: printColor(t.color.ink),
    quiet: printColor(t.color.ink_quiet),
    grid: printColor(t.color.grid),
    trapInk: printColor(t.color.trap.ink),
    trapTint: printColor(t.color.trap.tint),
  };
}
