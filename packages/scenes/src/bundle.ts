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
