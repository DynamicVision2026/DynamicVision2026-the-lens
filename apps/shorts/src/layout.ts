// WO-028 LensShort layout on the 1080×1920 frame. Every text box sits inside the platform safe zone:
// below safe_top_px, above the bottom safe_bottom_px (YouTube's title, channel and comment UI) and
// left of the right-hand button column. layout.test.ts checks every box against these limits.
import { tokens } from '@lens/scenes';

const S = tokens.layout.short;
const [W, H] = S.size_px;

/** YouTube's like / comment / share column on the right edge: no text there. */
export const RIGHT_CLEAR_PX = 150;
const LEFT = 60;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The area text may use. */
export const SAFE: Box = { x: LEFT, y: S.safe_top_px, width: W - LEFT - RIGHT_CLEAR_PX, height: H - S.safe_top_px - S.safe_bottom_px };
const BOTTOM = SAFE.y + SAFE.height;

/** Text sizes (px on the 1080-wide frame; a 390 px phone shows about 36%). */
export const TYPE = {
  stage: 36,
  headline: 64,
  problem: 46,
  chip: 46,
  countdown: 150,
  trap: 46,
  caption: 50,
  lensName: 120,
  answer: 96,
  cta: 52,
  trigger: 44,
  url: 60,
} as const;

/** Text boxes, per beat. The figure is drawn behind them in FIGURE (not text, so it may use the full width). */
export const BOXES = {
  stage: { x: LEFT, y: SAFE.y + 10, width: SAFE.width, height: 56 },
  headline: { x: LEFT, y: SAFE.y + 84, width: SAFE.width, height: 96 },
  problem: { x: LEFT, y: SAFE.y + 196, width: SAFE.width, height: 470 },
  chips: { x: LEFT, y: BOTTOM - 300, width: SAFE.width, height: 300 },
  countdown: { x: LEFT, y: SAFE.y + 690, width: SAFE.width, height: 200 },
  trap: { x: LEFT, y: SAFE.y + 196, width: SAFE.width, height: 640 },
  caption: { x: LEFT, y: BOTTOM - 250, width: SAFE.width, height: 250 },
  ctaLens: { x: LEFT, y: SAFE.y + 230, width: SAFE.width, height: 160 },
  ctaAnswer: { x: LEFT, y: SAFE.y + 400, width: SAFE.width, height: 240 },
  ctaTrigger: { x: LEFT, y: SAFE.y + 660, width: SAFE.width, height: 310 },
  ctaUrl: { x: LEFT, y: BOTTOM - 320, width: SAFE.width, height: 320 },
} satisfies Record<string, Box>;

/** Side room for the figure (labels sit at its edges). */
const FIG_SIDE = 40;

/** Figure areas (the scene's 480×600 viewBox scaled to fit, centred on the frame). */
export const FIGURE = {
  hook: { x: FIG_SIDE, y: SAFE.y + 680, width: W - 2 * FIG_SIDE, height: BOTTOM - (SAFE.y + 680) - 20 },
  trap: { x: FIG_SIDE, y: SAFE.y + 196, width: W - 2 * FIG_SIDE, height: BOTTOM - (SAFE.y + 196) - 270 },
  lens: { x: FIG_SIDE, y: SAFE.y + 196, width: W - 2 * FIG_SIDE, height: BOTTOM - (SAFE.y + 196) - 270 },
} satisfies Record<string, Box>;

export const FRAME = { width: W, height: H };

export function inside(b: Box, area: Box = SAFE): boolean {
  return b.x >= area.x && b.y >= area.y && b.x + b.width <= area.x + area.width && b.y + b.height <= area.y + area.height;
}
