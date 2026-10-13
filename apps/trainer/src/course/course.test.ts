import { loadBundle } from '@lens/scenes';
import { describe, expect, it } from 'vitest';
import { t } from '../i18n/ja';
import { flowReducer, initialFlow } from './flow';
import { findLesson, findPass, hasInteraction, isPlayable, lessonProblems } from './lessons';

const bundle = loadBundle();
const pass = findPass(bundle, 'chugaku_juken')!;

describe('lesson problems (from bundle.passes)', () => {
  it('has the Stage 1 pass with its lessons', () => {
    expect(pass).toBeDefined();
    expect(pass.lessons.length).toBeGreaterThan(0);
    expect(findPass(bundle, 'koko_juken')?.lessons).toEqual([]);
  });

  it.each(['enclose', 'slide', 'mirror', 'area', 'constant', 'balance', 'freeze'])('%s plays lesson_target problems, cards in catalog order then variants', (lens) => {
    const lesson = findLesson(pass, lens)!;
    const problems = lessonProblems(pass, lesson);
    expect(problems).toHaveLength(pass.lesson_target!);
    const cardIds = lesson.cards.filter((id) => problems.some((p) => p.id === id));
    expect(problems.slice(0, cardIds.length).map((p) => p.id)).toEqual(cardIds);
    for (const p of problems) expect(isPlayable(p, lens)).toBe(true);
    // Variants keep their own sentence.
    for (const v of problems.filter((p) => /-v\d+$/.test(p.id))) expect(v.problem.text_ja).toBeTruthy();
  });

  it('skips cards whose best move is not the lens (no-lens, failure)', () => {
    const problems = lessonProblems(pass, findLesson(pass, 'enclose')!).map((p) => p.id);
    expect(problems).not.toContain('enclose-no-lens');
    expect(problems).not.toContain('enclose-f01');
  });

  it('only lenses with an interaction are playable so far', () => {
    expect(hasInteraction('enclose')).toBe(true);
    expect(hasInteraction('area')).toBe(true);
    expect(hasInteraction('unfold')).toBe(false);
  });
});

describe('guided flow: pick → clue → play → aha', () => {
  it('a wrong pick shows its try-on and stays on pick', () => {
    let s = initialFlow('enclose');
    s = flowReducer(s, { type: 'pick', option: 'mirror' });
    expect(s).toMatchObject({ phase: 'pick', tryOn: 'mirror', tried: ['mirror'], misses: 1 });
    // The same wrong option again does nothing.
    expect(flowReducer(s, { type: 'pick', option: 'mirror' })).toBe(s);
  });

  it('the right pick moves to the clue; a wrong chip dims, the real one unlocks play', () => {
    let s = flowReducer(initialFlow('slide'), { type: 'pick', option: 'slide' });
    expect(s.phase).toBe('clue');
    s = flowReducer(s, { type: 'chip', tag: 'solid_3d', real: false });
    expect(s.wrongChips).toEqual(['solid_3d']);
    expect(flowReducer(s, { type: 'play' }).phase).toBe('clue');
    s = flowReducer(s, { type: 'chip', tag: 'parallel_lines', real: true });
    expect(s.clueChip).toBe('parallel_lines');
    s = flowReducer(s, { type: 'play' });
    expect(s.phase).toBe('play');
    expect(flowReducer(s, { type: 'solved' }).phase).toBe('aha');
  });

  it('solved only counts in play', () => {
    expect(flowReducer(initialFlow('enclose'), { type: 'solved' }).phase).toBe('pick');
  });
});

describe('i18n', () => {
  it('fills placeholders', () => {
    expect(t('lesson.clueTitle', { lens: '囲む' })).toBe('どこを見て、囲むにした？');
    expect(t('guide.pick')).toBe('どの道具で見る？');
  });
});
