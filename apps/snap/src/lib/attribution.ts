import { HERO_VARIANTS, type HeroVariant } from "../copy";

/** Traffic sources accepted from `?src=`; anything else is "other", a missing value is "direct". */
export const SOURCES = ["yt", "x", "tiktok", "survey", "book", "other", "direct"] as const;
export type Source = (typeof SOURCES)[number];

export function normalizeSrc(raw: unknown): Source {
  if (raw === undefined || raw === null || raw === "") return "direct";
  const v = String(raw).trim().toLowerCase();
  // "direct" is accepted too, so the value survives client → server normalisation unchanged.
  return (SOURCES as readonly string[]).includes(v) ? (v as Source) : "other";
}

export function isVariant(v: unknown): v is HeroVariant {
  return typeof v === "string" && (HERO_VARIANTS as readonly string[]).includes(v);
}

/**
 * Hero A/B: an explicit `?h=` wins (not stored); otherwise the visitor keeps the variant stored
 * on this device; otherwise one is picked at random. Returns the variant and whether to store it.
 */
export function resolveVariant(h: string | null, stored: string | null, rand: () => number = Math.random): { variant: HeroVariant; store: boolean } {
  if (isVariant(h)) return { variant: h, store: false };
  if (isVariant(stored)) return { variant: stored, store: false };
  const i = Math.min(HERO_VARIANTS.length - 1, Math.floor(rand() * HERO_VARIANTS.length));
  return { variant: HERO_VARIANTS[i], store: true };
}
