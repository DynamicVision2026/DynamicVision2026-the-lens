// @vitest-environment happy-dom
// WO-024: the order email's link /open?p=<pass>&k=<key> lands on that Pass's course home, unlocked; a wrong
// key stays on /open with the help line. (Regression: the redirect fired before the app's path listener.)
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { resetAccessMemory } from '../course/access';
import { LAUNCH } from '../launch.config';
import { OPEN } from './copy';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetAccessMemory();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const visit = (url: string) => {
  window.history.replaceState(null, '', url);
  act(() => root.render(<App />));
};

describe('/open (WO-024)', () => {
  it('the right key opens exactly its course home, unlocked, and drops the key from the address', () => {
    visit(`/open?p=koukou_juken&k=${LAUNCH.passes.koukou_juken!.key}`);
    expect(window.location.pathname).toBe('/pass/koukou_juken');
    expect(window.location.search).toBe('');
    expect(host.querySelector('.case')).not.toBeNull();
    expect(host.querySelectorAll('.tile.locked')).toHaveLength(0);
    expect(window.localStorage.getItem('lens.v1.unlock.koukou_juken')).toBe('1');
    // Another course stays locked.
    act(() => root.unmount());
    root = createRoot(host);
    visit('/pass/daigaku_juken');
    expect(host.querySelectorAll('.tile.locked').length).toBeGreaterThan(0);
  });

  it('a wrong key stays on /open with the help line and the support email', () => {
    visit(`/open?p=daigaku_juken&k=${LAUNCH.passes.koukou_juken!.key}`);
    expect(window.location.pathname).toBe('/open');
    expect(host.textContent).toContain(OPEN.wrong);
    expect(host.innerHTML).toContain(`mailto:${LAUNCH.supportEmail}`);
    expect(window.localStorage.getItem('lens.v1.unlock.daigaku_juken')).toBeNull();
  });
});
