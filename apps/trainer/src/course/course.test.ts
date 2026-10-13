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
    // Stage 2 has its first lessons (ADR-004) but stays a waitlist: status planned → 準備中 on the public case page.
    expect(findPass(bundle, 'koukou_juken')?.status).toBe('planned');
  });

  it.each(['enclose', 'slide', 'mirror', 'area', 'constant', 'balance', 'freeze', 'unfold'])('%s plays every anchor in catalog order, variants only as a top-up', (lens) => {
    const lesson = findLesson(pass, lens)!;
    const problems = lessonProblems(pass, lesson);
    expect(problems.slice(0, lesson.cards.length).map((p) => p.card.id)).toEqual(lesson.cards);
    expect(problems).toHaveLength(Math.max(lesson.cards.length, pass.lesson_target!));
    for (const p of problems) expect(p.mode).toBe(isPlayable(p.card, lens) ? 'scene' : 'walkthrough');
    // Top-up variants are scene cards with their own sentence.
    for (const v of problems.slice(lesson.cards.length)) {
      expect(v.card.id).toMatch(/-v\d+$/);
      expect(v.mode).toBe('scene');
      expect(v.card.problem.text_ja).toBeTruthy();
    }
  });

  it.each([
    ['area', 10, ['area-no-lens', 'area-f01', 'area-006', 'area-008']],
    ['constant', 10, ['constant-no-lens', 'constant-f01', 'constant-005', 'constant-007', 'constant-008']],
    ['enclose', 10, ['enclose-no-lens', 'enclose-f01']],
  ] as const)('%s: %i anchors; boundary and steps-only cards walk through (WO-016)', (lens, n, walk) => {
    const problems = lessonProblems(pass, findLesson(pass, lens)!);
    expect(problems).toHaveLength(n);
    for (const id of walk) expect(problems.find((p) => p.card.id === id)?.mode, id).toBe('walkthrough');
    for (const p of problems.filter((x) => x.card.kind !== 'standard')) expect(p.mode, p.card.id).toBe('walkthrough');
  });

  it('every Stage 1 lens has an interaction', () => {
    expect(hasInteraction('enclose')).toBe(true);
    expect(hasInteraction('area')).toBe(true);
    expect(hasInteraction('unfold')).toBe(true);
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

describe('planned Passes stay closed without preview (ADR-003 §3, ADR-004)', () => {
  it('opens koukou_juken / daigaku_juken lessons only with ?preview=1', async () => {
    const { passOpen } = await import('./access');
    expect(passOpen('koukou_juken', '')).toBe(false);
    expect(passOpen('daigaku_juken', '')).toBe(false);
    expect(passOpen('koukou_juken', '?preview=1')).toBe(true);
  });
});

