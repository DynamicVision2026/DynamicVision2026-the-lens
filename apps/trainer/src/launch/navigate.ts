// A minimal path switch (no router library): in-app links push a path and the app re-renders.
// With Cloudflare's SPA mode each pushed path is counted as a page view.
import { useEffect, useState } from 'react';

const EVENT = 'lens:navigate';

/** `replace`: swap the current entry (e.g. /open?k=… so the key doesn't stay in the history). */
export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  if (window.location.pathname === path) return;
  if (opts.replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
  window.dispatchEvent(new Event(EVENT));
}

export function usePath(): string {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    window.addEventListener(EVENT, update);
    // A child's effect may navigate before this one subscribes (child effects run first): catch up.
    update();
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(EVENT, update);
    };
  }, []);
  return path;
}
