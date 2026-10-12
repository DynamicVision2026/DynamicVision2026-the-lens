import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadBundle } from './bundle';
import { enclosureGaps, notchPieces } from './geometry';
import { formatExact, timeLabel } from './format';
import { LensScene } from './LensScene';
import { tokens } from './tokens';
import type { Tokens } from './types';
import { allSceneCards } from './variant';

const bundle = loadBundle();
const cards = allSceneCards(bundle);

afterEach(() => vi.restoreAllMocks());

describe('LensScene', () => {
  it('is pure: the same props give identical SVG markup', () => {
    const card = bundle.cards[0]!;
    const props = { card, keyframe: 2, t: 0.37 };
    const a = renderToStaticMarkup(<LensScene {...props} />);
    const b = renderToStaticMarkup(<LensScene {...props} />);
    expect(a).toBe(b);
    expect(a).toContain('<svg');
  });

  it('covers all 5 cards and 15 variants', () => {
    expect(bundle.cards).toHaveLength(5);
    expect(cards).toHaveLength(20);
  });

  it.each(cards.map((c) => [c.id, c] as const))('%s renders every keyframe at t = 0 and t = 1 without warnings', (_id, card) => {
    const warn = vi.spyOn(console, 'warn');
    const keyframes = card.animation?.keyframes ?? [];
    for (let k = 0; k < keyframes.length; k++) {
      for (const t of [0, 1]) {
        expect(() => renderToStaticMarkup(<LensScene card={card} keyframe={k} t={t} />)).not.toThrow();
      }
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('shows the answer from the bundle at the end', () => {
    const card = bundle.cards.find((c) => c.id === 'enclose-001')!;
    const last = card.animation!.keyframes.indexOf('show_answer');
    const html = renderToStaticMarkup(<LensScene card={card} keyframe={last} t={1} />);
    expect(html).toContain(card.answer.display_ja!);
  });

  it('draws the end state of the previous keyframe for an unknown keyframe, warning once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const base = bundle.cards[0]!;
    const card = { ...base, animation: { keyframes: ['show_shape', 'draw_box', 'no_such_keyframe'] } };
    const unknown = renderToStaticMarkup(<LensScene card={card} keyframe={2} t={0.5} />);
    renderToStaticMarkup(<LensScene card={card} keyframe={2} t={0.5} />);
    const previous = renderToStaticMarkup(<LensScene card={card} keyframe={1} t={1} />);
    expect(unknown).toBe(previous);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('takes every Enclose accent from color.lens.enclose (no code change needed to restyle)', () => {
    const card = bundle.cards.find((c) => c.id === 'enclose-001')!;
    const original = tokens.color.lens.enclose.value;
    const swapped: Tokens = {
      ...tokens,
      color: { ...tokens.color, lens: { ...tokens.color.lens, enclose: { ...tokens.color.lens.enclose, value: 'rgb(1, 2, 3)' } } },
    };
    const k = card.animation!.keyframes.length - 1;
    for (let i = 0; i <= k; i++) {
      const html = renderToStaticMarkup(<LensScene card={card} keyframe={i} t={1} tokens={swapped} />);
      expect(html).not.toContain(original);
    }
    expect(renderToStaticMarkup(<LensScene card={card} keyframe={k} t={1} tokens={swapped} />)).toContain('rgb(1, 2, 3)');
  });

  it('snaps t to 1 with reducedMotion', () => {
    const card = bundle.cards[0]!;
    expect(renderToStaticMarkup(<LensScene card={card} keyframe={1} t={0.2} reducedMotion />)).toBe(
      renderToStaticMarkup(<LensScene card={card} keyframe={1} t={1} />),
    );
  });
});

describe('geometry matches the bundle steps', () => {
  it.each(cards.filter((c) => c.kind === 'standard').map((c) => [c.id, c] as const))(
    '%s has one corner gap per sub step',
    (_id, card) => {
      const subs = card.lens_route.steps.filter((s) => s.op === 'sub');
      expect(enclosureGaps(card.problem.figure.points)).toHaveLength(subs.length);
    },
  );

  it.each(cards.filter((c) => c.kind === 'failure').map((c) => [c.id, c] as const))(
    '%s has one piece per start/add step and one irregular gap',
    (_id, card) => {
      const steps = card.lens_route.steps.filter((s) => s.op === 'start' || s.op === 'add');
      expect(notchPieces(card.problem.figure.points)).toHaveLength(steps.length);
      expect(enclosureGaps(card.problem.figure.points).filter((g) => g.length > 3)).toHaveLength(1);
    },
  );
});

describe('format', () => {
  it('formats exact values without changing them', () => {
    expect(formatExact('39/2')).toBe('19.5');
    expect(formatExact('29')).toBe('29');
    expect(formatExact('1/4')).toBe('0.25');
    expect(formatExact('1/3')).toBe('1/3');
  });

  it('fills time templates', () => {
    expect(timeLabel('+{min}分{sec}秒', 240)).toBe('+4分0秒');
    expect(timeLabel('{sec}秒', 30)).toBe('30秒');
  });
});
