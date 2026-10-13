// Short tracking (WO-009): each Short links to /?s=<card-id>. The id is kept for this browser tab and
// added to the signup tags and the preorder link. Storage never throws (private windows just forget).

const SHORT_KEY = 'lens.v1.short';
const SHORT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** The Short id from a query string such as "?s=enclose-001", or null when absent or malformed. */
export function shortFrom(search: string): string | null {
  const s = new URLSearchParams(search).get('s');
  return s && SHORT_ID.test(s) ? s : null;
}

export const safeSession = {
  get(): string | null {
    try {
      const s = window.sessionStorage.getItem(SHORT_KEY);
      return s && SHORT_ID.test(s) ? s : null;
    } catch {
      return null;
    }
  },
  set(value: string): void {
    try {
      window.sessionStorage.setItem(SHORT_KEY, value);
    } catch {
      // Storage unavailable: the Short is simply not attributed.
    }
  },
};

/** Remembers ?s= from the current URL (if any) and returns the Short this visit came from. */
export function rememberShort(search: string): string | null {
  const s = shortFrom(search);
  if (s) safeSession.set(s);
  return s ?? safeSession.get();
}

/** Customer tags for the signup form: always free-lens, plus the Short when known. */
export function signupTags(short: string | null): string {
  return short ? `free-lens,${short}` : 'free-lens';
}

/**
 * Customer tags for the check's email form (WO-013): free-check, the top confusion pair as
 * confused:<right>-<picked> when there is one, and the Short when known.
 */
export function checkTags(confusion: readonly [string, string, ...unknown[]] | undefined, short: string | null): string {
  return ['free-check', confusion ? `confused:${confusion[0]}-${confusion[1]}` : null, short].filter(Boolean).join(',');
}

/** X (Twitter) Web Intent for the check result: the given text and the site's /check?s=x link. */
export function xShareHref(text: string, siteUrl: string): string {
  const url = `${siteUrl.replace(/\/+$/, '')}/check?s=x`;
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

/** The preorder link, with the Short as UTM parameters when known. */
export function preorderHref(url: string, short: string | null): string {
  if (!short) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', 'short');
    u.searchParams.set('utm_content', short);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}utm_source=short&utm_content=${encodeURIComponent(short)}`;
  }
}

/** The signup form's action: Shopify's customer (contact) form on the store. */
export function signupAction(shopDomain: string): string {
  return `https://${shopDomain}/contact#contact_form`;
}

/** Cloudflare Web Analytics beacon settings; SPA mode counts in-app path changes as page views. */
export function beaconConfig(token: string): string | null {
  return token ? JSON.stringify({ token, spa: true }) : null;
}
