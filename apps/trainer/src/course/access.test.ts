// WO-024: the access link unlocks exactly its Pass on this device; preview still opens everything; blocked
// storage still unlocks for the visit.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LAUNCH } from '../launch.config';
import { lessonOpen, openWithKey, passOpen, resetAccessMemory, startTrial, trialLens, trialState, unlocked } from './access';

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
