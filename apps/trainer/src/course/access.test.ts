// WO-024: the access link unlocks exactly its Pass on this device; preview still opens everything; blocked
// storage still unlocks for the visit.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LAUNCH } from '../launch.config';
import { loadBundle } from '@lens/scenes';
import { accessMode, bookOpen, bookReader, fromBook, lessonOpen, masterclassOpen, openFromBook, openWithKey, passOpen, resetAccessMemory, startTrial, trialLens, trialState, unlocked } from './access';

function fakeWindow(blocked = false) {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => {
      if (blocked) throw new Error('blocked');
      return store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (blocked) throw new Error('blocked');
      store.set(k, v);
    },
  };
  vi.stubGlobal('window', { localStorage: storage, sessionStorage: storage, location: { search: '' } });
  return store;
}

beforeEach(() => resetAccessMemory());
afterEach(() => vi.unstubAllGlobals());

describe('access links (WO-024)', () => {
  it('has one distinct 16-character key per Pass', () => {
    const keys = Object.values(LAUNCH.passes).map((p) => p.key);
    expect(Object.keys(LAUNCH.passes).sort()).toEqual(['chugaku_juken', 'daigaku_juken', 'koukou_juken']);
    for (const k of keys) expect(k).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(new Set(keys).size).toBe(3);
  });

  it('the right key unlocks only its Pass, and remembers it on the device', () => {
    const store = fakeWindow();
    expect(passOpen('koukou_juken', '')).toBe(false);
    expect(openWithKey('koukou_juken', LAUNCH.passes.koukou_juken!.key)).toBe(true);
    expect(passOpen('koukou_juken', '')).toBe(true);
    expect(passOpen('chugaku_juken', '')).toBe(false);
    expect(passOpen('daigaku_juken', '')).toBe(false);
    expect(store.get('lens.v1.unlock.koukou_juken')).toBe('1');
    // A later visit (memory gone) still finds it in localStorage.
    resetAccessMemory();
    expect(unlocked('koukou_juken')).toBe(true);
  });

  it('a wrong key, another Pass\'s key, or an unknown Pass unlocks nothing', () => {
    fakeWindow();
    expect(openWithKey('koukou_juken', 'wrong-key-000000')).toBe(false);
    expect(openWithKey('koukou_juken', LAUNCH.passes.chugaku_juken!.key)).toBe(false);
    expect(openWithKey('koukou_juken', null)).toBe(false);
    expect(openWithKey('nope', LAUNCH.passes.chugaku_juken!.key)).toBe(false);
    expect(openWithKey(null, LAUNCH.passes.chugaku_juken!.key)).toBe(false);
    for (const id of Object.keys(LAUNCH.passes)) expect(passOpen(id, ''), id).toBe(false);
  });

  it('preview still opens every Pass', () => {
    fakeWindow();
    for (const id of Object.keys(LAUNCH.passes)) expect(passOpen(id, '?preview=1'), id).toBe(true);
  });

  it('with storage blocked, the link still unlocks for this visit', () => {
    fakeWindow(true);
    expect(openWithKey('daigaku_juken', LAUNCH.passes.daigaku_juken!.key)).toBe(true);
    expect(passOpen('daigaku_juken', '')).toBe(true);
    expect(passOpen('chugaku_juken', '')).toBe(false);
  });
});

describe('free trial (WO-024 §3a)', () => {
  const H = 3_600_000;
  const t0 = new Date('2026-10-16T09:00:00Z');

  it('opens each Pass\'s first lesson: 囲む for chugaku and koukou, てんびん for daigaku', () => {
    expect(trialLens('chugaku_juken')).toBe('enclose');
    expect(trialLens('koukou_juken')).toBe('enclose');
    expect(trialLens('daigaku_juken')).toBe('balance');
  });

  it('opens only the first lesson for 72 h, then closes it; other Passes are untouched', () => {
    const store = fakeWindow();
    expect(lessonOpen('daigaku_juken', 'balance', '', t0.getTime())).toBe(false);
    startTrial('daigaku_juken', t0);
    expect(store.get('lens.v1.trial.daigaku_juken')).toBe(t0.toISOString());
    expect(lessonOpen('daigaku_juken', 'balance', '', t0.getTime() + 71 * H)).toBe(true);
    expect(lessonOpen('daigaku_juken', 'enclose', '', t0.getTime() + H)).toBe(false);
    expect(lessonOpen('koukou_juken', 'enclose', '', t0.getTime() + H)).toBe(false);
    expect(trialState('daigaku_juken', t0.getTime() + 24 * H)).toEqual({ status: 'active', msLeft: 48 * H });
    expect(lessonOpen('daigaku_juken', 'balance', '', t0.getTime() + 72 * H)).toBe(false);
    expect(trialState('daigaku_juken', t0.getTime() + 72 * H)).toEqual({ status: 'ended' });
    // The trial is the Pass's whole access only when bought: passOpen stays closed.
    expect(passOpen('daigaku_juken', '')).toBe(false);
  });

  it('never restarts a trial that already started (or ended)', () => {
    const store = fakeWindow();
    startTrial('chugaku_juken', t0);
    startTrial('chugaku_juken', new Date(t0.getTime() + 100 * H));
    expect(store.get('lens.v1.trial.chugaku_juken')).toBe(t0.toISOString());
    expect(trialState('chugaku_juken', t0.getTime() + 100 * H).status).toBe('ended');
  });

  it('a bought Pass ignores the trial: every lesson opens, ended or not', () => {
    fakeWindow();
    startTrial('koukou_juken', t0);
    openWithKey('koukou_juken', LAUNCH.passes.koukou_juken!.key);
    for (const lens of ['enclose', 'slide', 'area']) expect(lessonOpen('koukou_juken', lens, '', t0.getTime() + 500 * H), lens).toBe(true);
  });

  it('with storage blocked, the trial works for this visit', () => {
    fakeWindow(true);
    startTrial('chugaku_juken', t0);
    expect(lessonOpen('chugaku_juken', 'enclose', '', t0.getTime() + H)).toBe(true);
    expect(lessonOpen('chugaku_juken', 'slide', '', t0.getTime() + H)).toBe(false);
  });

  it('ignores an unknown Pass', () => {
    const store = fakeWindow();
    startTrial('nope', t0);
    expect(store.size).toBe(0);
  });
});

describe('book readers (WO-027)', () => {
  const passes = loadBundle().passes!.filter((p) => p.lessons.length > 0);

  it('reads src=book from the query only', () => {
    expect(fromBook('?src=book')).toBe(true);
    expect(fromBook('?src=book&preview=1')).toBe(true);
    expect(fromBook('?src=x')).toBe(false);
    expect(fromBook('')).toBe(false);
  });

  it.each(passes.flatMap((p) => p.lessons.map((l) => [p.id, l.lens] as const)))('%s/%s: the QR opens that masterclass only', (passId, lens) => {
    fakeWindow();
    expect(masterclassOpen(passId, lens, '')).toBe(false);
    expect(openFromBook(passId, lens)).toBe(true);
    expect(masterclassOpen(passId, lens, '')).toBe(true);
    expect(accessMode(passId, lens, '')).toBe('book');
    // Steps 2–4 stay paid.
    expect(lessonOpen(passId, lens, '')).toBe(false);
    expect(passOpen(passId, '')).toBe(false);
    // Other lenses stay locked.
    for (const other of loadBundle().passes!.find((p) => p.id === passId)!.lessons.map((l) => l.lens).filter((l) => l !== lens)) {
      expect(masterclassOpen(passId, other, ''), other).toBe(false);
    }
  });

  it('remembers the lens on the device (a later visit needs no parameter) and counts it once', () => {
    const store = fakeWindow();
    expect(openFromBook('koukou_juken', 'area')).toBe(true);
    expect(openFromBook('koukou_juken', 'area')).toBe(false);
    expect(JSON.parse(store.get('lens.v1.book.koukou_juken')!)).toEqual(['area']);
    resetAccessMemory();
    expect(bookOpen('koukou_juken', 'area')).toBe(true);
    expect(bookReader('koukou_juken')).toBe(true);
    expect(bookReader('chugaku_juken')).toBe(false);
    expect(openFromBook('koukou_juken', 'area')).toBe(false);
    expect(openFromBook('koukou_juken', 'mirror')).toBe(true);
    expect(JSON.parse(store.get('lens.v1.book.koukou_juken')!)).toEqual(['area', 'mirror']);
  });

  it('blocked storage: open for this visit only', () => {
    fakeWindow(true);
    expect(openFromBook('daigaku_juken', 'balance')).toBe(true);
    expect(masterclassOpen('daigaku_juken', 'balance', '')).toBe(true);
    resetAccessMemory();
    expect(masterclassOpen('daigaku_juken', 'balance', '')).toBe(false);
  });

  it('an unknown pass or lens opens nothing', () => {
    fakeWindow();
    expect(openFromBook('nope', 'area')).toBe(false);
    expect(openFromBook('chugaku_juken', 'nope')).toBe(false);
    expect(bookReader('chugaku_juken')).toBe(false);
  });

  it('a paid Pass ignores the book: every step open, mode paid', () => {
    fakeWindow();
    openFromBook('chugaku_juken', 'area');
    openWithKey('chugaku_juken', LAUNCH.passes.chugaku_juken!.key);
    expect(lessonOpen('chugaku_juken', 'area', '')).toBe(true);
    expect(lessonOpen('chugaku_juken', 'mirror', '')).toBe(true);
    expect(accessMode('chugaku_juken', 'area', '')).toBe('paid');
  });

  it('the trial is unchanged: its lens fully open for 3 days, a book lens Step 1 only', () => {
    fakeWindow();
    const t0 = new Date();
    startTrial('koukou_juken', t0);
    openFromBook('koukou_juken', 'area');
    const first = trialLens('koukou_juken')!;
    expect(lessonOpen('koukou_juken', first, '', t0.getTime())).toBe(true);
    expect(accessMode('koukou_juken', first, '', t0.getTime())).toBe('trial');
    expect(lessonOpen('koukou_juken', 'area', '', t0.getTime())).toBe(false);
    expect(masterclassOpen('koukou_juken', 'area', '', t0.getTime())).toBe(true);
    expect(accessMode('koukou_juken', 'area', '', t0.getTime())).toBe('book');
    // After the trial, the book lens's masterclass stays open; the trial lens locks.
    const later = t0.getTime() + 73 * 3_600_000;
    expect(lessonOpen('koukou_juken', first, '', later)).toBe(false);
    expect(masterclassOpen('koukou_juken', 'area', '', later)).toBe(true);
  });
});
