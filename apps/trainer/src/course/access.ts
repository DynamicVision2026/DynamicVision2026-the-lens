// Access stub (WO-010) until the December access Worker: lessons open only when lessonsPublic is
// set, or with ?preview=1 (dev and Architect review), remembered for this tab.
import { loadBundle } from '@lens/scenes';
import { LAUNCH } from '../launch.config';
import { findPass } from './lessons';

const KEY = 'lens.v1.preview';

/** ?preview=1 seen in this tab (dev and Architect review), regardless of lessonsPublic. */
export function previewOn(search: string = window.location.search): boolean {
  try {
    if (new URLSearchParams(search).get('preview') === '1') window.sessionStorage.setItem(KEY, '1');
    return window.sessionStorage.getItem(KEY) === '1';
  } catch {
    return new URLSearchParams(search).get('preview') === '1';
  }
}

export function lessonsOpen(search: string = window.location.search): boolean {
  if (LAUNCH.lessonsPublic) return true;
  return previewOn(search);
}

/**
 * Lessons of one Pass. A `planned` Pass (waitlist, ADR-003 §3) opens only with preview, even after
 * Stage 1 goes public, so Stage 2/3 seed content never reaches families before it is sold and reviewed.
 */
export function passOpen(passId: string, search: string = window.location.search): boolean {
  const pass = findPass(loadBundle(), passId);
  if (pass?.status === 'planned') return previewOn(search);
  return lessonsOpen(search);
}
