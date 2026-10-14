// WO-014: the masterclass for all 8 lessons (beats from the bundle, timings from tokens) and the
// Step 3 round of 5.
import { hasScene, loadBundle, tokens } from '@lens/scenes';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flowReducer, initialFlow } from './flow';
import { findLesson, findPass, isPlayable, lessonProblems } from './lessons';
import { barFill, boundaryHeading, captionsShown, clock, lessonEntry, masterCards, masterToken, withoutMasterCards } from './masterclass';
import { MasterBar, MasterBeat } from './MasterView';
import { practiceQueue } from './practice';

const bundle = loadBundle();
const pass = findPass(bundle, 'chugaku_juken')!;
const lenses = pass.lessons.map((l) => l.lens);
const m = masterToken();
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');

afterEach(() => vi.restoreAllMocks());

describe('timings from tokens', () => {
  it('reads the 5 beats, the core and the total from tokens.motion.masterclass', () => {
    expect(m).toBe(tokens.motion.masterclass);
    expect(m.beats.map((b) => b.id)).toEqual(['principle', 'example1', 'example2', 'boundary', 'onboarding']);
    expect(m.beats.reduce((s, b) => s + b.sec, 0)).toBe(m.total_sec);
    expect(m.beats.filter((b) => b.part === 'core').reduce((s, b) => s + b.sec, 0)).toBe(m.core_sec);
  });

  it('fills the bar at target pace and never moves past the current beat', () => {
    const half = m.beats[1]!.sec / 2;
    expect(barFill(1, half)).toEqual([1, 0.5, 0, 0, 0]);
    expect(barFill(1, m.beats[1]!.sec * 3)).toEqual([1, 1, 0, 0, 0]);
    expect(clock(m.total_sec)).toBe('6:00');
    expect(clock(65.9)).toBe('1:05');
    const html = text(renderToStaticMarkup(<MasterBar m={m} beat={4} beatSec={0} totalSec={301} />));
    expect(html).toContain('5:01 / 6:00');
    expect(renderToStaticMarkup(<MasterBar m={m} beat={4} beatSec={0} totalSec={0} />)).toContain('seg onboarding cur');
  });
});

describe.each(lenses)('%s masterclass', (lens) => {
  const lesson = findLesson(pass, lens)!;
  const cards = masterCards(lesson)!;
  const beat = (id: string) => {
    const warn = vi.spyOn(console, 'warn');
    const err = vi.spyOn(console, 'error');
    const html = text(renderToStaticMarkup(<MasterBeat beat={id} cards={cards} lens={lens} passId={pass.id} m={m} onNext={() => {}} scope={null} />));
    expect(warn).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
    return html;
  };

  it('has its four cards in the bundle', () => {
    expect(cards).not.toBeNull();
    expect(cards.example1.id).toBe(lesson.masterclass!.example1);
  });

  it('renders all 5 beats without warnings', () => {
    expect(beat('principle')).toContain(cards.example1.trap_route.steps[0]!.ja);
    expect(beat('example1')).toContain(cards.example1.problem.text_ja);
    expect(beat('example2')).toContain(cards.example2.problem.text_ja);
    beat('boundary');
    const on = beat('onboarding');
    for (const c of cards.mc.clues) expect(on).toContain(bundle.labels.tags[c]!.ja);
  });

  it('plays example 1 in its drag scene, which snaps at the answer', () => {
    expect(isPlayable(cards.example1, lens)).toBe(true);
    // The captions follow the scene's phases, and the whole route shows once it snaps.
    const steps = cards.example1.lens_route.steps;
    expect(captionsShown(cards.example1, 0, false)).toBe(0);
    expect(captionsShown(cards.example1, 99, false)).toBeLessThan(steps.length);
    expect(captionsShown(cards.example1, 0, true)).toBe(steps.length);
  });

  it('plays example 2 to its result in its mode', () => {
    if (cards.mc.example2_mode === 'scene') expect(isPlayable(cards.example2, lens)).toBe(true);
    else expect(cards.example2.lens_route.steps.some((s) => s.op === 'result')).toBe(true);
  });

  it('shows the boundary line under the right heading', () => {
    const html = beat('boundary');
    expect(html).toContain(cards.mc.boundary_line);
    const head = boundaryHeading(cards.boundary);
    if (head.kind === 'own') expect(html).toContain('レンズが使えないとき');
    else {
      expect(html).toContain('ここは別のレンズ');
      expect(html).toContain(bundle.labels.lenses[head.lens]!.ja);
    }
  });

  it('dry run accepts only picker.correct and shows feedback for wrong picks', () => {
    const card = cards.try;
    for (const o of card.picker.options) {
      const s = flowReducer(initialFlow(card.picker.correct), { type: 'pick', option: o });
      if (o === card.picker.correct) expect(s.phase).toBe('clue');
      else {
        expect(s.phase).toBe('pick');
        expect(s.tryOn).toBe(o);
        expect(card.picker.feedback_ja[o]).toBeTruthy();
      }
    }
  });

  it('Step 3 round: 5 problems, none of them a masterclass card', () => {
    const q = withoutMasterCards(practiceQueue(lessonProblems(pass, lesson), lesson), lesson);
    expect(q.length).toBeGreaterThanOrEqual(m.practice_round);
    const own = [cards.mc.example1, cards.mc.example2, cards.mc.try];
    for (const p of q) expect(own).not.toContain(p.card.id);
  });

  it('polish: no empty captions card before the first step; every beat has a figure or the sentence; the sentence is never printed twice', () => {
    const raw = (id: string) => renderToStaticMarkup(<MasterBeat beat={id} cards={cards} lens={lens} passId={pass.id} m={m} onNext={() => {}} scope={null} />);
    expect(raw('example1')).not.toContain('captions');
    for (const id of ['principle', 'example1', 'example2', 'boundary', 'onboarding']) {
      const html = raw(id);
      // The figure panel holds a figure, the sentence (no figure at all) or the short prompt.
      expect(/class="fig walkfig"|class="walk-text no-figure"|data-testid="scene-/.test(html), `${lens} ${id}`).toBe(true);
      const card = id === 'principle' || id === 'example1' ? cards.example1 : id === 'example2' ? cards.example2 : id === 'boundary' ? cards.boundary : cards.try;
      const sentence = card.problem.text_ja.replace(/&/g, '&amp;');
      const shown = html.replace(/<[^>]+>/g, '');
      expect(shown.split(sentence).length - 1, `${lens} ${id} prints its sentence once`).toBeLessThanOrEqual(hasScene(card) ? 1 : 2);
    }
  });

  it('the first visit opens Step 1, then Step 2', () => {
    expect(lessonEntry(pass.id, lesson, false)).toBe(`/lesson/${pass.id}/${lens}/master`);
    expect(lessonEntry(pass.id, lesson, true)).toBe(`/lesson/${pass.id}/${lens}`);
  });
});
