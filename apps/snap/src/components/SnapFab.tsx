import { Link } from "react-router-dom";
import { app } from "../copy";

/** Camera line drawing (24 px, currentColor): the 撮る tab and the map's floating button. */
export function CameraGlyph() {
  return (
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  );
}

/**
 * The map's floating 「撮る」 button: bottom-right, above the tab bar (safe-area aware), so
 * snapping always starts from the map. Not rendered while a star's sheet is open.
 */
export function SnapFab() {
  return (
    <Link to="/app/snap" className="fab-snap" aria-label={app.map.fabLabel} data-testid="snap-fab">
      <svg className="fab-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden focusable="false">
        <CameraGlyph />
      </svg>
      <span aria-hidden>{app.map.fab}</span>
    </Link>
  );
}
