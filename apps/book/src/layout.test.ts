import { describe, expect, it } from 'vitest';
import { bookTime, colophonDate, paragraphs, sentences } from './copy';
import type { LensCard } from '@lens/scenes';
import { withoutAnswerText } from './figure';
import { NOWRAP_MAX, segments } from './nobreak';
import { bookBundle } from './render';

const nb = (t: string) => segments(t).filter((s) => s.nb).map((s) => s.text);

describe('no line breaks inside math (WO-026 §7 MUST 1)', () => {
  it('keeps coordinates, ratios, lengths and short equations whole', () => {
    expect(nb('点B(1, −3)をとります')).toEqual(['B(1, −3)']);
    expect(nb('辺BC上に点DをBD:DC＝3:4となるようにとり')).toContain('BD:DC＝3:4');
    expect(nb('AB＝6cmの正方形')).toEqual(['AB＝6cm']);
    expect(nb('(x + 2)(y + 3)を展開')).toEqual(['(x + 2)(y + 3)']);
    expect(nb('直線 y = x + 1 で囲まれた')).toEqual(['y = x + 1']);
    expect(nb('差は 8−(−4) = 12 です')).toEqual(['8−(−4) = 12']);
  });

  it('breaks a long run only before a top-level + or −, never beside 「=」 or inside brackets', () => {
    const run = '(2a + 1)x + (a − 3)y − 3a − 5 = 0';
    expect(run.length).toBeGreaterThan(NOWRAP_MAX);
    expect(nb(`直線 ${run} が`)).toEqual(['(2a + 1)x ', '+ (a − 3)y ', '− 3a ', '− 5 = 0']);
  });

  it('never starts a line with ² or a lone か。', () => {
    expect(nb('面積は何cm²ですか。')).toEqual(['cm²', 'すか。']);
    expect(nb('辺の長さの²')).toEqual(['の²']);
  });

  it('keeps the text unchanged', () => {
    for (const t of ['放物線 y = x² + (−2a − 2)x − 6a − 1 は、定数 a の値にかかわらず定点を通ります。', 'A(−2, 3)、B(6, 5)があります。何cmですか。']) {
      expect(segments(t).map((s) => s.text).join('')).toBe(t);
    }
  });
});

describe('はじめに (WO-026 §7 MUST 2)', () => {
  it('splits paragraphs only at line breaks, never at spaces', () => {
    expect(paragraphs('一文目です。 二文目、y = x + 1 です。\n三文目です。')).toEqual(['一文目です。二文目、y = x + 1 です。', '三文目です。']);
  });

  it('the back-cover excerpt ends at a sentence end', () => {
    expect(sentences('一文目です。 二文目です。 三文目です。', 2)).toBe('一文目です。二文目です。');
    for (const p of bookBundle().passes ?? []) {
      const ex = p.book ? sentences(p.book.front_matter.hajimeni_ja, 2) : '';
      if (p.book) expect(ex.endsWith('。'), p.id).toBe(true);
    }
  });
});

describe('time strip and colophon (WO-026 §7 SHOULD 7, 8)', () => {
  it('prints 約4分, seconds only when non-zero, 60 s and more in 分', () => {
    expect(bookTime(240, 'estimate')).toBe('約4分');
    expect(bookTime(45, 'estimate')).toBe('約45秒');
    expect(bookTime(90, 'estimate')).toBe('約1分30秒');
    expect(bookTime(60, 'tester_median')).toBe('1分');
  });

  it('dates the colophon in Japanese', () => {
    expect(colophonDate('2026-10-16')).toBe('2026年10月16日 初版発行');
    expect(colophonDate('2027-01-05')).toBe('2027年1月5日 初版発行');
  });
});

describe('example answer line (WO-026 §7 SHOULD 9)', () => {
  it('drops only the scene’s big answer caption, never a label of the drawing', () => {
    const card = { answer: { value: '95', display_ja: '95g' }, problem: { unit: 'g' } } as unknown as LensCard;
    const svg = '<svg><text font-size="24">95g</text><text font-size="42">95g</text><text font-size="42">380g</text></svg>';
    expect(withoutAnswerText(svg, card)).toBe('<svg><text font-size="24">95g</text><text font-size="42">380g</text></svg>');
  });
});
