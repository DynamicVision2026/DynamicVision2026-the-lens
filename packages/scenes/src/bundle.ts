// The only module that imports build/bundle.json. Both apps go through here.
// A missing bundle is caught earlier by scripts/check-bundle.mjs ("Run `pnpm bundle` first").
import raw from '../../../build/bundle.json';
import type { Bundle, LensCard, Variant } from './types';

const bundle = raw as unknown as Bundle;

export function loadBundle(): Bundle {
  return bundle;
}

export function getCard(id: string): LensCard | undefined {
  return bundle.cards.find((card) => card.id === id);
}

export function getVariants(id: string): Variant[] {
  return getCard(id)?.variants ?? [];
}

// ---------------------------------------------------------------- course text in other languages
// i18n/content/<lang>.json maps each Japanese display string in the bundle to its translation
// (tools/i18n_extract.py lists them). Applied once at startup, before the first render; data keys
// (grades, ids, enums, provenance …) are never touched — the same skip list as the extractor.
const CONTENT_SKIP = new Set(['grades', 'provenance', 'id', 'archetype', 'lens', 'stage', 'kind', 'op', 'type', 'best_move', 'tags', 'status', 'checks']);
let table: Record<string, string> | null = null;
// Unit/counter words depend on the problem (本 = tires or legs): `<card id>|<ja>` entries win over the plain one.
const UNIT_KEYS = new Set(['unit', 'counter', 'measure', 'item', 'part']);

function translate(o: unknown, card = '', key = ''): unknown {
  if (typeof o === 'string') return (UNIT_KEYS.has(key) ? table![`${card}|${o}`] : undefined) ?? table![o] ?? o;
  if (Array.isArray(o)) {
    for (let i = 0; i < o.length; i++) o[i] = translate(o[i], card, key);
    return o;
  }
  if (o && typeof o === 'object') {
    const rec = o as Record<string, unknown>;
    if (typeof rec.ja === 'string' && rec.ja_orig === undefined) rec.ja_orig = rec.ja; // figures parse numbers from the Japanese
    for (const k of Object.keys(rec)) if (!CONTENT_SKIP.has(k) && k !== 'ja_orig') rec[k] = translate(rec[k], card, k);
  }
  return o;
}

/** Swap the bundle's Japanese display text for `t` (Japanese → translation). Call once, before rendering. */
export function applyContentTranslation(t: Record<string, string>): void {
  table = t;
  translate(bundle.labels);
  translate(bundle.passes);
  for (const card of bundle.cards) translate(card, card.id);
}

/** A single display string from code (figure captions etc.): its translation, or the Japanese as is. */
export function tc(ja: string): string {
  return table?.[ja] ?? ja;
}
