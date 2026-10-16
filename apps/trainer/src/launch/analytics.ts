// WO-025: 視点レンズ's own Google Analytics 4 property (never another product's). Off until LAUNCH.ga4Id is
// set: with '' no script is loaded and no event is sent. No personal data: never names, emails or what a
// child types. A paid customer is known only by the Shopify order number from the access link (o=), kept
// on the device in lens.v1.order.<pass> and sent as GA's user_id. Addresses are sent without their query
// string, so an access key never reaches GA. WO-027: a visit from a book QR (?src=book) is remembered on the
// device (lens.v1.src, first touch wins) and sent as the GA user property `src` on every event.
import { accessMode, type AccessMode } from '../course/access';
import { LAUNCH } from '../launch.config';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export type GaEvent =
  | { name: 'page_view'; params: { page_path: string; src?: string } }
  | { name: 'select_course'; params: { pass: string } }
  | { name: 'trial_start'; params: { pass: string } }
  | { name: 'course_open'; params: { pass: string; order?: string } }
  | { name: 'lesson_open'; params: { pass: string; lesson: string; mode: AccessMode } }
  | { name: 'book_open'; params: { pass: string; lens: string } }
  | { name: 'lesson_complete'; params: { pass: string; lesson: string } }
  | { name: 'check_complete'; params?: undefined };

/** The measurement ID in use; '' = analytics off. */
let active = '';

const orderKey = (passId: string) => `lens.v1.order.${passId}`;
/** A Shopify order name: "#" and the order number (a store prefix or suffix allowed); anything else is ignored. */
const ORDER = /^#?[\w-]{1,32}$/;

/** The o= order number of an access link, or null when absent or malformed (old links have none). */
export function orderFrom(search: string): string | null {
  const o = new URLSearchParams(search).get('o')?.trim();
  return o && ORDER.test(o) ? o : null;
}

function storedOrder(passId: string): string | null {
  try {
    const o = window.localStorage.getItem(orderKey(passId));
    return o && ORDER.test(o) ? o : null;
  } catch {
    return null;
  }
}

/** The order number remembered on this device (from any Pass's access link), for GA's user_id. */
export function rememberedOrder(): string | null {
  for (const passId of Object.keys(LAUNCH.passes)) {
    const o = storedOrder(passId);
    if (o) return o;
  }
  return null;
}

const SRC_KEY = 'lens.v1.src';
/** A `src` value worth keeping (?src=book from the books' QR codes). */
const SRC = /^[a-z0-9_-]{1,32}$/;
let srcMemory: string | null = null;

/** The ?src= of an address, or null (page_view sends it as a param; the rest of the query never). */
export function srcFrom(search: string): string | null {
  const s = new URLSearchParams(search).get('src');
  return s && SRC.test(s) ? s : null;
}

/** Where this device first came from (lens.v1.src), or null. */
export function rememberedSrc(): string | null {
  try {
    const s = window.localStorage.getItem(SRC_KEY);
    if (s && SRC.test(s)) return s;
  } catch {
    // Storage blocked: the memory copy below.
  }
  return srcMemory;
}

/** Remembers `src` for this device unless one is already there (first touch wins); sets the GA user property. */
export function rememberSrc(src: string): string {
  const first = rememberedSrc() ?? src;
  srcMemory = first;
  try {
    if (!window.localStorage.getItem(SRC_KEY)) window.localStorage.setItem(SRC_KEY, first);
  } catch {
    // Storage blocked: this visit only.
  }
  if (active && typeof window.gtag === 'function') window.gtag('set', 'user_properties', { src: first });
  return first;
}

/** The page's address without query string or hash (keeps ?k= access keys out of GA). */
const pageLocation = () => `${window.location.origin}${window.location.pathname}`;

/** Loads gtag.js once, only when a measurement ID is configured. Returns whether analytics is on. */
export function initAnalytics(ga4Id: string = LAUNCH.ga4Id): boolean {
  if (!ga4Id) return false;
  if (active) return true;
  active = ga4Id;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // gtag.js reads the Arguments object itself, as in Google's snippet.
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  const order = rememberedOrder();
  window.gtag('config', ga4Id, {
    send_page_view: false, // the app sends page_view on each route change
    page_location: pageLocation(),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    ...(order ? { user_id: order } : {}),
  });
  const src = rememberedSrc();
  if (src) window.gtag('set', 'user_properties', { src });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`;
  document.head.appendChild(script);
  return true;
}

/** Sends one event; does nothing while analytics is off. */
export function track(e: GaEvent): void {
  if (!active || typeof window.gtag !== 'function') return;
  window.gtag('event', e.name, { ...e.params, page_location: pageLocation() });
}

/** /open with a valid key: remember the order number (if the link has one), make it GA's user_id, count the open. */
export function courseOpened(passId: string, order: string | null): void {
  if (order) {
    try {
      window.localStorage.setItem(orderKey(passId), order);
    } catch {
      // Storage blocked: this visit still carries the order.
    }
  }
  if (order && active && typeof window.gtag === 'function') window.gtag('set', { user_id: order });
  track({ name: 'course_open', params: order ? { pass: passId, order } : { pass: passId } });
}

/** A lesson's masterclass or practice opened: paid, trial or preview. */
export function lessonOpened(passId: string, lens: string): void {
  track({ name: 'lesson_open', params: { pass: passId, lesson: lens, mode: accessMode(passId, lens) } });
}

/** WO-027: a book QR visit. Remembers src=book; `book_open` once per lens per device (`isNew` from openFromBook). */
export function bookOpened(passId: string, lens: string, isNew: boolean): void {
  rememberSrc('book');
  if (isNew) track({ name: 'book_open', params: { pass: passId, lens } });
}

/** For tests: analytics off again. */
export function resetAnalytics(): void {
  active = '';
  srcMemory = null;
}
