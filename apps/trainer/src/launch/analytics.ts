// WO-025: 視点レンズ's own Google Analytics 4 property (never another product's). Off until LAUNCH.ga4Id is
// set: with '' no script is loaded and no event is sent. No personal data: never names, emails or what a
// child types. A paid customer is known only by the Shopify order number from the access link (o=), kept
// on the device in lens.v1.order.<pass> and sent as GA's user_id. Addresses are sent without their query
// string, so an access key never reaches GA.
import { accessMode } from '../course/access';
import { LAUNCH } from '../launch.config';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export type GaEvent =
  | { name: 'page_view'; params: { page_path: string } }
  | { name: 'select_course'; params: { pass: string } }
  | { name: 'trial_start'; params: { pass: string } }
  | { name: 'course_open'; params: { pass: string; order?: string } }
  | { name: 'lesson_open'; params: { pass: string; lesson: string; mode: 'paid' | 'trial' | 'preview' } }
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
  track({ name: 'lesson_open', params: { pass: passId, lesson: lens, mode: accessMode(passId) } });
}

/** For tests: analytics off again. */
export function resetAnalytics(): void {
  active = '';
}
