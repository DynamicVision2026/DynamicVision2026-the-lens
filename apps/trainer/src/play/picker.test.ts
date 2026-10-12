import { describe, expect, it } from 'vitest';
import { HINT_AFTER_MISSES, initialPickerState, isCleanClue, isCleanSolve, pickerReducer, showsHint, shuffle, type PickerState } from './picker';

const init = () =>
  initialPickerState({ options: ['slide', 'enclose', 'mirror', 'direct'], correct: 'enclose', realTags: ['tilted_polygon', 'vertices_on_box'], chips: ['tilted_polygon', 'parallel_lines', 'vertices_on_box', 'solid_3d'] });
const run = (s: PickerState, ...actions: Parameters<typeof pickerReducer>[1][]) => actions.reduce(pickerReducer, s);

describe('Perspective Picker reducer', () => {
  it('greys a wrong option, shows its feedback, and returns to the problem', () => {
    const s = run(init(), { type: 'pick', option: 'slide', at: 1000, startedAt: 0 });
    expect(s.phase).toBe('feedback');
    expect(s.feedbackFor).toBe('slide');
    expect(s.greyed).toEqual(['slide']);
    const back = pickerReducer(s, { type: 'dismissFeedback' });
    expect(back.phase).toBe('problem');
    // A greyed option can't be picked again.
    expect(pickerReducer(back, { type: 'pick', option: 'slide', at: 2000, startedAt: 0 })).toBe(back);
  });

  it(`shows the trigger hint after ${HINT_AFTER_MISSES} misses`, () => {
    let s = run(init(), { type: 'pick', option: 'slide', at: 1, startedAt: 0 }, { type: 'dismissFeedback' });
    expect(showsHint(s)).toBe(false);
    s = run(s, { type: 'pick', option: 'mirror', at: 2, startedAt: 0 }, { type: 'dismissFeedback' });
    expect(showsHint(s)).toBe(true);
  });

  it('records seconds to the correct pick, then asks for the clue', () => {
    const s = run(init(), { type: 'pick', option: 'enclose', at: 12_500, startedAt: 500 });
    expect(s.phase).toBe('clue');
    expect(s.seconds).toBe(12);
    expect(s.attempts).toBe(1);
  });

  it('a right lens with a wrong clue is not a clean solve', () => {
    const base = run(init(), { type: 'pick', option: 'enclose', at: 1, startedAt: 0 });
    const decoy = run(base, { type: 'toggleChip', tag: 'vertices_on_box' }, { type: 'toggleChip', tag: 'parallel_lines' }, { type: 'confirmClue' });
    expect(decoy.phase).toBe('reveal');
    expect(isCleanSolve(decoy)).toBe(false);
    const clean = run(base, { type: 'toggleChip', tag: 'vertices_on_box' }, { type: 'confirmClue' });
    expect(isCleanSolve(clean)).toBe(true);
  });

  it('needs at least one chip before confirming, and chips toggle', () => {
    const base = run(init(), { type: 'pick', option: 'enclose', at: 1, startedAt: 0 });
    expect(pickerReducer(base, { type: 'confirmClue' })).toBe(base);
    const toggled = run(base, { type: 'toggleChip', tag: 'solid_3d' }, { type: 'toggleChip', tag: 'solid_3d' });
    expect(toggled.selected).toEqual([]);
  });

  it('times the variant from its start and ends on the report, with no hints', () => {
    let s = run(init(), { type: 'pick', option: 'enclose', at: 1, startedAt: 0 }, { type: 'toggleChip', tag: 'tilted_polygon' }, { type: 'confirmClue' });
    s = pickerReducer(s, { type: 'startVariant', at: 10_000, options: ['direct', 'enclose', 'slide', 'mirror'] });
    s = run(s, { type: 'pickVariant', option: 'slide', at: 11_000 }, { type: 'pickVariant', option: 'slide', at: 11_500 });
    expect(s.variantMisses).toBe(1);
    s = pickerReducer(s, { type: 'pickVariant', option: 'enclose', at: 14_000 });
    expect(s.phase).toBe('report');
    expect(s.variantSeconds).toBe(4);
  });

  it('isCleanClue: real only → true; decoy or nothing → false', () => {
    const real = ['a', 'b'];
    expect(isCleanClue(['a'], real)).toBe(true);
    expect(isCleanClue(['a', 'x'], real)).toBe(false);
    expect(isCleanClue([], real)).toBe(false);
  });

  it('shuffle keeps every item', () => {
    let seed = 0.3;
    const random = () => (seed = (seed * 9301 + 0.49297) % 1);
    expect(shuffle([1, 2, 3, 4], random).sort()).toEqual([1, 2, 3, 4]);
  });
});
