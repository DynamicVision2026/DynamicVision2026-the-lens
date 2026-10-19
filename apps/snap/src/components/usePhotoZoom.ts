import { useRef } from "react";

const MAX_K = 5;
const TAP_MS = 300;

interface Zoom {
  k: number;
  x: number;
  y: number;
}

/**
 * Pinch / double-tap / wheel zoom and one-finger pan for a photo on a stage (the page viewer, the confirm
 * screen's photo column on tablets). Spread `stageProps` on the stage, put the photo in `body`; the
 * 「元の大きさ」 button (`reset`) is shown only while zoomed. The photo stays over the stage.
 */
export function usePhotoZoom() {
  const stage = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const reset = useRef<HTMLButtonElement>(null);
  const zoom = useRef<Zoom>({ k: 1, x: 0, y: 0 });
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  const lastTap = useRef(0);

  const apply = (z: Zoom) => {
    const el = stage.current;
    const b = body.current;
    if (!el || !b) return;
    const k = Math.min(MAX_K, Math.max(1, z.k));
    // keep the photo over the stage: at most (k − 1) / 2 of the stage beyond each edge
    const mx = ((k - 1) * el.clientWidth) / 2;
    const my = ((k - 1) * el.clientHeight) / 2;
    zoom.current = { k, x: Math.max(-mx, Math.min(mx, z.x)), y: Math.max(-my, Math.min(my, z.y)) };
    b.style.transform = `translate(${zoom.current.x}px, ${zoom.current.y}px) scale(${k})`;
    el.dataset.zoomed = k > 1.01 ? "1" : "0";
    if (reset.current) reset.current.hidden = k <= 1.01;
  };
  /** Zoom by f around a point given relative to the stage centre. */
  const zoomAt = (f: number, px: number, py: number) => {
    const z = zoom.current;
    const k = Math.min(MAX_K, Math.max(1, z.k * f));
    const r = k / z.k;
    apply({ k, x: px - (px - z.x) * r, y: py - (py - z.y) * r });
  };
  const local = (e: { clientX: number; clientY: number }) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    ptrs.current.set(e.pointerId, local(e));
    stage.current?.setPointerCapture?.(e.pointerId);
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = ptrs.current.get(e.pointerId);
    if (!prev) return;
    const cur = local(e);
    ptrs.current.set(e.pointerId, cur);
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current > 0) zoomAt(d / pinch.current, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch.current = d;
    } else if (zoom.current.k > 1) {
      const z = zoom.current;
      apply({ ...z, x: z.x + cur.x - prev.x, y: z.y + cur.y - prev.y });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = 0;
  };
  const onClick = (e: React.MouseEvent) => {
    const now = performance.now();
    if (now - lastTap.current < TAP_MS) {
      lastTap.current = 0;
      const p = local(e);
      if (zoom.current.k > 1.01) apply({ k: 1, x: 0, y: 0 });
      else zoomAt(2.5, p.x, p.y);
    } else lastTap.current = now;
  };
  const onWheel = (e: React.WheelEvent) => {
    const p = local(e);
    zoomAt(Math.exp(-e.deltaY * 0.002), p.x, p.y);
  };

  return {
    stage,
    body,
    reset,
    resetZoom: () => apply({ k: 1, x: 0, y: 0 }),
    stageProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClick, onWheel },
  };
}
