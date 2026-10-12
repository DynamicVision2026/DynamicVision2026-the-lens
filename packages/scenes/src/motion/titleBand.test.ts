import { describe, expect, it } from 'vitest';
import { loadBundle } from '../bundle';
import { tokens } from '../tokens';
import { allSceneCards } from '../variant';
import { TITLE_BAND_MIN_PX, titleBandText } from './titleBand';

const L = tokens.layout.short;
const width = L.size_px[0] - 2 * L.regions.figure.min_margin_px;
const safeTop = L.safe_top_px;
const safeBottom = L.size_px[1] - L.safe_bottom_px;

describe('title band text (hook question, answer trigger)', () => {
  const texts = allSceneCards(loadBundle()).flatMap((c) => [
    [`${c.id} text_ja`, c.problem.text_ja],
    [`${c.id} trigger`, c.trigger.ja],
  ]);

  it.each(texts)('%s fits inside the safe area, anchored at the top of the band', (_name, text) => {
    const block = titleBandText(text, width, L);
    expect(block.top).toBe(L.regions.title_band.y);
    expect(block.top).toBeGreaterThanOrEqual(safeTop);
    expect(block.bottom).toBeLessThanOrEqual(safeBottom);
    expect(block.size).toBeGreaterThanOrEqual(TITLE_BAND_MIN_PX);
    expect(block.size).toBeLessThanOrEqual(L.type_px.step_title);
    // Steps down only as far as it needs: past 3 lines or into the figure region only at the floor.
    if (block.lines.length > 3 || block.bottom > L.regions.figure.y) expect(block.size).toBe(TITLE_BAND_MIN_PX);
    // No line starts with closing punctuation.
    for (const line of block.lines.slice(1)) expect(line).not.toMatch(/^[、。）」]/);
  });

  it('keeps a short line at step_title size', () => {
    expect(titleBandText('どのレンズ？', width, L).size).toBe(L.type_px.step_title);
  });
});
