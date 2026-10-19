import { useEffect, useRef } from "react";
import { app } from "../copy";
import type { SavedPage } from "../lib/model";
import { pageView } from "../lib/unitsheet";
import { usePhotoUrl } from "./PhotoThumb";
import { usePhotoZoom } from "./usePhotoZoom";

/**
 * Full-screen page viewer over the map (from a thumbnail or a history row in the unit sheet): the saved
 * downscaled photo with pinch / double-tap / wheel zoom and pan, and the page's problems listed under it
 * with the open unit's problems highlighted. Closing it goes back to the same sheet (history entry).
 * Wide layouts (landscape): the photo on the left, the problem list as a right-hand column.
 */
export function PageViewer({ page, unitId, onClose }: { page: SavedPage; unitId: string | null; onClose: () => void }) {
  const v = pageView(page, unitId);
  const url = usePhotoUrl(page.photo);
  const t = app.map.viewer;
  const s = app.map.sheet;
  const { stage, body, reset, resetZoom, stageProps } = usePhotoZoom();
  const list = useRef<HTMLOListElement>(null);

  // the open unit's first problem in view in the list
  useEffect(() => {
    const first = list.current?.querySelector<HTMLElement>(".pv-row.is-unit");
    if (first && list.current) list.current.scrollTop = Math.max(0, first.offsetTop - 8);
  }, [page.id]);

  return (
    <div className="pv" role="dialog" aria-modal="true" aria-label={t.label(v.date, v.type)} data-testid="page-viewer" data-page={page.id}>
      <div className="pv-top">
        <div className="pv-title">
          <b>{t.label(v.date, v.type)}</b>
          <span>{t.count(v.rows.length)}</span>
        </div>
        <button ref={reset} type="button" className="pv-reset" hidden onClick={resetZoom} data-testid="viewer-reset">
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
          {...stageProps}
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
