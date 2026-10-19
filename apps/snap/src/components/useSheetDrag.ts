import { useRef, useState } from "react";
import { useLayout } from "../lib/layout";

/** Half height of a map sheet (share of the window) and the drag thresholds. */
export const SHEET_HALF = 0.56;
const DRAG_UP = 40;
const DRAG_DOWN = 60;

/**
 * The map sheets' size behaviour (unit sheet, 今夜の作戦): half height by default; drag the head up
 * (> 40 px) → full height, down (> 60 px) → half from full, close from half; a tap on the handle toggles.
 * The drag lives on the head only, so it never fights the body's scroll. In wide layouts the sheet is a
 * full-height side panel: no drag (✕ / Esc / back close it).
 */
export function useSheetDrag(onClose: () => void) {
  const panel = useLayout().layout === "wide";
  const ref = useRef<HTMLElement>(null);
  const [full, setFull] = useState(false);
  const [dragH, setDragH] = useState<number | null>(null);
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null);

  const maxH = () => {
    const top = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 56;
    return window.innerHeight - Math.max(0, top) - 8;
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest("button:not(.sheet-grab)")) return;
    drag.current = { y: e.clientY, h: ref.current?.getBoundingClientRect().height ?? 0, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dy) < 6) return;
    if (!d.moved) (e.currentTarget as Element).setPointerCapture?.(e.pointerId); // a drag, not a tap on the handle
    d.moved = true;
    setDragH(Math.max(80, Math.min(maxH(), d.h - dy)));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return;
    const dy = e.clientY - d.y;
    const h = d.h - dy;
    setDragH(null);
    if (dy < -DRAG_UP) setFull(true);
    else if (dy > DRAG_DOWN) {
      if (full && h >= window.innerHeight * SHEET_HALF * 0.6) setFull(false);
      else onClose();
    }
  };
  return {
    ref,
    full,
    setFull,
    dragging: !panel && dragH !== null,
    style: !panel && dragH !== null ? { height: `${dragH}px`, maxHeight: `${dragH}px` } : undefined,
    headProps: panel ? {} : { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
