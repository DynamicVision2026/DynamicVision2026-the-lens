// @vitest-environment happy-dom
// WO-025: Google Analytics 4 (on since launch day, G-R0EDK9VT6C). With ga4Id '' nothing loads and nothing is sent; with a test ID each event
// fires once with its params (window.gtag mocked). /open with and without o=<order number>.
import { loadBundle } from '@lens/scenes';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { App } from '../App';
import { openWithKey, resetAccessMemory, startTrial } from '../course/access';
import type { PlayOpts } from '../course/play';
import { LAUNCH } from '../launch.config';
import { initAnalytics, orderFrom, rememberSrc, resetAnalytics } from './analytics';
import { FOOTER } from './copy';

// The practice's problems and the check's pick + clue are played elsewhere; here each answers at once.
vi.mock('../course/LessonView', async (orig) => ({
  ...(await orig<typeof import('../course/LessonView')>()),
  Problem: ({ opts, onNext }: { opts?: PlayOpts; onNext: () => void }) => (
    <button type="button" className="stub-answer" onClick={() => (opts?.onResult?.({ clean: true }), onNext())} />
  ),
}));
vi.mock('../course/PickClue', async (orig) => ({
  ...(await orig<typeof import('../course/PickClue')>()),
  usePickClue: () => ({ s: { phase: 'clue', tried: [], clueChip: 'done', wrongChips: [] } }),
  PickCard: () => null,
  ClueCard: () => null,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A Shopify order name ("#" and the number), built so the hex-literal check does not read it as a colour. */
const ON = (n: number) => `#${n}`;
const KEY = (p: string) => LAUNCH.passes[p]!.key;
const firstLens = (p: string) => loadBundle().passes!.find((x) => x.id === p)!.lessons[0]!.lens;
const gaScripts = () => document.head.querySelectorAll('script[src*="googletagmanager.com"]');

let host: HTMLDivElement;
let root: Root;
let gtag: Mock;
/** Keeps clicked shop links from leaving the test page. */
const stay = (e: Event) => e.preventDefault();

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetAccessMemory();
  resetAnalytics();
  delete window.gtag;
  delete window.dataLayer;
  gaScripts().forEach((s) => s.remove());
  document.addEventListener('click', stay);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.removeEventListener('click', stay);
  vi.useRealTimers();
});

const visit = (url: string) => {
  window.history.replaceState(null, '', url);
  act(() => {
    root.render(<App />);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
};
/** Turns analytics on with a test ID, then swaps in a mock gtag. */
const on = () => {
  expect(initAnalytics('G-TEST0000')).toBe(true);
  gtag = vi.fn();
  window.gtag = gtag;
};
const events = (name: string) => gtag.mock.calls.filter((c) => c[0] === 'event' && c[1] === name).map((c) => c[2]);

describe('off (ga4Id empty)', () => {
  it('ships with 視点レンズ\'s own measurement ID (never another product\'s)', () => {
    expect(LAUNCH.ga4Id).toBe('G-R0EDK9VT6C');
  });

  it('loads no script and sends nothing, even through the whole access flow', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(initAnalytics('')).toBe(false);
    visit('/');
    visit(`/open?p=koukou_juken&k=${KEY('koukou_juken')}&o=%231234`);
    visit('/trial/chugaku_juken');
    expect(gaScripts()).toHaveLength(0);
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('on (a test ID)', () => {
  it('loads gtag.js once, with Google signals and ad personalisation off, and no automatic page_view', () => {
    initAnalytics('G-TEST0000');
    initAnalytics('G-TEST0000');
    expect(gaScripts()).toHaveLength(1);
    expect(gaScripts()[0]!.getAttribute('src')).toBe('https://www.googletagmanager.com/gtag/js?id=G-TEST0000');
    const config = (window.dataLayer as IArguments[]).map((a) => [...a]).find((a) => a[0] === 'config')!;
    expect(config[1]).toBe('G-TEST0000');
    expect(config[2]).toMatchObject({ send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
    expect(config[2]).not.toHaveProperty('user_id');
  });

  it('a later visit keeps the remembered order number as user_id', () => {
    window.localStorage.setItem('lens.v1.order.daigaku_juken', ON(2001));
    initAnalytics('G-TEST0000');
    const config = (window.dataLayer as IArguments[]).map((a) => [...a]).find((a) => a[0] === 'config')!;
    expect(config[2]).toMatchObject({ user_id: ON(2001) });
  });

  it('page_view: once per route, the path only', () => {
    on();
    visit('/');
    expect(events('page_view')).toEqual([{ page_path: '/', page_location: `${window.location.origin}/` }]);
    visit('/external');
    expect(events('page_view').map((p) => p.page_path)).toEqual(['/', '/external']);
  });

  it('select_course: 「このコースを買う」 on the landing page and on a locked course', () => {
    on();
    visit('/');
    act(() => host.querySelectorAll<HTMLAnchorElement>('.lp2-btn.buy')[1]!.click());
    visit('/pass/daigaku_juken');
    act(() => host.querySelector<HTMLAnchorElement>('.locked-note a.go')!.click());
    expect(events('select_course').map((p) => p.pass)).toEqual(['koukou_juken', 'daigaku_juken']);
  });

  it('trial_start: once, when the trial starts (not when it was already running)', () => {
    on();
    visit('/trial/chugaku_juken');
    visit('/trial/chugaku_juken');
    expect(events('trial_start')).toEqual([{ pass: 'chugaku_juken', page_location: expect.any(String) }]);
  });

  it('course_open with o: the order number as param and user_id, remembered on the device; no key in GA', () => {
    on();
    visit(`/open?p=koukou_juken&k=${KEY('koukou_juken')}&o=%231234`);
    expect(window.location.pathname).toBe('/pass/koukou_juken');
    expect(events('course_open')).toEqual([{ pass: 'koukou_juken', order: ON(1234), page_location: `${window.location.origin}/open` }]);
    expect(gtag).toHaveBeenCalledWith('set', { user_id: ON(1234) });
    expect(window.localStorage.getItem('lens.v1.order.koukou_juken')).toBe(ON(1234));
    expect(JSON.stringify(gtag.mock.calls)).not.toContain(KEY('koukou_juken'));
  });

  it('course_open without o (old links): the pass only, no user_id', () => {
    on();
    visit(`/open?p=chugaku_juken&k=${KEY('chugaku_juken')}`);
    expect(window.location.pathname).toBe('/pass/chugaku_juken');
    expect(events('course_open')).toEqual([{ pass: 'chugaku_juken', page_location: expect.any(String) }]);
    expect(gtag.mock.calls.some((c) => c[0] === 'set')).toBe(false);
    expect(window.localStorage.getItem('lens.v1.order.chugaku_juken')).toBeNull();
  });

  it('a wrong key sends no course_open', () => {
    on();
    visit('/open?p=chugaku_juken&k=nope&o=%231234');
    expect(events('course_open')).toEqual([]);
    expect(window.localStorage.getItem('lens.v1.order.chugaku_juken')).toBeNull();
  });

  it('lesson_open: masterclass and practice, as paid, trial or preview', () => {
    on();
    const ml = firstLens('chugaku_juken');
    openWithKey('chugaku_juken', KEY('chugaku_juken'));
    visit(`/lesson/chugaku_juken/${ml}/master`);
    const kl = firstLens('koukou_juken');
    startTrial('koukou_juken');
    visit(`/lesson/koukou_juken/${kl}/practice`);
    const dl = firstLens('daigaku_juken');
    visit(`/lesson/daigaku_juken/${dl}/practice?preview=1`);
    expect(events('lesson_open').map(({ pass, lesson, mode }) => ({ pass, lesson, mode }))).toEqual([
      { pass: 'chugaku_juken', lesson: ml, mode: 'paid' },
      { pass: 'koukou_juken', lesson: kl, mode: 'trial' },
      { pass: 'daigaku_juken', lesson: dl, mode: 'preview' },
    ]);
  });

  it('lesson_complete: once the practice round\'s last problem is answered', () => {
    on();
    const lens = firstLens('chugaku_juken');
    visit(`/lesson/chugaku_juken/${lens}/practice?preview=1`);
    let n = 0;
    while (host.querySelector('.stub-answer') && n < 20) {
      expect(events('lesson_complete')).toEqual([]);
      act(() => host.querySelector<HTMLButtonElement>('.stub-answer')!.click());
      n++;
    }
    expect(host.querySelector('.round-result')).not.toBeNull();
    expect(events('lesson_complete').map(({ pass, lesson }) => ({ pass, lesson }))).toEqual([{ pass: 'chugaku_juken', lesson: lens }]);
  });

  it('check_complete: once, when the free check finishes', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    on();
    visit('/check');
    for (let i = 0; i < 20 && events('check_complete').length === 0; i++) act(() => vi.advanceTimersByTime(800));
    expect(host.querySelector('.result')).not.toBeNull();
    expect(events('check_complete')).toEqual([{ page_location: expect.any(String) }]);
  });
});

describe('book readers (WO-027)', () => {
  it('book_open once per lens per device; src=book as a user property and a page_view param; no query in any event', () => {
    on();
    visit('/lesson/koukou_juken/area?src=book');
    visit('/pass/koukou_juken');
    visit('/lesson/koukou_juken/area?src=book');
    visit('/lesson/koukou_juken/mirror?src=book');
    expect(events('book_open').map(({ pass, lens }) => ({ pass, lens }))).toEqual([
      { pass: 'koukou_juken', lens: 'area' },
      { pass: 'koukou_juken', lens: 'mirror' },
    ]);
    expect(gtag).toHaveBeenCalledWith('set', 'user_properties', { src: 'book' });
    expect(window.localStorage.getItem('lens.v1.src')).toBe('book');
    expect(events('page_view').some((p) => p.src === 'book')).toBe(true);
    expect(events('lesson_open').map((p) => p.mode)).toContain('book');
    for (const c of gtag.mock.calls) {
      const params = c[2] as Record<string, unknown> | undefined;
      if (c[0] === 'event') expect(String(params?.page_location), JSON.stringify(c)).not.toContain('?');
    }
    expect(JSON.stringify(gtag.mock.calls)).not.toContain('src=book');
  });

  it('the back-cover QR (/?src=book) remembers src=book on the landing page, before its page_view', () => {
    on();
    visit('/?src=book');
    expect(window.localStorage.getItem('lens.v1.src')).toBe('book');
    const calls = gtag.mock.calls.map((c) => [c[0], c[1]]);
    const set = calls.findIndex(([a, b]) => a === 'set' && b === 'user_properties');
    const view = calls.findIndex(([a, b]) => a === 'event' && b === 'page_view');
    expect(set).toBeGreaterThanOrEqual(0);
    expect(set).toBeLessThan(view);
    expect(events('book_open')).toEqual([]);
  });

  it('a later visit sends the remembered src from the start; the first touch wins', () => {
    window.localStorage.setItem('lens.v1.src', 'book');
    initAnalytics('G-TEST0000');
    const sets = (window.dataLayer as IArguments[]).map((a) => [...a]).filter((a) => a[0] === 'set');
    expect(sets).toContainEqual(['set', 'user_properties', { src: 'book' }]);
    window.localStorage.setItem('lens.v1.src', 'shorts');
    expect(rememberSrc('book')).toBe('shorts');
    expect(window.localStorage.getItem('lens.v1.src')).toBe('shorts');
  });

  it('off: a book visit sends nothing but still opens the masterclass', () => {
    visit('/lesson/daigaku_juken/balance?src=book');
    expect(window.location.pathname).toBe('/lesson/daigaku_juken/balance/master');
    expect(window.gtag).toBeUndefined();
    expect(gaScripts()).toHaveLength(0);
  });
});

describe('/open o= parameter', () => {
  it('takes a Shopify order name, ignores anything else', () => {
    expect(orderFrom('?o=%231234')).toBe(ON(1234));
    expect(orderFrom('?o=1234')).toBe('1234');
    expect(orderFrom('?p=x')).toBeNull();
    expect(orderFrom('?o=')).toBeNull();
    expect(orderFrom('?o=a%40b.com')).toBeNull();
    expect(orderFrom(`?o=${'9'.repeat(40)}`)).toBeNull();
  });
});

describe('外部送信について', () => {
  it('the footer links to it and the page names Google, what is sent, the purpose, no ads, and the opt-out', () => {
    visit('/');
    expect(host.querySelector('footer a[href="/external"]')!.textContent).toBe(FOOTER.external);
    visit('/external');
    const text = host.textContent ?? '';
    for (const s of ['Google LLC', '注文番号', 'コースの改善', '広告には使いません', 'tools.google.com/dlpage/gaoptout']) expect(text).toContain(s);
  });
});
