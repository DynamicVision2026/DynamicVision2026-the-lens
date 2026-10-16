// @vitest-environment happy-dom
// WO-027 on screen: a book QR (/lesson/<pass>/<lens>?src=book) plays that lens's masterclass for anyone,
// remembered on the device; Steps 2–4, the report and the mixed review stay paid, with the book line and the
// buy / trial buttons; a bought Pass is unaffected; the masterclass ends on the book card.
import { loadBundle } from '@lens/scenes';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { t } from '../i18n/ja';
import { LAUNCH } from '../launch.config';
import { resetAnalytics } from '../launch/analytics';
import { openFromBook, resetAccessMemory } from './access';
import { findPass } from './lessons';
import { masterCards, masterToken } from './masterclass';
import { MasterBeat } from './MasterView';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetAccessMemory();
  resetAnalytics();
  // happy-dom lays nothing out: the guide's finger needs getScreenCTM / DOMPoint / animate (as onboarding.dom.test).
  (SVGElement.prototype as unknown as { getScreenCTM: () => object }).getScreenCTM = () => ({});
  vi.stubGlobal(
    'DOMPoint',
    class {
      constructor(
        public x = 0,
        public y = 0,
      ) {}
      matrixTransform() {
        return this;
      }
    },
  );
  (Element.prototype as unknown as { animate: () => object }).animate = () => ({ cancel() {}, finished: Promise.resolve() });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  delete (SVGElement.prototype as unknown as { getScreenCTM?: unknown }).getScreenCTM;
  vi.unstubAllGlobals();
});

const visit = (url: string) => {
  act(() => root.unmount());
  root = createRoot(host);
  window.history.replaceState(null, '', url);
  act(() => root.render(<App />));
};
const masterclass = () => host.querySelector('main.lesson.master');
const locked = () => host.querySelector('.locked-note');
const tiles = () => [...host.querySelectorAll('.tile')].map((b) => ({ name: b.querySelector('.nm')?.textContent ?? '', locked: b.classList.contains('locked') }));

describe('book QR codes (WO-027)', () => {
  it('/lesson/koukou_juken/area?src=book plays the area masterclass and remembers it', () => {
    visit('/lesson/koukou_juken/area?src=book');
    expect(window.location.pathname).toBe('/lesson/koukou_juken/area/master');
    expect(masterclass()).not.toBeNull();
    expect(JSON.parse(window.localStorage.getItem('lens.v1.book.koukou_juken')!)).toEqual(['area']);
    // A later visit without the parameter still opens it.
    resetAccessMemory();
    visit('/lesson/koukou_juken/area/master');
    expect(masterclass()).not.toBeNull();
  });

  it('every pass and lens: its QR opens its masterclass', () => {
    for (const p of loadBundle().passes!.filter((x) => x.lessons.length > 0)) {
      for (const l of p.lessons) {
        visit(`/lesson/${p.id}/${l.lens}?src=book`);
        expect(window.location.pathname, `${p.id}/${l.lens}`).toBe(`/lesson/${p.id}/${l.lens}/master`);
        expect(masterclass(), `${p.id}/${l.lens}`).not.toBeNull();
      }
    }
  });

  it('Steps 2–4, the report and the mixed review stay paid, with the book line and buy / trial buttons', () => {
    visit('/lesson/koukou_juken/area?src=book');
    for (const url of ['/lesson/koukou_juken/area', '/lesson/koukou_juken/area/practice', '/lesson/koukou_juken/area/timed', '/report/koukou_juken', '/drill/koukou_juken']) {
      visit(url);
      expect(masterclass(), url).toBeNull();
      expect(locked(), url).not.toBeNull();
      expect(host.textContent, url).toContain(t('case.bookMore'));
      expect(host.innerHTML, url).toContain(`href="${LAUNCH.passes.koukou_juken!.shopUrl}"`);
      expect(host.innerHTML, url).toContain('href="/trial/koukou_juken"');
    }
    // Other lenses' masterclasses stay locked.
    visit('/lesson/koukou_juken/mirror/master');
    expect(masterclass()).toBeNull();
    // On the course page, only the book lens plays (its masterclass).
    visit('/pass/koukou_juken');
    expect(tiles().filter((x) => !x.locked).map((x) => x.name)).toEqual([loadBundle().labels.lenses.area!.ja]);
    // Another Pass shows no book line.
    visit('/pass/chugaku_juken');
    expect(host.textContent).not.toContain(t('case.bookMore'));
  });

  it('a bought Pass is unaffected: the QR opens the lesson as before', () => {
    visit(`/open?p=koukou_juken&k=${LAUNCH.passes.koukou_juken!.key}`);
    visit('/lesson/koukou_juken/area?src=book');
    expect(window.location.pathname).toBe('/lesson/koukou_juken/area');
    expect(locked()).toBeNull();
    expect(host.textContent).not.toContain(t('case.bookMore'));
  });

  it('the trial is unaffected', () => {
    visit('/lesson/koukou_juken/area?src=book');
    visit('/trial/koukou_juken');
    expect(window.location.pathname).toBe('/lesson/koukou_juken/enclose/master');
    visit('/lesson/koukou_juken/enclose/practice');
    expect(locked()).toBeNull();
    visit('/lesson/koukou_juken/area/practice');
    expect(locked()).not.toBeNull();
  });

  it('the masterclass ends on the book card (no practice button) for a book reader', () => {
    openFromBook('koukou_juken', 'area');
    const pass = findPass(loadBundle(), 'koukou_juken')!;
    const cards = masterCards(pass.lessons.find((l) => l.lens === 'area')!)!;
    act(() => root.render(<MasterBeat beat="onboarding" cards={cards} lens="area" passId="koukou_juken" m={masterToken()} onNext={() => {}} scope={null} />));
    for (const b of [...host.querySelectorAll<HTMLButtonElement>('.chips .cl')]) act(() => b.click());
    const right = loadBundle().labels.lenses[cards.try.picker.correct]!.ja;
    const opt = [...host.querySelectorAll<HTMLButtonElement>('.opt')].find((b) => b.textContent === right)!;
    act(() => opt.click());
    expect(host.textContent).toContain(t('master.bookEnd'));
    expect(host.textContent).not.toContain(t('master.start', { n: masterToken().practice_round }));
    expect(host.innerHTML).toContain(`href="${LAUNCH.passes.koukou_juken!.shopUrl}"`);
    expect(host.innerHTML).toContain('href="/trial/koukou_juken"');
  });
});
