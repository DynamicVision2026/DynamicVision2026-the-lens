// WO-019: the attempt log (one record per first pick, visible time only, ring cap, never throws), the
// week-4 picker (no day-1 repeats, 8 lenses at matching levels) and the parent report (medians,
// confusions, hidden until complete, no score words or %).
import { loadBundle } from '@lens/scenes';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { anchorOf, ATTEMPTS_CAP, ATTEMPTS_KEY, baseline, cardFor, logAttempt, median, PickLogger, readAttempts, stats, VisibleClock, week4, week4Open, week4Problems, weeklyCounts, type Attempt, type AttemptCtx } from './attempts';
import { checkProblems } from './check';
import { findPass } from './lessons';
import { ReportView } from './ReportView';

const pass = findPass(loadBundle(), 'chugaku_juken')!;
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

class MemStorage {
  data = new Map<string, string>();
  fail = false;
  getItem(k: string) {
    if (this.fail) throw new Error('blocked');
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.fail) throw new Error('QuotaExceeded');
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}
let store: MemStorage;
const g = globalThis as unknown as { window?: unknown };
beforeEach(() => {
  store = new MemStorage();
  g.window = { localStorage: store, confirm: () => true };
});
afterEach(() => {
  delete g.window;
});

const rec = (over: Partial<Attempt>): Attempt => ({ at: '2026-10-01T09:00:00.000Z', pass: 'chugaku_juken', ctx: 'check', sid: 's1', card: 'area-002', anchor: 'area-002', want: 'area', first: 'area', ok: true, ms: 3000, ...over });

describe('the attempt log', () => {
  it.each(['check', 'lesson', 'drill', 'timer', 'week4'] as AttemptCtx[])('%s: one record per first pick; msRight after a wrong first', (ctx) => {
    const card = cardFor('area-002')!;
    let t = 0;
    const log = new PickLogger({ ctx, pass: 'chugaku_juken', sid: 'x' }, card, () => t);
    t = 4200;
    expect(log.pick('balance')).toBe(4200);
    t = 6100;
    expect(log.pick('constant')).toBeNull();
    t = 7300;
    expect(log.pick('area')).toBeNull();
    const all = readAttempts();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ ctx, card: 'area-002', anchor: 'area-002', want: 'area', first: 'balance', ok: false, ms: 4200, msRight: 7300 });
  });

  it('logs a variant against its anchor, and a right first pick without msRight', () => {
    const v = cardFor('area-002-v1')!;
    new PickLogger({ ctx: 'lesson', pass: 'chugaku_juken', sid: 'y' }, v, () => 1500).pick('area');
    expect(readAttempts()[0]).toMatchObject({ card: 'area-002-v1', anchor: 'area-002', ok: true, ms: 1500 });
    expect(readAttempts()[0]!.msRight).toBeUndefined();
  });

  it('excludes hidden-tab time', () => {
    let now = 0;
    const listeners: Record<string, () => void> = {};
    const doc = { visibilityState: 'visible' as DocumentVisibilityState, addEventListener: (_: string, f: () => void) => (listeners.v = f), removeEventListener: () => {} };
    const c = new VisibleClock(() => now, doc as unknown as Document);
    c.start();
    now = 2000;
    doc.visibilityState = 'hidden';
    listeners.v!();
    now = 302_000; // five minutes away
    expect(c.elapsed()).toBe(2000);
    doc.visibilityState = 'visible';
    listeners.v!();
    now = 303_500;
    expect(c.elapsed()).toBe(3500);
  });

  it('keeps the newest records only', () => {
    store.setItem(ATTEMPTS_KEY, JSON.stringify(Array.from({ length: ATTEMPTS_CAP }, (_, i) => rec({ card: `c${i}` }))));
    logAttempt(rec({ card: 'newest' }));
    const all = readAttempts();
    expect(all).toHaveLength(ATTEMPTS_CAP);
    expect(all[0]!.card).toBe('c1');
    expect(all[all.length - 1]!.card).toBe('newest');
  });

  it('never throws when storage fails', () => {
    store.fail = true;
    expect(() => logAttempt(rec({}))).not.toThrow();
    expect(readAttempts()).toEqual([]);
    expect(() => new PickLogger({ ctx: 'check', pass: 'chugaku_juken', sid: 'z' }, cardFor('area-002')!, () => 1).pick('area')).not.toThrow();
  });
});

/** A complete session from a list of cards. */
const session = (ctx: AttemptCtx, sid: string, at: string, cards: string[], picks: (c: string) => { first: string; ms: number }) =>
  cards.map((card) => {
    const c = cardFor(card)!;
    const p = picks(card);
    return rec({ ctx, sid, at, card, anchor: anchorOf(card), want: c.picker.correct, first: p.first, ok: p.first === c.picker.correct, ms: p.ms });
  });

describe('the week-4 check', () => {
  it('never repeats a day-1 card or variant, and covers every lens at the day-1 level', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const day1 = checkProblems(pass, seeded(seed));
      const log = session('check', 'd1', '2026-10-01T09:00:00.000Z', day1.map((c) => c.id), (c) => ({ first: cardFor(c)!.picker.correct, ms: 5000 }));
      const w4 = week4Problems(pass, log, seeded(seed + 1000));
      expect(w4).toHaveLength(pass.lessons.length);
      expect(new Set(w4.map((c) => c.lens))).toEqual(new Set(pass.lessons.map((l) => l.lens)));
      const seen = new Set(day1.map((c) => c.id));
      for (const c of w4) expect(seen.has(c.id), `seed ${seed} repeats ${c.id}`).toBe(false);
      for (const c of w4) {
        const before = day1.find((d) => d.lens === c.lens)!;
        expect(c.level ?? 1, `${c.id} vs ${before.id}`).toBe(before.level ?? 1);
      }
    }
  });

  it('opens on day 22 after the baseline', () => {
    const base = baseline(session('check', 'd1', '2026-10-01T09:00:00.000Z', checkProblems(pass, seeded(1)).map((c) => c.id), () => ({ first: 'area', ms: 1 })), 'chugaku_juken');
    expect(week4Open(base, Date.parse('2026-10-21T09:00:00.000Z'))).toBe(false);
    expect(week4Open(base, Date.parse('2026-10-22T09:00:00.000Z'))).toBe(true);
    expect(week4Open(null)).toBe(false);
  });
});

describe('the parent report', () => {
  const day1Cards = checkProblems(pass, seeded(5)).map((c) => c.id);
  const msDay1 = [9000, 11000, 12000, 15000, 8000, 10000, 13000, 14000];
  const day1 = session('check', 'd1', '2026-10-01T09:00:00.000Z', day1Cards, (c) => {
    const i = day1Cards.indexOf(c);
    const want = cardFor(c)!.picker.correct;
    // Two mix-ups on day 1: the first two problems picked as 'direct' (or 'area' when direct is right).
    return { first: i < 2 ? (want === 'direct' ? 'area' : 'direct') : want, ms: msDay1[i]! };
  });

  it('computes medians and confusion counts for a scripted log', () => {
    const s = stats(baseline(day1, 'chugaku_juken')!);
    expect(s.medianMs).toBe(median(msDay1));
    expect(s.medianMs).toBe(11500);
    expect(s.ok).toBe(6);
    expect(Object.values(s.confusions).reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('is hidden until both sessions are complete, then shows the rows with no score words or %', () => {
    store.setItem(ATTEMPTS_KEY, JSON.stringify(day1.slice(0, 5)));
    let html = renderToStaticMarkup(<ReportView passId="chugaku_juken" />);
    expect(html).toContain('はじめの8問チェックがまだです');
    store.setItem(ATTEMPTS_KEY, JSON.stringify(day1));
    html = renderToStaticMarkup(<ReportView passId="chugaku_juken" />);
    expect(html).toContain('4週目のチェックで、はじめとくらべられます');
    expect(html).not.toContain('→ 4週目');

    const w4Cards = week4Problems(pass, day1, seeded(9)).map((c) => c.id);
    const wk = session('week4', 'w4', '2026-10-25T09:00:00.000Z', w4Cards, (c) => ({ first: cardFor(c)!.picker.correct, ms: 3000 }));
    const practice = [rec({ ctx: 'lesson', at: '2026-10-03T09:00:00.000Z' }), rec({ ctx: 'drill', at: '2026-10-20T09:00:00.000Z' })];
    const all = [...day1, ...practice, ...wk];
    store.setItem(ATTEMPTS_KEY, JSON.stringify(all));
    expect(week4(all, 'chugaku_juken')!.attempts).toHaveLength(8);
    expect(weeklyCounts(all, 'chugaku_juken', day1[0]!.at)).toEqual([1, 0, 1, 0]);
    html = renderToStaticMarkup(<ReportView passId="chugaku_juken" />);
    const text = html.replace(/<[^>]+>/g, ' ');
    expect(text).toContain('はじめ 11.5秒 → 4週目 3.0秒');
    expect(text).toContain('6 / 8問 → 8 / 8問');
    expect(text).toContain('：1回 → 0回');
    expect(text).toContain('1週目 1問 · 2週目 0問 · 3週目 1問 · 4週目 0問');
    expect(text).toContain('この記録は、この端末の中だけに保存されています');
    for (const banned of ['点数', '合格', '偏差値', '%', '％']) expect(text, banned).not.toContain(banned);
    // Once week 4 is in: no unlock line, a separate re-measure line, and the ✓/✗ column says what it means.
    expect(text).not.toContain('22日目にひらきます');
    expect(text).not.toContain('今すぐ測る');
    expect(text).toContain('もう一度はかる');
    expect(text).toContain('1回目で正しい道具');
  });
});
