import { useSyncExternalStore } from "react";

/**
 * Screen layouts (iPad support, v0.12). One rule, used by the CSS (through attributes on <html>) and by
 * the parts that need it in JS (map camera, rail, two-column confirm):
 *
 * - phone  : narrower than 600 px (iPhone portrait; iPad Split View ½ and ⅓, Slide Over)
 * - tablet : 600 px or wider, portrait (iPad portrait; iPad landscape Split View ⅔ is ~780×820 → portrait)
 * - wide   : landscape and 900 px or wider (iPad landscape, iPad Pro), or landscape and shorter than
 *            500 px (a phone turned sideways: the rail and the side panel keep the map tall enough)
 *
 * `big` = the shorter side is 600 px or more (a tablet either way): the map HUD and labels scale up.
 * `short` = a wide layout shorter than 500 px (phone landscape): compact rail and HUD.
 */
export type Layout = "phone" | "tablet" | "wide";

export const TABLET_MIN = 600;
export const WIDE_MIN = 900;
export const SHORT_MAX = 500;

/** Side panel width in wide layouts (unit sheet, 今夜の作戦, 年度の記録, page viewer list). */
export const PANEL = { min: 340, share: 0.36, max: 440 } as const;

export interface LayoutInfo {
  layout: Layout;
  big: boolean;
  short: boolean;
}

export function layoutOf(w: number, h: number): LayoutInfo {
  const landscape = w > h;
  const short = h < SHORT_MAX;
  const layout: Layout = w < TABLET_MIN ? "phone" : landscape && (w >= WIDE_MIN || short) ? "wide" : "tablet";
  return { layout, big: Math.min(w, h) >= TABLET_MIN, short: layout === "wide" && short };
}

/** The side panel's width for a window width (also written to the CSS variable --panel-w). */
export const panelWidth = (w: number) => Math.round(Math.min(PANEL.max, Math.max(PANEL.min, w * PANEL.share)));

// ---------- live store (rotation, Split View, Slide Over: no reload) ----------

const PHONE: LayoutInfo = { layout: "phone", big: false, short: false };
let snap: LayoutInfo = PHONE;
const subs = new Set<() => void>();
let started = false;

const sizeNow = () => ({ w: window.innerWidth, h: window.innerHeight });

/** Write the layout to <html> (data-layout, data-hud, data-short, --panel-w) and tell subscribers. */
function apply() {
  const { w, h } = sizeNow();
  const next = layoutOf(w, h);
  const el = document.documentElement;
  el.dataset.layout = next.layout;
  if (next.big) el.dataset.hud = "lg";
  else delete el.dataset.hud;
  if (next.short) el.dataset.short = "1";
  else delete el.dataset.short;
  el.style.setProperty("--panel-w", `${panelWidth(w)}px`);
  if (next.layout !== snap.layout || next.big !== snap.big || next.short !== snap.short) {
    snap = next;
    for (const f of subs) f();
  }
}

/** Call once before the first render (main.tsx): the first paint already has the right layout. */
export function initLayout() {
  if (started || typeof window === "undefined") return;
  started = true;
  snap = layoutOf(sizeNow().w, sizeNow().h);
  apply();
  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", apply);
  window.visualViewport?.addEventListener("resize", apply);
}

const subscribe = (f: () => void) => {
  initLayout();
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

/** The current layout; re-renders on rotation / resize when it changes. Server markup (tests) = phone. */
export function useLayout(): LayoutInfo {
  return useSyncExternalStore(
    subscribe,
    () => snap,
    () => PHONE,
  );
}
