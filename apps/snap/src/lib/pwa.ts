import { useEffect, useState } from "react";
import { readPref, writePref } from "../state";

/**
 * Home-screen install + data safety.
 * - service worker (production builds only): the app opens offline; /api/* is never cached
 * - navigator.storage.persist() after the first 保存: the browser is asked not to evict IndexedDB
 * - the home-screen reminder window after the 1st (and, after 「あとで」, the 2nd) saved photo
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

/** Call once at startup (main.tsx). */
export function initPwa() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep it for our own button
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    writePref("install-tip", "installed");
    notify();
  });
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline support is a bonus; the app works without it */
      });
    });
  }
}

export function isStandalone(): boolean {
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  } catch {
    /* ignore */
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Remember that a page was saved (counted, for the home-screen reminder); after the first one, ask for persistent storage once. */
export function afterSave() {
  if (!readPref("saved-once")) writePref("saved-once", new Date().toISOString());
  writePref("saved-count", String(savedCount() + 1));
  notify();
  if (readPref("persist")) return;
  const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
  if (!storage?.persist) return;
  void (async () => {
    try {
      const already = (await storage.persisted?.()) ?? false;
      const ok = already || (await storage.persist());
      writePref("persist", ok ? "granted" : "denied");
    } catch {
      /* ignore: storage stays "best effort" */
    }
  })();
}

/** Pages saved on this device (older installs only knew "saved once"). */
function savedCount(): number {
  const n = Number(readPref("saved-count") ?? 0);
  return Number.isFinite(n) && n > 0 ? n : readPref("saved-once") ? 1 : 0;
}

const isAndroid = (ua = navigator.userAgent) => /Android/i.test(ua);
const isIos = (ua = navigator.userAgent, platform = navigator.platform, touch = navigator.maxTouchPoints) =>
  /iPhone|iPad|iPod/.test(ua) || (platform === "MacIntel" && touch > 1);

/**
 * The home-screen reminder (a window on the map): after the 1st saved photo, and once more after the
 * next photo if they chose 「あとで」. Never when the app already runs from the home screen, never again
 * after 「追加する」 (or two 「あとで」), and only on phones and tablets.
 *   "ask"     — 「ホーム画面に追加しませんか？」 with 追加する / あとで
 *   "ios"     — the steps for Safari (共有ボタン → ホーム画面に追加)
 *   "android" — the steps when Chrome offers no install prompt (︙ → ホーム画面に追加)
 */
export type InstallAskMode = "ask" | "ios" | "android" | null;

export function installAskDue(): boolean {
  if (readPref("install-tip")) return false; // answered (added / declined twice / turned off)
  if (isStandalone()) return false;
  if (!(isIos() || isAndroid() || deferred)) return false; // computers: no reminder
  const count = savedCount();
  const asks = Number(readPref("install-ask") ?? 0);
  if (asks === 0) return count >= 1;
  return asks === 1 && count > Number(readPref("install-ask-at") ?? 0);
}

export function useInstallAsk(): { mode: InstallAskMode; yes: () => Promise<void>; later: () => void; close: () => void } {
  const [steps, setSteps] = useState<"ios" | "android" | null>(null);
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  const mode: InstallAskMode = steps ?? (installAskDue() ? "ask" : null);
  return {
    mode,
    yes: async () => {
      const e = deferred;
      if (e) {
        deferred = null;
        try {
          await e.prompt();
          const choice = await e.userChoice;
          if (choice?.outcome === "accepted") writePref("install-tip", "installed");
          else declineOnce();
        } catch {
          declineOnce();
        }
        notify();
        return;
      }
      writePref("install-tip", "yes"); // shown how: do not remind again
      setSteps(isIos() ? "ios" : "android");
    },
    later: () => {
      declineOnce();
      notify();
    },
    close: () => {
      setSteps(null);
      notify();
    },
  };
}

/** 「あとで」: ask once more after the next photo, then never. */
function declineOnce() {
  const asks = Number(readPref("install-ask") ?? 0) + 1;
  writePref("install-ask", String(asks));
  writePref("install-ask-at", String(savedCount()));
  if (asks >= 2) writePref("install-tip", "dismissed");
}
