import { loadBundle } from '@lens/scenes';
import { describe, expect, it } from 'vitest';
import { checkProblems, DRILL_BOUNDARY, drillProblems, seconds, summarize, type CheckAnswer } from './check';
import { findPass } from './lessons';

const pass = findPass(loadBundle(), 'chugaku_juken')!;

/** A seeded random source, so the run is reproducible. */
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

describe('check problems', () => {
  it('asks one level-1/2 problem per lens, 8 in all, in mixed order', () => {
    const ps = checkProblems(pass, seeded(7));
    expect(ps).toHaveLength(8);
    expect(new Set(ps.map((p) => p.lens)).size).toBe(8);
    for (const p of ps) expect(p.level ?? 1).toBeLessThanOrEqual(2);
    const order = ps.map((p) => p.lens).join(',');
    expect(order).not.toBe(pass.lessons.map((l) => l.lens).join(','));
  });
});

describe('result for a scripted run', () => {
  const run: CheckAnswer[] = [
    { cardId: 'enclose-002', lens: 'enclose', firstPick: 'enclose', ms: 3000 },
    { cardId: 'area-001', lens: 'area', firstPick: 'balance', ms: 9000 },
    { cardId: 'balance-001', lens: 'balance', firstPick: 'area', ms: 7000 },
    { cardId: 'constant-001', lens: 'constant', firstPick: 'constant', ms: 4000 },
    { cardId: 'freeze-001', lens: 'freeze', firstPick: 'freeze', ms: 5000 },
    { cardId: 'mirror-001', lens: 'mirror', firstPick: 'mirror', ms: 6000 },
    { cardId: 'slide-001', lens: 'slide', firstPick: 'slide', ms: 2000 },
    { cardId: 'area-001-v1', lens: 'area', firstPick: 'balance', ms: 4000 },
  ];
  const r = summarize(run);

  it('counts first-pick hits', () => {
    expect(r.correct).toBe(5);
    expect(r.total).toBe(8);
  });

  it('lists confusion pairs, most frequent first', () => {
    expect(r.confusions).toEqual([
      ['area', 'balance', 2],
      ['balance', 'area', 1],
    ]);
  });

  it('averages the decision time and suggests the slowest miss', () => {
    expect(r.averageMs).toBe(5000);
    expect(seconds(r.averageMs)).toBe('5.0');
    expect(r.suggest).toBe('area');
  });

  it('suggests the slowest lens when every pick was right', () => {
    expect(summarize(run.filter((a) => a.firstPick === a.lens)).suggest).toBe('mirror');
  });
});

describe('week-4 mixed drill', () => {
  const lenses = pass.lessons.map((l) => l.lens);
  const parent = (id: string) => id.replace(/-v\d+$/, '');

  it('asks 10: one standard problem per lens plus 2 boundary problems from different lenses, mixed', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const ps = drillProblems(pass, seeded(seed));
      expect(ps).toHaveLength(lenses.length + DRILL_BOUNDARY);
      const standard = ps.filter((c) => c.kind === 'standard');
      const boundary = ps.filter((c) => c.kind !== 'standard');
      expect(new Set(standard.map((c) => c.lens))).toEqual(new Set(lenses));
      expect(boundary).toHaveLength(DRILL_BOUNDARY);
      expect(new Set(boundary.map((c) => c.lens)).size).toBe(DRILL_BOUNDARY);
      // A boundary card's right pick is its best move, not its lesson's lens.
      for (const c of boundary) expect(c.picker.correct).not.toBe(c.lens);
    }
  });

  it('draws from every level, variants and boundary kinds over many runs', () => {
    const seen = { levels: new Set<number>(), variants: 0, kinds: new Set<string>() };
    for (let seed = 1; seed <= 200; seed++) {
      for (const c of drillProblems(pass, seeded(seed))) {
        seen.levels.add(c.level ?? 1);
        if (c.id !== parent(c.id)) seen.variants++;
        seen.kinds.add(c.kind);
      }
    }
    expect([...seen.levels].sort()).toEqual([1, 2, 3, 4]);
    expect(seen.variants).toBeGreaterThan(0);
    expect(seen.kinds).toEqual(new Set(['standard', 'failure', 'no_lens']));
  });

  it('scores pick + clue: clean needs both firsts right', () => {
    const r = summarize([
      { cardId: 'a', lens: 'area', firstPick: 'area', ms: 1000, clue: true },
      { cardId: 'b', lens: 'direct', firstPick: 'area', ms: 3000, clue: true },
      { cardId: 'c', lens: 'freeze', firstPick: 'freeze', ms: 2000, clue: false },
    ]);
    expect(r).toMatchObject({ correct: 2, clean: 1, total: 3 });
    expect(r.confusions).toEqual([['direct', 'area', 1]]);
  });
});
