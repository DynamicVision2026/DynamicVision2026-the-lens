// WO-024: the access link unlocks exactly its Pass on this device; preview still opens everything; blocked
// storage still unlocks for the visit.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LAUNCH } from '../launch.config';
import { openWithKey, passOpen, resetAccessMemory, unlocked } from './access';

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
    for (const k of keys) expect(k).toMatch(/^[A-Za-z0-9]{16}$/);
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
