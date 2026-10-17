// The masterclass scene draws its figure in a 480×600 viewBox with room for its own caption underneath.
// On a phone-sized Short that leaves the figure small, so the Short zooms onto the figure itself: it
// measures the card's last keyframe once (everything except the scene's step captions and answer
// line, which the Short shows in its own caption box) and fits that box into the figure area. The
// box is the same for every keyframe of a card, so the framing never jumps between beats.
import { answerText, LensScene, SCENE_HEIGHT, SCENE_WIDTH, type LensCard } from '@lens/scenes';
import { useLayoutEffect, useRef, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import type { Box } from './layout';

const THEME = 'short_dark';
const MARGIN = 0.06;
const MAX_ZOOM = 4;
const cache = new Map<string, Box>();

/** Text the scene prints under the figure: lens and trap step captions, the answer line. */
function isSceneCaption(text: string, card: LensCard): boolean {
  const t = text.replace(/\s+/g, '');
  if (t.length === 0) return false;
  if (t === answerText(card).replace(/\s+/g, '')) return true;
  if (t.length < 4) return false;
  return [...card.lens_route.steps, ...card.trap_route.steps].some((s) => s.ja.replace(/\s+/g, '').includes(t));
}

/** The on-screen rectangle of the clip path an element is drawn under (graphs clip long lines to the plot). */
function clipRect(el: Element, svg: SVGSVGElement): { left: number; top: number; right: number; bottom: number } | null {
  const g = el.closest('[clip-path]') as SVGGraphicsElement | null;
  const id = g?.getAttribute('clip-path')?.match(/#([^)]+)/)?.[1];
  const shape = id ? (svg.querySelector(`[id="${id}"] > *`) as SVGGraphicsElement | null) : null;
  const m = g?.getScreenCTM();
  if (!g || !shape || !m) return null;
  const b = shape.getBBox();
  const pts = [
    [b.x, b.y],
    [b.x + b.width, b.y],
    [b.x, b.y + b.height],
    [b.x + b.width, b.y + b.height],
  ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(m));
  return { left: Math.min(...pts.map((p) => p.x)), top: Math.min(...pts.map((p) => p.y)), right: Math.max(...pts.map((p) => p.x)), bottom: Math.max(...pts.map((p) => p.y)) };
}

function measure(svg: SVGSVGElement, card: LensCard): Box {
  const root = svg.getBoundingClientRect();
  const k = SCENE_WIDTH / root.width;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const el of svg.querySelectorAll('path, line, polyline, polygon, rect, circle, ellipse, text')) {
    if (el.closest('defs, clipPath, mask, pattern, filter')) continue;
    if (el.tagName === 'text' && isSceneCaption(el.textContent ?? '', card)) continue;
    const raw = el.getBoundingClientRect();
    if (raw.width === 0 && raw.height === 0) continue;
    const c = clipRect(el, svg);
    const r = c ? { left: Math.max(raw.left, c.left), top: Math.max(raw.top, c.top), right: Math.min(raw.right, c.right), bottom: Math.min(raw.bottom, c.bottom) } : raw;
    if (r.right <= r.left && r.bottom <= r.top) continue;
    x0 = Math.min(x0, (r.left - root.left) * k);
    y0 = Math.min(y0, (r.top - root.top) * k);
    x1 = Math.max(x1, (r.right - root.left) * k);
    y1 = Math.max(y1, (r.bottom - root.top) * k);
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, width: SCENE_WIDTH, height: SCENE_HEIGHT };
  const m = MARGIN * Math.max(x1 - x0, y1 - y0);
  return { x: x0 - m, y: y0 - m, width: x1 - x0 + 2 * m, height: y1 - y0 + 2 * m };
}

/** The card's figure box in scene units (measured once per card and tab). */
function useFigureBox(card: LensCard): { box: Box | null; probe: React.ReactNode } {
  const [box, setBox] = useState<Box | null>(() => cache.get(card.id) ?? null);
  const ref = useRef<HTMLDivElement>(null);
  const [handle] = useState(() => (cache.has(card.id) ? null : delayRender(`Measuring the figure of ${card.id}`)));
  useLayoutEffect(() => {
    if (box) return;
    const svg = ref.current?.querySelector('svg');
    const b = svg ? measure(svg, card) : { x: 0, y: 0, width: SCENE_WIDTH, height: SCENE_HEIGHT };
    cache.set(card.id, b);
    setBox(b);
    if (handle !== null) continueRender(handle);
  }, [box, card, handle]);
  const last = Math.max(0, (card.animation?.keyframes.length ?? 1) - 1);
  const probe = box ? null : (
    <div ref={ref} style={{ position: 'absolute', left: 0, top: 0, width: SCENE_WIDTH, height: SCENE_HEIGHT, visibility: 'hidden' }}>
      <LensScene card={card} keyframe={last} t={1} theme={THEME} hideStory />
    </div>
  );
  return { box, probe };
}

/** The card's masterclass scene at (keyframe, t), zoomed so its figure fills `area`. */
export function FitFigure({ card, area, keyframe, t, opacity = 1 }: { card: LensCard; area: Box; keyframe: number; t: number; opacity?: number }) {
  const { box, probe } = useFigureBox(card);
  if (!box) return <>{probe}</>;
  const zoom = Math.min(area.width / box.width, area.height / box.height, MAX_ZOOM);
  const w = box.width * zoom;
  const h = box.height * zoom;
  // Clipped to the figure box, so the scene's own captions under the figure stay out of the frame.
  return (
    <div style={{ position: 'absolute', left: area.x + (area.width - w) / 2, top: area.y + (area.height - h) / 2, width: w, height: h, overflow: 'hidden', opacity }}>
      <div style={{ position: 'absolute', left: -box.x * zoom, top: -box.y * zoom, width: SCENE_WIDTH * zoom }}>
        <LensScene card={card} keyframe={keyframe} t={t} theme={THEME} hideStory />
      </div>
    </div>
  );
}
