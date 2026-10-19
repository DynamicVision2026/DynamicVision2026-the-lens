import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { app } from "../copy";
import type { Grade } from "../curriculum";
import type { Tile, TileStatus } from "../lib/review";
import { LANES, SKY, type SkyLayout, edgeKey, layoutStarmap, rootIds, rootPath, specks } from "../lib/starmap";

/** One star glyph (26 × 26, centred). Grey hollow / teal / coral with halo / gold four-point star. */
export function StarGlyph({ status, lit = false }: { status: TileStatus; lit?: boolean }) {
  return (
    <svg className={`glyph glyph-${status}`} viewBox="-13 -13 26 26" width="26" height="26" aria-hidden focusable="false">
      {lit && <circle className="g-lit" r="10.5" />}
      {status === "empty" && <circle className="g-empty" r="3.4" />}
      {status === "ok" && <circle className="g-ok" r="4.4" />}
      {status === "review" && (
        <>
          <circle className="g-halo" r="8.2" />
          <circle className="g-review" r="4.4" />
        </>
      )}
      {status === "gold" && (
        <>
          <circle className="g-glow" r="9" />
          <path className="g-flare" d="M-11 0H11M0 -12.5V12.5" />
          <path className="g-gold" d="M0 -9Q1.5 -1.5 9 0Q1.5 1.5 0 9Q-1.5 1.5 -9 0Q-1.5 -1.5 0 -9Z" />
        </>
      )}
    </svg>
  );
}

const DEFAULT_W = 358; // 390 px phone minus the 16 px gutters

export function StarMap(props: {
  tiles: Tile[];
  grade: Grade;
  lit: string[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onLayout?: (layout: SkyLayout, canvas: HTMLDivElement) => void;
}) {
  const { tiles, grade, lit, selected, onSelect } = props;
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

  const L = useMemo(() => layoutStarmap(width), [width]);
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
  const ticks: { x: number; y: number }[] = [];
  for (const b of L.bands) for (let i = 1; i < LANES.length; i++) ticks.push({ x: i * L.laneW, y: b.y });

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
          {own && <rect className="sky-own" x={0} y={own.y} width={L.width} height={own.h} rx={10} />}
          {L.bands.map((b) => (
            <line key={b.grade} className="sky-lat" x1={0} x2={L.width} y1={b.y + 0.5} y2={b.y + 0.5} />
          ))}
          {LANES.slice(1).map((l, i) => (
            <line key={l} className="sky-lat sky-lat-v" x1={(i + 1) * L.laneW} x2={(i + 1) * L.laneW} y1={0} y2={L.height} />
          ))}
          {ticks.map((t) => (
            <path key={`${t.x}-${t.y}`} className="sky-tick" d={`M${t.x - 4} ${t.y + 0.5}H${t.x + 4}M${t.x} ${t.y - 3.5}V${t.y + 4.5}`} />
          ))}
          {dots.map((d, i) => (
            <circle key={i} className="sky-speck" cx={d.x} cy={d.y} r={d.r} opacity={d.o} />
          ))}
          {L.edges.map((e) => {
            const on = path?.edges.has(e.key);
            const isLit = litEdges.has(e.key);
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
        </svg>
        {L.bands.map((b) => (
          <div key={b.grade} className={`sky-band-label${b.grade === grade ? " is-own" : ""}`} style={{ top: b.y + 5 }}>
            <span>{b.grade}</span>
            {b.grade === grade && <span className="sky-own-tag">{app.map.own}</span>}
          </div>
        ))}
        {L.nodes.map((n) => {
          const t = byId.get(n.id);
          if (!t) return null;
          const inPath = path?.units.has(n.id);
          const isLit = litSet.has(n.id);
          const code = t.unit.level === "高" ? `${t.unit.grade} ${t.unit.unit}` : t.unit.unit;
          return (
            <button
              key={n.id}
              type="button"
              className={`star-node${n.grade === grade ? " is-own" : ""}${isLit ? " is-lit" : ""}${selected === n.id ? " is-sel" : ""}${inPath ? " is-path" : ""}${path && !inPath ? " is-dim" : ""}`}
              style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
              data-unit={n.id}
              data-status={t.status}
              aria-label={app.map.starLabel(t.unit.appGrade, code, t.unit.topic, app.map.status[t.status])}
              aria-pressed={selected === n.id}
              onClick={() => onSelect(selected === n.id ? null : n.id)}
            >
              <span className="star-glyph" style={{ left: SKY.starX - 1 - 13, top: SKY.starY - 1 - 13 }}>
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
