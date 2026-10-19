import { useEffect, useRef } from "react";
import { app } from "../copy";
import type { SavedPage } from "../lib/model";
import { pageView } from "../lib/unitsheet";
import { usePhotoUrl } from "./PhotoThumb";

const MAX_K = 5;
const TAP_MS = 300;

interface Zoom {
  k: number;
  x: number;
  y: number;
}

/**
 * Full-screen page viewer over the map (from a thumbnail or a history row in the unit sheet): the saved
 * downscaled photo with pinch / double-tap / wheel zoom and pan, and the page's problems listed under it
 * with the open unit's problems highlighted. Closing it goes back to the same sheet (history entry).
 */
export function PageViewer({ page, unitId, onClose }: { page: SavedPage; unitId: string | null; onClose: () => void }) {
  const v = pageView(page, unitId);
  const url = usePhotoUrl(page.photo);
  const t = app.map.viewer;
  const s = app.map.sheet;
  const stage = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const reset = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLOListElement>(null);
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

  // the open unit's first problem in view in the list
  useEffect(() => {
    const first = list.current?.querySelector<HTMLElement>(".pv-row.is-unit");
    if (first && list.current) list.current.scrollTop = Math.max(0, first.offsetTop - 8);
  }, [page.id]);

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

  return (
    <div className="pv" role="dialog" aria-modal="true" aria-label={t.label(v.date, v.type)} data-testid="page-viewer" data-page={page.id}>
      <div className="pv-top">
        <div className="pv-title">
          <b>{t.label(v.date, v.type)}</b>
          <span>{t.count(v.rows.length)}</span>
        </div>
        <button ref={reset} type="button" className="pv-reset" hidden onClick={() => apply({ k: 1, x: 0, y: 0 })} data-testid="viewer-reset">
          {t.reset}
        </button>
        <button type="button" className="pv-close" onClick={onClose} aria-label={t.close} autoFocus data-testid="viewer-close">
          ×
        </button>
      </div>
      {url ? (
        <div
          ref={stage}
          className="pv-stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onClick}
          onWheel={onWheel}
          data-zoomed="0"
          data-testid="viewer-stage"
        >
          <div ref={body} className="pv-body">
            <img src={url} alt={t.label(v.date, v.type)} draggable={false} data-testid="viewer-photo" />
          </div>
          <p className="pv-hint" aria-hidden>
            {t.zoomHint}
          </p>
        </div>
      ) : (
        <div className="pv-stage pv-none" data-testid="viewer-nophoto">
          <p>{t.noPhoto}</p>
        </div>
      )}
      <section className="pv-list-wrap" aria-label={t.problems}>
        <h2 className="pv-h">{t.problems}</h2>
        <ol ref={list} className="pv-list" data-testid="viewer-problems">
          {v.rows.map((r) => (
            <li key={r.index} className={`pv-row${r.inUnit ? " is-unit" : ""}`} data-unit-row={r.inUnit ? "1" : "0"}>
              <span className={`pv-mark mk-${r.mark === "✕" ? "x" : r.mark === "○" ? "o" : "none"}`} aria-label={r.mark ?? s.noMark}>
                {r.mark ?? "—"}
              </span>
              <div className="pv-main">
                <div className="pv-meta">
                  <b>{s.problemNo(r.n)}</b>
                  <span className="pv-unit">{r.inUnit && r.topic ? t.thisUnit(r.topic) : r.unitLabel}</span>
                  {r.sourceLabel && <span className="pv-src">{r.sourceLabel}</span>}
                </div>
                <p className="pv-q">{r.q}</p>
                <p className="pv-a">
                  <span>
                    {s.yourAnswer}：<span className="pv-ans">{r.answer || s.blank}</span>
                  </span>
                  {r.correctAnswer && <span className="pv-ai">{app.confirm.correctAnswer(r.correctAnswer)}</span>}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
