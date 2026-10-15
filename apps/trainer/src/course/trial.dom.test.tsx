// @vitest-environment happy-dom
// WO-024 §3a on screen: 「無料ではじめる（3日間）」 opens the Pass's first lesson; the course home shows the time
// left with the other 7 lessons locked; after 72 h the first one locks too, with 「無料体験は終わりました」.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { t } from '../i18n/ja';
import { LAUNCH } from '../launch.config';
import { resetAccessMemory } from './access';

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
  vi.useRealTimers();
});

const visit = (url: string) => {
  act(() => root.unmount());
  root = createRoot(host);
  window.history.replaceState(null, '', url);
  act(() => root.render(<App />));
};
const tiles = () => [...host.querySelectorAll('.tile')].map((b) => ({ name: b.querySelector('.nm')?.textContent ?? '', locked: b.classList.contains('locked') }));

describe('the 3-day free trial on screen', () => {
  it('/trial/daigaku_juken opens てんびん (its masterclass first) and nothing else', () => {
    visit('/trial/daigaku_juken');
    expect(window.location.pathname).toBe('/lesson/daigaku_juken/balance/master');
    expect(window.localStorage.getItem('lens.v1.trial.daigaku_juken')).not.toBeNull();
    visit('/pass/daigaku_juken');
    const open = tiles().filter((x) => !x.locked);
    expect(open.map((x) => x.name)).toEqual(['てんびん']);
    expect(tiles()).toHaveLength(8);
    expect(host.textContent).toContain(t('case.trialDays', { n: 3 }));
    expect(host.textContent).toContain(t('case.trialMore'));
    expect(host.innerHTML).toContain(`href="${LAUNCH.passes.daigaku_juken!.shopUrl}"`);
    // Another lesson's deep link shows the course home instead.
    visit('/lesson/daigaku_juken/area');
    expect(host.querySelector('.case')).not.toBeNull();
  });

  it('after 72 h the first lesson locks too, with 「無料体験は終わりました」 and the buy button', () => {
    window.localStorage.setItem('lens.v1.trial.koukou_juken', new Date(Date.now() - 73 * 3_600_000).toISOString());
    visit('/pass/koukou_juken');
    expect(tiles().every((x) => x.locked)).toBe(true);
    expect(host.textContent).toContain(t('case.trialEnded'));
    expect(host.innerHTML).toContain(`href="${LAUNCH.passes.koukou_juken!.shopUrl}"`);
    visit('/lesson/koukou_juken/enclose');
    expect(host.querySelector('.case')).not.toBeNull();
    // 「無料ではじめる」 again does not restart it.
    visit('/trial/koukou_juken');
    expect(window.location.pathname).toBe('/pass/koukou_juken');
  });

  it('shows hours on the last day', () => {
    window.localStorage.setItem('lens.v1.trial.chugaku_juken', new Date(Date.now() - 60 * 3_600_000).toISOString());
    visit('/pass/chugaku_juken');
    expect(host.textContent).toContain(t('case.trialHours', { n: 12 }));
  });

  it('a bought Pass shows no trial at all', () => {
    window.localStorage.setItem('lens.v1.trial.chugaku_juken', new Date(Date.now() - 100 * 3_600_000).toISOString());
    visit(`/open?p=chugaku_juken&k=${LAUNCH.passes.chugaku_juken!.key}`);
    expect(window.location.pathname).toBe('/pass/chugaku_juken');
    expect(tiles().every((x) => !x.locked)).toBe(true);
    expect(host.textContent).not.toContain(t('case.trialEnded'));
  });
});
