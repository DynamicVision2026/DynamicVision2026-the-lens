import { useEffect, useState } from "react";
import { readPref, writePref } from "../state";

/**
 * Home-screen install + data safety.
 * - service worker (production builds only): the app opens offline; /api/* is never cached
 * - navigator.storage.persist() after the first 保存: the browser is asked not to evict IndexedDB
 * - install tip after the first 保存 (iPhone/iPad Safari text, or Android/Chrome install button)
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

/** iPhone / iPad Safari (iPadOS reports a Mac: touch points give it away). Other iOS browsers excluded. */
export function isIosSafari(ua = navigator.userAgent, platform = navigator.platform, touch = navigator.maxTouchPoints): boolean {
  const ios = /iPhone|iPad|iPod/.test(ua) || (platform === "MacIntel" && touch > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

/** Remember that a page was saved; after the first one, ask for persistent storage once. */
export function afterSave() {
  if (!readPref("saved-once")) writePref("saved-once", new Date().toISOString());
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

export type InstallTipKind = "ios" | "prompt" | null;

/** Which install tip to show right now (null = none). */
export function useInstallTip(): { kind: InstallTipKind; install: () => Promise<void>; dismiss: () => void } {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  let kind: InstallTipKind = null;
  if (readPref("saved-once") && !readPref("install-tip") && !isStandalone()) {
    if (isIosSafari()) kind = "ios";
    else if (deferred) kind = "prompt";
  }
  return {
    kind,
    install: async () => {
      const e = deferred;
      if (!e) return;
      deferred = null;
      try {
        await e.prompt();
        const choice = await e.userChoice;
        writePref("install-tip", choice?.outcome === "accepted" ? "installed" : "dismissed");
      } catch {
        writePref("install-tip", "dismissed");
      }
      notify();
    },
    dismiss: () => {
      writePref("install-tip", "dismissed");
      notify();
    },
  };
}
