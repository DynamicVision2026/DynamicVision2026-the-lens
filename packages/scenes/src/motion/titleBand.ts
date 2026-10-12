// Long text in the Short's title band (the hook question, the answer-beat trigger): anchored at the
// top of the band and growing downward. The size steps down from type_px.step_title until the text
// fits in MAX_LINES and ends above the figure region, to a floor of MIN_PX; past that it keeps the
// floor and adds lines.
import { wrapText } from '../text';
import type { ShortLayout } from '../types';

/** Floor from the Architect's title-band spec (#26 visual check). Not yet a token. */
export const TITLE_BAND_MIN_PX = 40;
const MAX_LINES = 3;
const LINE_HEIGHT = 1.35;
const SIZE_STEP = 2;

export interface TitleBandText {
  lines: string[];
  size: number;
  lineHeight: number;
  /** Centre y of each line, in frame px. */
  ys: number[];
  /** Top and bottom of the block, in frame px. */
  top: number;
  bottom: number;
}

export function titleBandText(text: string, width: number, layout: ShortLayout): TitleBandText {
  const band = layout.regions.title_band;
  const room = layout.regions.figure.y - band.y;
  const fits = (lines: string[], size: number) => lines.length <= MAX_LINES && lines.length * size * LINE_HEIGHT <= room;
  let size = Math.max(layout.type_px.step_title, TITLE_BAND_MIN_PX);
  let lines = wrapText(text, width, size);
  while (!fits(lines, size) && size - SIZE_STEP >= TITLE_BAND_MIN_PX) {
    size -= SIZE_STEP;
    lines = wrapText(text, width, size);
  }
  const lineHeight = size * LINE_HEIGHT;
  const top = band.y;
  const ys = lines.map((_, i) => top + (i + 0.5) * lineHeight);
  return { lines, size, lineHeight, ys, top, bottom: top + lines.length * lineHeight };
}
