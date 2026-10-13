// WO-016: every walkthrough card renders its trap beat and every lens step; the free check never
// serves a boundary card.
import { hasScene, LensScene, loadBundle } from '@lens/scenes';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkProblems } from './check';
import { findPass, lessonProblems } from './lessons';
import { boundaryChip, WalkBoard } from './Walkthrough';

const pass = findPass(loadBundle(), 'chugaku_juken')!;
const walks = pass.lessons.flatMap((l) => lessonProblems(pass, l)).filter((p) => p.mode === 'walkthrough').map((p) => [p.card.id, p.card] as const);
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');

afterEach(() => vi.restoreAllMocks());

describe('walkthrough', () => {
  it('covers the boundary cards of every lesson', () => {
    const ids = walks.map(([id]) => id);
    for (const id of ['enclose-f01', 'enclose-no-lens', 'area-f01', 'area-no-lens', 'constant-f01', 'constant-no-lens', 'constant-005']) expect(ids).toContain(id);
  });

  it.each(walks)('%s renders every step, and its figure when it has one, without warnings', (_id, card) => {
    const warn = vi.spyOn(console, 'warn');
    const err = vi.spyOn(console, 'error');
    const html = text(renderToStaticMarkup(<WalkBoard card={card} shown={card.lens_route.steps.length} next={false} />));
    for (const st of card.lens_route.steps) expect(html).toContain(st.ja);
    if (card.kind === 'failure' || card.kind === 'no_lens') {
      for (const st of card.trap_route.steps) expect(html).toContain(st.ja);
      expect(html).toContain(card.kind === 'failure' ? 'くせでやると…' : 'レンズを使うと遠回り');
      expect(boundaryChip(card)).toBe(card.kind === 'failure' ? 'レンズが使えない問題' : 'レンズを使わない方が速い問題');
    } else expect(boundaryChip(card)).toBeNull();
    if (hasScene(card)) {
      const kfs = card.animation?.keyframes ?? [];
      for (let k = 0; k < kfs.length; k++) renderToStaticMarkup(<LensScene card={card} keyframe={k} t={1} theme="short_dark" />);
    }
    expect(warn).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
  });

  it('the free check never serves a boundary or walkthrough card', () => {
    for (let seed = 1; seed <= 40; seed++) {
      let s = seed;
      const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
      for (const c of checkProblems(pass, rand)) expect(c.kind, c.id).toBe('standard');
    }
  });
});
