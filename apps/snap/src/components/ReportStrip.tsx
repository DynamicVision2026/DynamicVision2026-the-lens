import { useState } from "react";
import { Link } from "react-router-dom";
import { app } from "../copy";
import type { Strip } from "../lib/home";
import { BAR_ORDER } from "../lib/report";
import { readPref, writePref } from "../state";
import { StarGlyph } from "./StarMap";

const s = app.map.strip;
const st = app.report.state;
const PREF = "map-strip";

/**
 * The 学習レポート at one glance, at the top of the 単元マップ (same night sky, same star colours).
 * Folds to one line; the choice is remembered on this device.
 */
export function ReportStrip(props: {
  strip: Strip;
  onPick: (id: string) => void;
  earlierOn: boolean;
  onEarlier: () => void;
  /** Units of the page just saved: their 次にやること rows glow once (after the map glides back up). */
  fresh?: string[];
}) {
  const { strip, onPick, earlierOn, onEarlier } = props;
  const fresh = new Set(props.fresh ?? []);
  const [open, setOpenState] = useState(() => readPref(PREF) !== "closed");
  const setOpen = (v: boolean) => {
    writePref(PREF, v ? "open" : "closed");
    setOpenState(v);
  };
  const title = s.title(strip.grade, strip.total);
  const words = BAR_ORDER.map((k) => `${st[k]} ${strip.counts[k]}`).join("・");

  if (!open) {
    return (
      <section className="strip is-folded" aria-label={s.label} data-testid="map-strip" data-open="false">
        <button
          type="button"
          className="strip-line"
          aria-expanded={false}
          aria-label={`${title}　${words}　${s.foldedNext(strip.next.length)}。${s.unfold}`}
          onClick={() => setOpen(true)}
          data-testid="strip-toggle"
        >
          <span className="strip-title">{title}</span>
          <span className="strip-mini" aria-hidden>
            {BAR_ORDER.map((k) => (
              <span key={k} className={`sm sm-${k}`}>
                <StarGlyph status={k} size={20} />
                {strip.counts[k]}
              </span>
            ))}
          </span>
          <span className="strip-chev" aria-hidden>
            {s.unfold}
          </span>
        </button>
      </section>
    );
  }

  const shown = BAR_ORDER.filter((k) => strip.counts[k] > 0);
  return (
    <section className="strip" aria-labelledby="strip-h" data-testid="map-strip" data-open="true">
      <div className="strip-top">
        <h2 id="strip-h" className="strip-title">{title}</h2>
        <button type="button" className="strip-fold" aria-expanded aria-label={s.foldLabel} onClick={() => setOpen(false)} data-testid="strip-toggle">
          {s.fold}
        </button>
      </div>
      <div className="strip-bar" role="img" aria-label={`${title} ${words}`} data-testid="strip-bar">
        {shown.map((k) => (
          <span key={k} className={`sb sb-${k}`} style={{ flexGrow: strip.counts[k] }} data-state={k} />
        ))}
      </div>
      <p className="strip-counts" aria-hidden data-testid="strip-counts">
        {BAR_ORDER.map((k) => (
          <span key={k} className={`sc sc-${k}`}>
            <StarGlyph status={k} size={20} />
            {st[k]}
            <b>{strip.counts[k]}</b>
          </span>
        ))}
      </p>
      <h3 className="strip-h">{s.next}</h3>
      {strip.next.length === 0 ? (
        <p className="strip-none">{s.noNext}</p>
      ) : (
        <ul className="strip-rows" data-testid="strip-next">
          {strip.next.map((n) => (
            <li key={n.unit.id}>
              <button
                type="button"
                className={`strip-row${fresh.has(n.unit.id) ? " is-fresh" : ""}`}
                data-unit={n.unit.id}
                onClick={() => onPick(n.unit.id)}
              >
                <StarGlyph status="review" size={24} />
                <span className="strip-unit">
                  {n.unit.appGrade !== strip.grade && <span className="strip-grade">{n.unit.appGrade}</span>}
                  {n.unit.topic}
                </span>
                <span className="strip-wrong">{app.report.wrong(n.wrong)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="strip-actions">
        {strip.nextList && (
          <Link to={strip.nextList} className="btn btn-sky strip-btn" data-testid="strip-open-list">
            {s.openList}
          </Link>
        )}
        <Link to="/app/report" className="strip-more" data-testid="strip-report">
          {s.toReport}
          <span aria-hidden> ›</span>
        </Link>
      </div>
      {strip.earlier.length > 0 && (
        <button type="button" className="strip-earlier" aria-pressed={earlierOn} onClick={onEarlier} data-testid="strip-earlier">
          <span className="strip-earlier-ring" aria-hidden />
          <span className="strip-earlier-text">{s.earlier(strip.earlier.length)}</span>
          <span className="strip-earlier-chev" aria-hidden>
            {earlierOn ? "−" : "+"}
          </span>
        </button>
      )}
    </section>
  );
}
