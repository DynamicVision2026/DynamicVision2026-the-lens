import { Link } from "react-router-dom";
import { app } from "../copy";
import type { Grade } from "../curriculum";
import { BAR_ORDER } from "../lib/report";
import { CameraGlyph } from "./SnapFab";
import { StarGlyph } from "./StarMap";

/** Empty map (no pages yet): in place of the report strip, same sky pane. No dead end: one big 撮る. */
export function WelcomeCard({ grade }: { grade: Grade }) {
  const w = app.map.welcome;
  return (
    <section className="strip welcome" aria-labelledby="welcome-h" data-testid="map-welcome">
      <h2 id="welcome-h" className="welcome-title">{w.title(grade)}</h2>
      <p className="welcome-body">{w.body}</p>
      <ul className="welcome-legend" aria-label={w.legend} data-testid="welcome-legend">
        {BAR_ORDER.map((k) => (
          <li key={k}>
            <StarGlyph status={k} size={22} />
            {app.map.skyLegend[k]}
          </li>
        ))}
      </ul>
      <Link to="/app/snap" className="btn btn-sky welcome-cta" data-testid="welcome-snap">
        <svg className="fab-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden focusable="false">
          <CameraGlyph />
        </svg>
        {w.cta}
      </Link>
    </section>
  );
}
