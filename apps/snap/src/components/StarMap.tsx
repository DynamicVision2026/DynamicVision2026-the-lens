import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { app } from "../copy";
import type { Grade } from "../curriculum";
import type { Tile, TileStatus } from "../lib/review";
import { LANES, SKY, type SkyLayout, edgeKey, layoutStarmap, rootIds, rootPath, specks } from "../lib/starmap";

const GOLD_STAR = "M0 -12Q2 -2 12 0Q2 2 0 12Q-2 2 -12 0Q-2 -2 0 -12Z";

/** The shapes of one star mark, centred on 0,0 (near size). Grey recedes; data glows. */
function marks(status: TileStatus, lit: boolean) {
  return (
    <>
      {lit && <circle className="g-lit" r="16" />}
      {status === "empty" && <circle className="g-empty" r="1.9" />}
      {status === "ok" && (
        <>
          <circle className="g-ok g-soft" r="11" />
          <circle className="g-ok" r="7" />
        </>
      )}
      {status === "review" && (
        <>
          <circle className="g-review g-soft" r="12" />
          <circle className="g-halo" r="11" />
          <circle className="g-review" r="7" />
        </>
      )}
      {status === "gold" && (
        <>
          <circle className="g-glow" r="13" />
          <path className="g-flare" d="M-14 0H14M0 -18V18" />
          <path className="g-gold" d={GOLD_STAR} />
        </>
      )}
    </>
  );
}

/** One star mark as its own small SVG (chart buttons, legend, sheet). */
export function StarGlyph({ status, lit = false, size = 40 }: { status: TileStatus; lit?: boolean; size?: number }) {
  return (
    <svg className={`glyph glyph-${status}`} viewBox="-20 -20 40 40" width={size} height={size} aria-hidden focusable="false">
      {marks(status, lit)}
    </svg>
  );
}

const DEFAULT_W = 358; // 390 px phone minus the 16 px gutters

export function StarMap(props: {
  tiles: Tile[];
  grade: Grade;
  near: Set<Grade>;
  opened: Grade | null;
  onOpen: (g: Grade | null) => void;
  lit: string[];
  selected: string | null;
  /** Stars to ring (the earlier-grade ✕ units from the report strip). */
  marked?: Set<string> | null;
  onSelect: (id: string | null) => void;
  onLayout?: (layout: SkyLayout, canvas: HTMLDivElement) => void;
}) {
  const { tiles, grade, near, opened, onOpen, lit, selected, onSelect } = props;
  const marked = props.marked ?? null;
  const canvas = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_W);

  useLayoutEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(280, Math.round(el.clientWidth)));
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const nearKey = [...near].sort().join(",");
  // nearKey: the set's contents, so a new Set with the same grades does not re-layout.
  const L = useMemo(() => layoutStarmap(width, nearKey.split(",") as Grade[]), [width, nearKey]);
  const dots = useMemo(() => specks(L.width, L.height), [L]);
  const byId = useMemo(() => new Map(tiles.map((t) => [t.unit.id, t])), [tiles]);
  const path = useMemo(() => (selected ? rootPath(selected) : null), [selected]);
  const litSet = useMemo(() => new Set(lit), [lit]);
  const litEdges = useMemo(() => new Set(lit.flatMap((id) => rootIds(id).map((r) => edgeKey(id, r)))), [lit]);

  const onLayout = props.onLayout;
  useLayoutEffect(() => {
    if (canvas.current) onLayout?.(L, canvas.current);
  }, [L, onLayout]);

  const own = L.bands.find((b) => b.grade === grade);
  const statusOf = (id: string): TileStatus => byId.get(id)?.status ?? "empty";

  return (
    <div className={`sky${path ? " has-sel" : ""}`}>
      <div className="sky-lanes" aria-hidden>
        {LANES.map((l) => (
          <span key={l}>{app.map.lanes[l]}</span>
        ))}
      </div>
      <div
        ref={canvas}
        className="sky-canvas"
        style={{ height: L.height }}
        role="group"
        aria-label={app.map.chartLabel}
        onClick={(e) => {
          if (e.target === e.currentTarget || (e.target as Element).closest("svg.sky-svg")) onSelect(null);
        }}
      >
        <svg className="sky-svg" width={L.width} height={L.height} aria-hidden focusable="false">
          <defs>
            <radialGradient id="sky-lift" cx="50%" cy="50%" r="50%">
              <stop offset="0%" className="lift-in" />
              <stop offset="100%" className="lift-out" />
            </radialGradient>
          </defs>
          {own && (
            <>
              <rect className="sky-own" x={0} y={own.y} width={L.width} height={own.h} rx={12} />
              <ellipse cx={L.width / 2} cy={own.y + own.h / 2} rx={L.width * 0.75} ry={own.h * 0.8} fill="url(#sky-lift)" />
            </>
          )}
          {L.bands.slice(1).map((b) => (
            <line key={b.grade} className="sky-lat" x1={0} x2={L.width} y1={b.y + 0.5} y2={b.y + 0.5} />
          ))}
          {dots.map((d, i) => (
            <circle key={i} className="sky-speck" cx={d.x} cy={d.y} r={d.r} opacity={d.o} />
          ))}
          {L.edges.map((e) => {
            const on = path?.edges.has(e.key);
            const isLit = litEdges.has(e.key);
            // Constellations only where there is meaning: the open path and the light-up draw every
            // root; otherwise a unit with data shows its strongest root, softly, within the same sky
            // (near → near or far → far), so lines never run through a whole stack into the far sky.
            if (!on && !isLit) {
              const a = L.byId.get(e.from)!;
              const b = L.byId.get(e.to)!;
              if (statusOf(e.from) === "empty" || rootIds(e.from)[0] !== e.to || a.far !== b.far) return null;
            }
            return (
              <path
                key={e.key}
                d={e.d}
                pathLength={1}
                className={`sky-edge${on ? " is-path" : ""}${path && !on ? " is-dim" : ""}${isLit ? " is-lit" : ""}`}
                data-edge={e.key}
              />
            );
          })}
          {L.nodes
            .filter((n) => n.far)
            .map((n) => {
              const st = statusOf(n.id);
              const dim = path && !path.units.has(n.id);
              const ring = marked?.has(n.id);
              return (
                <g
                  key={n.id}
                  className={`far-star${dim ? " is-dim" : ""}${ring ? " is-marked" : ""}`}
                  transform={`translate(${n.cx.toFixed(1)} ${n.cy}) scale(${st === "empty" ? 0.8 : 0.5})`}
                  data-unit={n.id}
                  data-status={st}
                >
                  {ring && <circle className="g-mark" r="22" />}
                  {marks(st, false)}
                </g>
              );
            })}
        </svg>
        {L.bands.map((b) =>
          b.near ? (
            <div key={b.grade} className={`sky-band-label${b.grade === grade ? " is-own" : ""}`} style={{ top: b.y + 5 }}>
              <span>{b.grade}</span>
              {b.grade === grade && <span className="sky-own-tag">{app.map.own}</span>}
              {b.grade === opened && (
                <button type="button" className="sky-fold" onClick={() => onOpen(null)}>
                  {app.map.fold}
                </button>
              )}
            </div>
          ) : (
            <button
              key={b.grade}
              type="button"
              className="far-band"
              style={{ top: b.y, height: b.h }}
              data-grade={b.grade}
              aria-label={app.map.openBand(b.grade)}
              onClick={() => onOpen(b.grade)}
            >
              <span>{b.grade}</span>
            </button>
          ),
        )}
        {L.nodes
          .filter((n) => !n.far)
          .map((n) => {
            const t = byId.get(n.id);
            if (!t) return null;
            const inPath = path?.units.has(n.id);
            const isLit = litSet.has(n.id);
            const code = t.unit.level === "高" ? `${t.unit.grade} ${t.unit.unit}` : t.unit.unit;
            return (
              <button
                key={n.id}
                type="button"
                className={`star-node${t.status === "empty" ? "" : " has-data"}${n.grade === grade ? " is-own" : ""}${isLit ? " is-lit" : ""}${selected === n.id ? " is-sel" : ""}${inPath ? " is-path" : ""}${path && !inPath ? " is-dim" : ""}${marked?.has(n.id) ? " is-marked" : ""}`}
                style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
                data-unit={n.id}
                data-status={t.status}
                aria-label={app.map.starLabel(t.unit.appGrade, code, t.unit.topic, app.map.status[t.status])}
                aria-pressed={selected === n.id}
                onClick={() => onSelect(selected === n.id ? null : n.id)}
              >
                <span className="star-glyph" style={{ left: SKY.starX - 1 - 20, top: SKY.starY - 1 - 20 }}>
                  <StarGlyph status={t.status} lit={isLit} />
                </span>
                <span className="star-label">{t.unit.topic}</span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
