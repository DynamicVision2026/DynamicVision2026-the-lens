// Access (WO-024): a soft lock with no server and no account. The order email's link
// /open?p=<pass>&k=<key> unlocks that Pass on this device (localStorage lens.v1.unlock.<pass>); if
// storage is blocked, it stays unlocked in memory for this visit. ?preview=1 (dev and Architect review)
// opens every Pass for the tab. The free 3-minute check is always open.
import { LAUNCH } from '../launch.config';

const PREVIEW = 'lens.v1.preview';
const unlockKey = (passId: string) => `lens.v1.unlock.${passId}`;
/** Unlocks that could not be stored (private mode, blocked storage): good for this visit. */
const memory = new Set<string>();

/** ?preview=1 seen in this tab (dev and Architect review). */
export function previewOn(search: string = window.location.search): boolean {
  try {
    if (new URLSearchParams(search).get('preview') === '1') window.sessionStorage.setItem(PREVIEW, '1');
    return window.sessionStorage.getItem(PREVIEW) === '1';
  } catch {
    return new URLSearchParams(search).get('preview') === '1';
  }
}

/** This Pass was unlocked on this device (an access link). */
export function unlocked(passId: string): boolean {
  if (memory.has(passId)) return true;
  try {
    return window.localStorage.getItem(unlockKey(passId)) === '1';
  } catch {
    return false;
  }
}

/** The access link: unlocks only the Pass whose key matches. Returns whether it did. */
export function openWithKey(passId: string | null, key: string | null): boolean {
  const pass = passId ? LAUNCH.passes[passId] : undefined;
  if (!pass || !key || key !== pass.key) return false;
  memory.add(passId!);
  try {
    window.localStorage.setItem(unlockKey(passId!), '1');
  } catch {
    // Storage blocked: the memory copy keeps it open for this visit.
  }
  return true;
}

/** Lessons of one Pass: open once unlocked on this device, or with preview. */
export function passOpen(passId: string, search: string = window.location.search): boolean {
  return unlocked(passId) || previewOn(search);
}

/** For tests: forget the in-memory unlocks. */
export function resetAccessMemory() {
  memory.clear();
}
