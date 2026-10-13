// WO-015: area and constant play by figure.diagram.family; each new drag snaps at the bundle's answer
// and nowhere else, and that is exactly where the shapes match.
import { allSceneCards, getCard, loadBundle, type LensCard, type WordDiagramSpec, type WordProblemFigure } from '@lens/scenes';
import { describe, expect, it } from 'vitest';
import { findLesson, findPass, isPlayable, lessonProblems } from './lessons';
import { averageModel, barsModel, shortfallModel } from './scenes/word';

const bundle = loadBundle();
const pass = findPass(bundle, 'chugaku_juken')!;
const all = allSceneCards(bundle);
const diagram = (c: LensCard) => (c.problem.figure as WordProblemFigure).diagram;
const ofFamily = <F extends WordDiagramSpec['family']>(f: F) =>
  all.filter((c) => c.problem.figure.type === 'word_problem' && diagram(c)?.family === f).map((c) => [c.id, diagram(c) as Extract<WordDiagramSpec, { family: F }>] as const);
const ks = (max: number) => Array.from({ length: Math.ceil(max) + 1 }, (_, i) => i);

describe('area and constant by diagram family', () => {
  it('plays the WO-015 anchors (old and new kinds)', () => {
    for (const id of ['area-001', 'area-002', 'area-003', 'area-004', 'constant-001', 'constant-002', 'constant-003']) {
      const card = getCard(id)!;
      expect(isPlayable(card, card.lens), id).toBe(true);
    }
  });

  it('plays every standard area/constant card that has a drag family', () => {
    for (const card of bundle.cards.filter((c) => (c.lens === 'area' || c.lens === 'constant') && c.kind === 'standard')) {
      expect(isPlayable(card, card.lens), card.id).toBe(diagram(card)?.family !== 'steps_only');
    }
  });

  it.each(['area', 'constant'])('%s lesson plays every scene anchor as a scene', (lens) => {
    const problems = lessonProblems(pass, findLesson(pass, lens)!);
    for (const p of problems.filter((x) => x.card.kind === 'standard' && diagram(x.card)?.family !== 'steps_only')) expect(p.mode, p.card.id).toBe('scene');
  });
});

describe('snaps at the answer and nowhere else', () => {
  it.each(ofFamily('area_average'))('平均 %s: the dent equals the excess only at w2', (_id, d) => {
    const m = averageModel(d);
    expect(m.lineSnaps(d.level)).toBe(true);
    expect(m.lineSnaps(d.h1)).toBe(false);
    for (const k of ks(m.kMax)) expect(m.snaps(k), `k=${k}`).toBe(k * (d.level - d.h2) === d.w1 * (d.h1 - d.level));
    expect(m.drained(m.target)).toBe(1);
    expect(m.kMax).toBeGreaterThan(m.target);
  });

  it.each(ofFamily('area_shortfall'))('過不足 %s: the strip holds the leftover and the missing only at n', (_id, d) => {
    const m = shortfallModel(d);
    expect(m.raiseSnaps(d.b)).toBe(true);
    expect(m.raiseSnaps(d.a)).toBe(false);
    for (const k of ks(m.kMax)) expect(m.snaps(k), `k=${k}`).toBe(m.slots(k) === d.s + d.d);
    expect(m.kMax).toBeGreaterThan(m.target);
  });

  it.each(ofFamily('diff_bars'))('差一定 %s: r smaller bars equal the bigger bar only at the shift', (_id, d) => {
    const m = barsModel(d);
    for (const k of ks(m.kMax)) {
      const { big, small } = m.at(k);
      expect(big - small, 'the difference never changes').toBe(d.big - d.small);
      expect(m.snaps(k), `k=${k}`).toBe(d.r * small === big);
    }
    expect(Number.isInteger(m.target) && m.target > 0 && m.target <= m.kMax).toBe(true);
  });
});
