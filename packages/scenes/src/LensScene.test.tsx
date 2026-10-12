import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCard, loadBundle } from './bundle';
import { enclosureGaps, notchPieces } from './geometry';
import { formatExact, timeLabel } from './format';
import { LensScene } from './LensScene';
import { tokens } from './tokens';
import type { Tokens } from './types';
import { allSceneCards } from './variant';

const bundle = loadBundle();
/** Cards whose figure type has a scene (a drafts bundle also carries later lenses' figures). */
const SCENE_FIGURES = ['grid_polygon', 'parallel_band'];
const cards = allSceneCards(bundle).filter((c) => SCENE_FIGURES.includes(c.problem.figure.type));
const gridPoints = (c: (typeof cards)[number]) => (c.problem.figure.type === 'grid_polygon' ? c.problem.figure.points : []);

afterEach(() => vi.restoreAllMocks());

describe('LensScene', () => {
  it('is pure: the same props give identical SVG markup', () => {
    const card = getCard('enclose-001')!;
    const props = { card, keyframe: 2, t: 0.37 };
    const a = renderToStaticMarkup(<LensScene {...props} />);
    const b = renderToStaticMarkup(<LensScene {...props} />);
    expect(a).toBe(b);
    expect(a).toContain('<svg');
  });

  it('covers the 5 Enclose cards and their 15 variants', () => {
    expect(cards.filter((c) => c.lens === 'enclose')).toHaveLength(20);
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
    const base = getCard('enclose-001')!;
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
    const card = getCard('enclose-001')!;
    expect(renderToStaticMarkup(<LensScene card={card} keyframe={1} t={0.2} reducedMotion />)).toBe(
      renderToStaticMarkup(<LensScene card={card} keyframe={1} t={1} />),
    );
  });
});

describe('geometry matches the bundle steps', () => {
  it.each(cards.filter((c) => c.kind === 'standard' && c.problem.figure.type === 'grid_polygon').map((c) => [c.id, c] as const))(
    '%s has one corner gap per sub step',
    (_id, card) => {
      const subs = card.lens_route.steps.filter((s) => s.op === 'sub');
      expect(enclosureGaps(gridPoints(card))).toHaveLength(subs.length);
    },
  );

  it.each(cards.filter((c) => c.kind === 'failure').map((c) => [c.id, c] as const))(
    '%s has one piece per start/add step and one irregular gap',
    (_id, card) => {
      const steps = card.lens_route.steps.filter((s) => s.op === 'start' || s.op === 'add');
      expect(notchPieces(gridPoints(card))).toHaveLength(steps.length);
      expect(enclosureGaps(gridPoints(card)).filter((g) => g.length > 3)).toHaveLength(1);
    },
  );
});

describe('No-lens ghost box', () => {
  const inside = (p: [number, number], poly: [number, number][]) => {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i]!;
      const [xj, yj] = poly[j]!;
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };

  it.each(cards.filter((c) => c.kind === 'no_lens').map((c) => [c.id, c] as const))('%s: the strike never crosses the triangle', (_id, card) => {
    const pts = gridPoints(card);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const [x1, y1] = [Math.max(...xs), Math.max(...ys)];
    const len = Math.min(x1 - Math.min(...xs), y1 - Math.min(...ys)) * 0.25;
    for (let k = 0; k <= 10; k++) {
      const p: [number, number] = [x1 - len + (len * k) / 10, y1 - (len * k) / 10];
      expect(inside(p, pts)).toBe(false);
    }
  });
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
