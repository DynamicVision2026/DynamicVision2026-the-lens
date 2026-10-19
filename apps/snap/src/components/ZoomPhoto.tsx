import { app } from "../copy";
import type { SavedPage } from "../lib/model";
import { usePhotoUrl } from "./PhotoThumb";
import { usePhotoZoom } from "./usePhotoZoom";

/** A photo on its own stage with pinch / double-tap / wheel zoom (the confirm screen's photo column on tablets). */
export function ZoomPhoto({ photo, alt }: { photo: SavedPage["photo"]; alt: string }) {
  const url = usePhotoUrl(photo);
  const { stage, body, reset, resetZoom, stageProps } = usePhotoZoom();
  const t = app.map.viewer;
  return (
    <figure className="zp" aria-label={alt} data-testid="confirm-photo">
      <div ref={stage} className="zp-stage" {...stageProps} data-zoomed="0" data-testid="confirm-photo-stage">
        <div ref={body} className="zp-body">
          {url && <img src={url} alt={alt} draggable={false} />}
        </div>
        <p className="zp-hint" aria-hidden>
          {t.zoomHint}
        </p>
      </div>
      <button ref={reset} type="button" className="zp-reset" hidden onClick={resetZoom} data-testid="confirm-photo-reset">
        {t.reset}
      </button>
    </figure>
  );
}
