import { describe, expect, it } from 'vitest';
import { BOXES, FIGURE, FRAME, inside, RIGHT_CLEAR_PX, SAFE } from './layout';
import { tokens } from '@lens/scenes';

describe('LensShort layout (WO-028 safe zones)', () => {
  const s = tokens.layout.short;
  it('keeps every text box inside the safe area', () => {
    for (const [name, box] of Object.entries(BOXES)) expect(inside(box), name).toBe(true);
  });
  it('the safe area clears the top, the bottom UI band and the right-hand buttons', () => {
    expect(SAFE.y).toBeGreaterThanOrEqual(s.safe_top_px);
    expect(SAFE.y + SAFE.height).toBeLessThanOrEqual(FRAME.height - s.safe_bottom_px);
    // The bottom ~20% of the frame stays free of text (YouTube title, channel, comments).
    expect(FRAME.height - (SAFE.y + SAFE.height)).toBeGreaterThanOrEqual(0.19 * FRAME.height);
    expect(SAFE.x + SAFE.width).toBeLessThanOrEqual(FRAME.width - RIGHT_CLEAR_PX);
  });
  it('keeps the figures inside the frame and above the bottom band', () => {
    for (const [name, box] of Object.entries(FIGURE)) {
      expect(inside(box, { x: 0, y: s.safe_top_px, width: FRAME.width, height: FRAME.height - s.safe_top_px - s.safe_bottom_px }), name).toBe(true);
    }
  });
  it('captions sit below the lens figure, never on it', () => {
    expect(BOXES.caption.y).toBeGreaterThanOrEqual(FIGURE.lens.y + FIGURE.lens.height);
  });
});
