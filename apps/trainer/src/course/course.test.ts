import { loadBundle } from '@lens/scenes';
import { describe, expect, it } from 'vitest';
import { t } from '../i18n/ja';
import { flowReducer, initialFlow } from './flow';
import { findLesson, findPass, hasInteraction, isPlayable, lessonProblems, problemMode } from './lessons';

const bundle = loadBundle();
const pass = findPass(bundle, 'chugaku_juken')!;

describe('lesson problems (from bundle.passes)', () => {
  it('has the Stage 1 pass with its lessons', () => {
    expect(pass).toBeDefined();
    expect(pass.lessons.length).toBeGreaterThan(0);
    // WO-024: all three Passes are on sale (status live); each opens with its own access link.
    for (const id of ['chugaku_juken', 'koukou_juken', 'daigaku_juken']) expect(findPass(bundle, id)?.status, id).toBe('live');
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

describe('Passes stay closed until unlocked on the device (WO-024)', () => {
  it('opens a Pass without its access link only with ?preview=1', async () => {
    const { passOpen } = await import('./access');
    expect(passOpen('chugaku_juken', '')).toBe(false);
    expect(passOpen('koukou_juken', '')).toBe(false);
    expect(passOpen('daigaku_juken', '')).toBe(false);
    expect(passOpen('koukou_juken', '?preview=1')).toBe(true);
  });
});


describe('WO-018 geometry cards (drafts until the Architect verifies them)', () => {
  const card = (id: string) => loadBundle().cards.find((c) => c.id === id);
  const present = ['slide-004', 'mirror-004', 'unfold-004'].every((id) => card(id));
  it.skipIf(!present)('plays the three L4 cards as drag scenes and walks through the boundary cards', () => {
    for (const id of ['slide-004', 'mirror-004', 'unfold-004']) expect(problemMode(card(id)!, card(id)!.lens)).toBe('scene');
    for (const id of ['slide-no-lens', 'slide-f01', 'mirror-no-lens', 'mirror-f01', 'unfold-no-lens']) expect(problemMode(card(id)!, card(id)!.lens)).toBe('walkthrough');
  });
});

describe('WO-020: Stage 2/3 lessons and the chain runner (ADR-003)', () => {
  const planned = ['koukou_juken', 'daigaku_juken'].map((id) => findPass(bundle, id)).filter((p) => !!p);
  const problems = planned.flatMap((p) => p!.lessons.flatMap((l) => lessonProblems(p!, l).map((x) => ({ ...x, lens: l.lens }))));
  it.skipIf(problems.length === 0)('plays every Stage 2/3 card: chained cards as chains, every other standard card as a scene, boundary cards as walkthroughs', () => {
    for (const { card, mode, lens } of problems) {
      const stepsOnly = card.problem.figure.type === 'word_problem' && card.problem.figure.diagram?.family === 'steps_only';
      if (card.chain?.length) expect(mode, card.id).toBe('chain');
      // WO-023: every figure type has a drag scene now; only a steps-only word problem walks through.
      else if (card.kind === 'standard' && !stepsOnly) expect(mode, card.id).toBe('scene');
      else expect(mode, card.id).toBe('walkthrough');
      expect(problemMode(card, lens)).toBe(mode);
    }
    expect(problems.some((p) => p.mode === 'chain')).toBe(true);
  });

  it.skipIf(problems.length === 0)('a chained card asks only for its first lens: the picker accepts chain[0].lens and nothing else', () => {
    for (const { card } of problems.filter((p) => p.mode === 'chain')) {
      expect(card.picker.correct).toBe(card.chain![0]!.lens);
      for (const o of card.picker.options) {
        const s = flowReducer(initialFlow(card.picker.correct), { type: 'pick', option: o });
        expect(s.phase).toBe(o === card.chain![0]!.lens ? 'clue' : 'pick');
      }
    }
  });

  it('leaves the Stage 1 lessons as they were (no chains, same modes)', () => {
    for (const lesson of pass.lessons) for (const p of lessonProblems(pass, lesson)) expect(p.mode).not.toBe('chain');
  });
});
