import { Link } from "react-router-dom";
import { app } from "../copy";
import { CameraGlyph } from "./SnapFab";

/**
 * Empty map (no pages yet): the whole map is unexplored; this small floating card says how
 * territory is won and leads to 撮る (no dead end).
 */
export function WelcomeCard() {
  const w = app.map.terr.empty;
  return (
    <section className="terr-empty" aria-label={w.body} data-testid="map-welcome">
      <p className="terr-empty-body">{w.body}</p>
      <Link to="/app/snap" className="btn terr-empty-cta" data-testid="welcome-snap">
        <svg className="fab-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden focusable="false">
          <CameraGlyph />
        </svg>
        {w.cta}
      </Link>
    </section>
  );
}
