// Steps 3–4: practice order and mastery; the timed set and its record.
import { loadBundle } from '@lens/scenes';
import { describe, expect, it } from 'vitest';
import { findLesson, findPass, lessonProblems } from './lessons';
import { applyPractice, emptyMastery, fasterBy, MASTERY_STREAK, practiceQueue, summarizeTimed, timedSet, trapMinutes } from './practice';

const pass = findPass(loadBundle(), 'chugaku_juken')!;
const lenses = pass.lessons.map((l) => l.lens);
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

describe('step 3: practice', () => {
  it.each(lenses)('%s practises the variants of every card, each type before any repeats', (lens) => {
    const lesson = findLesson(pass, lens)!;
    const problems = lessonProblems(pass, lesson);
    const q = practiceQueue(problems, lesson, seeded(3));
    const anchors = problems.filter((p) => !/-v\d+$/.test(p.card.id)).map((p) => p.card.id);
    const parent = (id: string) => id.replace(/-v\d+$/, '');
    // Every card (boundary ones included) comes up, and the first round covers each card once.
    expect(new Set(q.map((p) => parent(p.card.id)))).toEqual(new Set(anchors));
    expect(new Set(q.slice(0, anchors.length).map((p) => parent(p.card.id))).size).toBe(anchors.length);
    // Variants, not the ladder's own problems (unless a card has none).
    for (const p of q) {
      const a = loadBundle().cards.find((c) => c.id === parent(p.card.id))!;
      if (a.variants.length) expect(p.card.id).toMatch(/-v\d+$/);
    }
    for (const p of q) expect(['scene', 'walkthrough']).toContain(p.mode);
  });

  it('masters the lesson after 3 clean problems in a row, and keeps it', () => {
    let m = emptyMastery('chugaku_juken', 'area');
    for (const clean of [true, true, false, true, true]) m = applyPractice(m, clean);
    expect(m).toMatchObject({ done: false, streak: 2, bestStreak: 2, attempts: 5 });
    m = applyPractice(m, true);
    expect(m).toMatchObject({ done: true, streak: MASTERY_STREAK, bestStreak: 3, attempts: 6 });
    m = applyPractice(m, false);
    expect(m).toMatchObject({ done: true, streak: 0, bestStreak: 3, attempts: 7 });
  });
});

describe('step 4: timed check', () => {
  it.each(lenses)('%s times up to 5 problems, each from a different card', (lens) => {
    const lesson = findLesson(pass, lens)!;
    const problems = lessonProblems(pass, lesson);
    const set = timedSet(problems, lesson, seeded(11));
    const anchors = problems.filter((p) => !/-v\d+$/.test(p.card.id)).length;
    expect(set).toHaveLength(Math.min(5, anchors));
    const parents = set.map((p) => p.card.id.replace(/-v\d+$/, ''));
    expect(new Set(parents).size).toBe(set.length);
  });

  it('sums the run and compares it with the previous one', () => {
    const run = summarizeTimed(
      [
        { cardId: 'a', text: '', ms: 12_000, clean: true, trapSec: 180 },
        { cardId: 'b', text: '', ms: 8_400, clean: false, trapSec: 90 },
      ],
      1,
    );
    expect(run).toEqual({ at: 1, totalMs: 20_400, clean: 1, n: 2 });
    expect(fasterBy(run, undefined)).toBeNull();
    expect(fasterBy(run, { at: 0, totalMs: 30_400, clean: 2, n: 2 })).toBe(10);
    expect(fasterBy(run, { at: 0, totalMs: 15_400, clean: 2, n: 2 })).toBe(-5);
    expect(trapMinutes(180)).toBe(3);
    expect(trapMinutes(20)).toBe(1);
    expect(trapMinutes(null)).toBeNull();
  });
});
