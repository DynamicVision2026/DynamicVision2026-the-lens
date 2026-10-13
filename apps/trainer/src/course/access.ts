// Access stub (WO-010) until the December access Worker: lessons open only when lessonsPublic is
// set, or with ?preview=1 (dev and Architect review), remembered for this tab.
import { LAUNCH } from '../launch.config';

const KEY = 'lens.v1.preview';

export function lessonsOpen(search: string = window.location.search): boolean {
  if (LAUNCH.lessonsPublic) return true;
  try {
    if (new URLSearchParams(search).get('preview') === '1') window.sessionStorage.setItem(KEY, '1');
    return window.sessionStorage.getItem(KEY) === '1';
  } catch {
    return new URLSearchParams(search).get('preview') === '1';
  }
}
