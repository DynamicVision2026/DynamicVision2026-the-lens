// Vector figures from LensScene, recoloured for a B&W interior. A figure the scenes cannot draw yet
// becomes a 「図（準備中）」 placeholder so the book still builds; the build log lists those cards.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { hasScene, LensScene, type LensCard } from '@lens/scenes';
import { printColor } from './print';
import type { BookTokens } from './types';

export type FigureMoment = 'problem' | 'solved';

export interface FigureResult {
  svg: string | null;
  reason?: string;
  /** The problem has no picture by design (word_problem diagram family `steps_only`). */
  none?: boolean;
}

const HEX = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

function hexToGrey(hex: string): string {
  const h = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const y = Math.round(0.299 * r! + 0.587 * g! + 0.114 * b!);
  return `rgb(${y}, ${y}, ${y})`;
}

/** Screen colour → print colour, from the tokens: lens accents print as ink (100% black). */
function printMap(t: BookTokens): Map<string, string> {
  const map = new Map<string, string>();
  const add = (screen: string, print: string) => map.set(screen.replace('#', '').toLowerCase(), print);
  const ink = printColor(t.color.ink);
  for (const tok of [t.color.paper, t.color.ink, t.color.ink_quiet, t.color.grid, t.color.trap.ink, t.color.trap.tint]) {
    add(tok.value, printColor(tok));
  }
  // Flags, correct and miss marks print as 100% black (their glyph carries the meaning).
  for (const tok of [t.color.trap.flag, t.color.correct, t.color.miss]) add(tok.value, ink);
  for (const [name, tok] of Object.entries(t.color.lens)) {
    if (name !== 'note' && typeof tok === 'object') add(tok.value, ink);
  }
  return map;
}

/** Recolour every hex colour in the SVG: token colours by their print value, anything else to grey. */
export function toPrint(svg: string, t: BookTokens): string {
  const map = printMap(t);
  return svg.replace(HEX, (_m, hex: string) => {
    const full = (hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex).toLowerCase();
    return map.get(full) ?? hexToGrey(full);
  });
}

/** Keyframe 0 for the problem; the last keyframe (the lens's end state) for the solution. */
export function keyframeFor(card: LensCard, moment: FigureMoment): number {
  const n = card.animation?.keyframes.length ?? 1;
  return moment === 'problem' ? 0 : Math.max(0, n - 1);
}

export function renderFigure(card: LensCard, moment: FigureMoment, t: BookTokens, opts: { color?: boolean; paper?: string } = {}): FigureResult {
  const f = card.problem.figure as { type: string; diagram?: { family?: string } };
  if (f.type === 'word_problem' && f.diagram?.family === 'steps_only') return { svg: null, none: true };
  if (!hasScene(card)) {
    const fig = card.problem.figure as { type: string; diagram?: { family?: string } };
    return { svg: null, reason: fig.type === 'word_problem' ? `word_problem/${fig.diagram?.family ?? '?'}` : fig.type };
  }
  try {
    const svg = renderToStaticMarkup(createElement(LensScene, { card, keyframe: keyframeFor(card, moment), t: 1, reducedMotion: true, tokens: t }));
    if (!/<svg[^>]*>[\s\S]*<\/svg>/.test(svg) || /<svg[^>]*\/>$|<svg[^>]*><\/svg>$/.test(svg)) return { svg: null, reason: 'empty scene' };
    if (!opts.color) return { svg: toPrint(svg, t) };
    // Colour (cover): keep the hues, but put the figure on the print paper.
    return { svg: opts.paper ? svg.split(t.color.paper.value).join(opts.paper) : svg };
  } catch (err) {
    return { svg: null, reason: err instanceof Error ? err.message : String(err) };
  }
}
