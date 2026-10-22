/**
 * Display language (日本語 / English / 简体中文 / 繁體中文). Chosen once at load:
 *   ?lang= in the URL → the saved choice → the browser's languages → English (Japanese browsers get 日本語).
 * Changing it saves the choice and reloads, so every module reads one fixed language (no re-render plumbing).
 * Safe on the server (no window): always 日本語.
 */
export const LANGS = ["ja", "en", "zh-Hans", "zh-Hant"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_LABEL: Record<Lang, string> = { ja: "日本語", en: "English", "zh-Hans": "简体中文", "zh-Hant": "繁體中文" };
const KEY = "lens-snap:lang";

/** BCP-47 tag (ja-JP, zh-TW, zh-Hans-CN, en-US …) → one of ours, or null. */
export function langFromTag(tag: string | null | undefined): Lang | null {
  if (!tag) return null;
  const t = tag.toLowerCase();
  if (t.startsWith("ja")) return "ja";
  if (t.startsWith("zh")) return /hant|-tw|-hk|-mo/.test(t) ? "zh-Hant" : "zh-Hans";
  if (t.startsWith("en")) return "en";
  return null;
}

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function detectLang(): Lang {
  if (typeof window === "undefined") return "ja";
  if (import.meta.env?.MODE === "test") return "ja"; // unit tests read the Japanese source
  const q = langFromTag(new URLSearchParams(window.location.search).get("lang"));
  if (q) {
    store()?.setItem(KEY, q);
    return q;
  }
  const saved = langFromTag(store()?.getItem(KEY));
  if (saved) return saved;
  for (const tag of navigator.languages ?? [navigator.language]) {
    const l = langFromTag(tag);
    if (l) return l;
  }
  return "en";
}

export const LANG: Lang = detectLang();

/** Save the choice and reload (drops a ?lang= from the URL so it does not override the choice). */
export function setLang(l: Lang) {
  store()?.setItem(KEY, l);
  const u = new URL(window.location.href);
  u.searchParams.delete("lang");
  window.location.replace(u.toString());
}

/** Pick the current language's value (falls back to 日本語). */
export function pick<T>(byLang: { ja: T } & Partial<Record<Lang, T>>): T {
  return byLang[LANG] ?? byLang.ja;
}

/** The shape of a Japanese copy object with every string literal widened to string (for the translations). */
export type Widen<T> = T extends string
  ? string
  : T extends (...a: infer A) => infer R
    ? (...a: A) => Widen<R>
    : T extends readonly unknown[]
      ? { readonly [K in keyof T]: Widen<T[K]> }
      : T extends object
        ? { [K in keyof T]: Widen<T[K]> }
        : T;

if (typeof document !== "undefined") document.documentElement.lang = LANG;
