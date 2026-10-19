import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SnapFab } from "../components/SnapFab";
import { TerrGlyph } from "../components/TerrGlyph";
import { type MapApi, TerritoryMap } from "../components/TerritoryMap";
import { WelcomeCard } from "../components/WelcomeCard";
import { app } from "../copy";
import { type Grade, type Unit, isHighSchool, unitById } from "../curriculum";
import { focusFromParam, savedToast } from "../lib/home";
import type { SavedPage } from "../lib/model";
import { type MapSection, type Tile, mapSections, mapTiles, parseLit, unfiled } from "../lib/review";
import { sheetData } from "../lib/starmap";
import { type Hud, LEVELS, STRANDS, buildHud, colorKeyOf, unitHistory } from "../lib/territory";
import { readPref, usePages, writePref } from "../state";

const TOAST_MS = 4500;
/** Rows of the unit's history shown in the sheet before 「ほか Nページ」. */
const HISTORY_ROWS = 6;
type View = "sky" | "list";

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const codeOf = (u: Unit) => (u.level === "高" ? `${u.grade} ${u.unit}` : u.unit);

export function MapScreen({ grade }: { grade: Grade }) {
  const { pages } = usePages();
  const [params] = useSearchParams();
  const lit = useMemo(() => parseLit(params.get("lit")), [params]);
  const saved = Number(params.get("saved") ?? 0);
  const savedId = params.get("page");
  const unitParam = params.get("unit");
  const [view, setViewState] = useState<View>(() => (readPref("map-view") === "list" ? "list" : "sky"));
  const setView = (v: View) => {
    writePref("map-view", v);
    setViewState(v);
  };
  const [toast, setToast] = useState(saved > 0);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  if (!pages) return <div className={`page${view === "sky" ? " terr-page" : ""}`} />;
  const nUnfiled = unfiled(pages);
  const savedPage = savedId ? pages.find((pg) => pg.id === savedId) : undefined;
  const toastEl = toast && (
    <div className="toast toast-row toast-map" role="status">
      <span className="toast-text" data-testid="lit-toast">
        {/* ✕ 2問 / ○ 2問 never split across lines */}
        {(savedPage ? savedToast(savedPage) : app.map.litToast(saved, lit.length > 0)).replace(/([✕○]) /g, "$1 ")}
      </span>
      <Link to="/app/report" className="toast-link" data-testid="toast-report">
        {app.map.toReport}
      </Link>
    </div>
  );

  if (view === "sky")
    return (
      <div className="page terr-page" data-view="sky">
        <TerritoryView pages={pages} grade={grade} lit={lit} unit={unitParam} unfiled={nUnfiled} onList={() => setView("list")} />
        {toastEl}
      </div>
    );
  return (
    <div className="page" data-view="list">
      <div className="map-head">
        <h1>{app.map.title}</h1>
        <div className="seg seg-sm view-toggle" role="radiogroup" aria-label={app.map.viewLabel}>
          {(["sky", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              className={`seg-item ${view === v ? "is-on" : ""}`}
              onClick={() => setView(v)}
            >
              {app.map.view[v]}
            </button>
          ))}
        </div>
      </div>
      <ListHeader />
      {nUnfiled > 0 && <p className="notice notice-warn">{app.map.unfiled(nUnfiled)}</p>}
      <ListView pages={pages} grade={grade} lit={lit} />
      <SnapFab />
      {toastEl}
    </div>
  );
}

// ---------- 領土マップ ----------

function TerritoryView(props: { pages: SavedPage[]; grade: Grade; lit: string[]; unit: string | null; unfiled: number; onList: () => void }) {
  const { pages, grade, lit, unit } = props;
  const tiles = useMemo(() => mapTiles(pages), [pages]);
  const hud = useMemo(() => buildHud(pages, grade), [pages, grade]);
  const empty = pages.length === 0;
  // ?unit=5-C3 (from the 学習レポート): that unit open on arrival.
  const [selected, setSelected] = useState<string | null>(() => focusFromParam(unit, grade).selected);
  // 次にやること: which of hud.next is being shown (one by one), and the tile pointed at.
  const [tour, setTour] = useState<number | null>(null);
  const api = useRef<MapApi | null>(null);
  const pointed = tour !== null ? hud.next[tour] ?? null : null;

  const select = (id: string | null) => {
    setSelected(id);
    if (id === null || (tour !== null && hud.next[tour] !== id)) setTour(null);
  };
  const nextStep = () => {
    if (hud.next.length === 0) return;
    const i = tour === null ? 0 : (tour + 1) % hud.next.length;
    setTour(i);
    setSelected(hud.next[i]);
  };

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && select(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const data = selected ? sheetData(selected, tiles) : null;
  return (
    <div className={`terr${empty ? " is-empty" : ""}${data ? " has-sheet" : ""}`}>
      <TerritoryMap tiles={tiles} grade={grade} selected={selected} onSelect={select} lit={lit} pointed={pointed} sheetOpen={!!data} api={api} />
      <div className="terr-hud">
        <div className="hud-tl">
          <div className="hud-brand">
            <h1 className="hud-title">{app.map.title}</h1>
            <button type="button" className="hud-icon hud-list" aria-label={app.map.terr.list} onClick={props.onList} data-testid="map-to-list">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden focusable="false">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          {hud.next.length > 0 && (
            <button type="button" className={`hud-next${tour !== null ? " is-on" : ""}`} onClick={nextStep} aria-label={app.map.terr.nextLabel(hud.next.length)} data-testid="hud-next">
              <span className="hud-next-flag" aria-hidden />
              {app.map.terr.next(hud.next.length)}
            </button>
          )}
          {props.unfiled > 0 && <p className="hud-note">{app.map.unfiled(props.unfiled)}</p>}
        </div>
        <HudCard hud={hud} />
        {!empty && <Legend />}
        {empty && <WelcomeCard />}
        <div className="hud-ctrl">
          <button type="button" className="hud-icon hud-zoom" aria-label={app.map.terr.zoomIn} onClick={() => api.current?.zoom(1.5)} data-testid="zoom-in">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden focusable="false"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button type="button" className="hud-icon hud-zoom" aria-label={app.map.terr.zoomOut} onClick={() => api.current?.zoom(1 / 1.5)} data-testid="zoom-out">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden focusable="false"><path d="M5 12h14" /></svg>
          </button>
          <button type="button" className="hud-compass" aria-label={app.map.terr.hereLabel(grade)} onClick={() => api.current?.home()} data-testid="compass">
            <svg viewBox="-60 -60 120 120" width="52" height="52" aria-hidden focusable="false">
              <circle className="cmp-ring" r="54" />
              <path className="cmp-n" d="M0 -46 L10 0 L0 8 L-10 0Z" />
              <path className="cmp-s" d="M0 46 L10 0 L0 -8 L-10 0Z" />
            </svg>
            <span className="hud-compass-label">{app.map.terr.here}</span>
          </button>
        </div>
        {!empty && !data && <SnapFab />}
      </div>
      {data && (
        <Sheet
          data={data}
          pages={pages}
          onClose={() => select(null)}
          onPick={(id) => select(id)}
          tour={tour !== null && hud.next[tour] === selected ? { i: tour + 1, n: hud.next.length, next: nextStep } : null}
        />
      )}
    </div>
  );
}

/** Top-right card, styled after the video's 「見つけた 知識・技能」 card. */
function HudCard({ hud }: { hud: Hud }) {
  const t = app.map.terr;
  const review = hud.counts.review;
  return (
    <section className="hud-card" aria-label={t.hudLabel(hud.grade, hud.taken, hud.total, review)} data-testid="hud-card">
      <div className="hud-t">{t.hudTitle(hud.grade)}</div>
      <div className="hud-n" data-testid="hud-taken">
        <b>{hud.taken}</b>
        <span> / {hud.total}</span>
      </div>
      {LEVELS.map((l) => {
        const { taken, total } = hud.levels[l];
        return (
          <div key={l} className="hud-bar" data-level={l}>
            <span className="hud-bar-l">{l}</span>
            <i>
              <b className={`hb-${l === "小" ? "e" : l === "中" ? "j" : "h"}`} style={{ width: `${total ? (taken / total) * 100 : 0}%` }} />
            </i>
            <em>{`${taken}/${total}`}</em>
          </div>
        );
      })}
      {review > 0 && (
        <div className="hud-review" data-testid="hud-review">
          {t.review(review)}
        </div>
      )}
    </section>
  );
}

/** Bottom-left legend: the video's strand legend + the four territory states. */
function Legend() {
  const t = app.map.terr;
  return (
    <section className="hud-legend" aria-label={t.legend} data-testid="map-legend">
      <ul className="lg-strands">
        {STRANDS.map((s) => (
          <li key={s}>
            <i className={`lg-sw c-${s}`} />
            {t.strands[s]}
          </li>
        ))}
        <li className="lg-hs">
          <i className="lg-sw lg-sw-hs" />
          {t.strands.hs}
        </li>
      </ul>
      <ul className="lg-states" data-testid="legend-states">
        {(["empty", "ok", "review", "gold"] as const).map((s) => (
          <li key={s}>
            <TerrGlyph status={s} size={22} />
            {t.states[s]}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Sheet(props: {
  data: NonNullable<ReturnType<typeof sheetData>>;
  pages: SavedPage[];
  onClose: () => void;
  onPick: (id: string) => void;
  tour: { i: number; n: number; next: () => void } | null;
}) {
  const { data, pages, onClose, onPick, tour } = props;
  const { unit, tile, roots } = data;
  const s = app.map.sheet;
  const t = app.map.terr;
  const history = unitHistory(pages, unit.id);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollTo?.({ top: 0 });
  }, [unit.id]);
  return (
    <section ref={ref} className="sheet terr-sheet" role="dialog" aria-modal="false" aria-labelledby="sheet-title" data-testid="star-sheet">
      <div className="sheet-top">
        <div className="sheet-kicker">
          <span className="sheet-grade">{unit.appGrade}</span>
          <span className="sheet-code">{codeOf(unit)}</span>
        </div>
        {tour && (
          <button type="button" className="btn btn-terr-next" onClick={tour.next} data-testid="tour-next">
            {t.nextOf(tour.i, tour.n)}
          </button>
        )}
        <button type="button" className="sheet-close" onClick={onClose} aria-label={s.close}>
          ×
        </button>
      </div>
      <h2 id="sheet-title" className="sheet-title">
        <TerrGlyph status={tile.status} color={colorKeyOf(unit)} size={34} />
        {unit.topic}
      </h2>
      <dl className="sheet-stats">
        <div>
          <dt>{s.problems}</dt>
          <dd>{tile.count}</dd>
        </div>
        <div>
          <dt>{s.wrong}</dt>
          <dd className={tile.wrong > 0 && tile.status !== "gold" ? "sum-review" : ""}>{tile.status === "gold" ? 0 : tile.wrong}</dd>
        </div>
        <div className="sheet-state">
          <dt>{s.state}</dt>
          <dd className={`sum-${tile.status}`}>{app.map.terr.states[tile.status]}</dd>
        </div>
      </dl>
      <h3 className="sheet-h">{t.history}</h3>
      {history.length === 0 ? (
        <p className="sheet-none">{t.noHistory}</p>
      ) : (
        <ol className="sheet-history" data-testid="sheet-history">
          {history.slice(0, HISTORY_ROWS).map((h) => (
            <li key={h.pageId}>
              <span className="hist-date">{h.date}</span>
              <span className="hist-type">{h.type}</span>
              <span className={`hist-x${h.wrong > 0 ? " is-wrong" : ""}`}>{t.historyRow.wrong(h.wrong)}</span>
              <span className="hist-o">{t.historyRow.ok(h.ok)}</span>
              {h.none > 0 && <span className="hist-n">{t.historyRow.none(h.none)}</span>}
            </li>
          ))}
          {history.length > HISTORY_ROWS && <li className="hist-more">{t.historyMore(history.length - HISTORY_ROWS)}</li>}
        </ol>
      )}
      <h3 className="sheet-h">{s.roots}</h3>
      {roots.length === 0 ? (
        <p className="sheet-none">{s.noRoots}</p>
      ) : (
        <ul className="sheet-roots">
          {roots.map((r) => (
            <li key={r.unit.id}>
              <button type="button" className="root-btn" onClick={() => onPick(r.unit.id)} data-unit={r.unit.id}>
                <TerrGlyph status={r.status} color={colorKeyOf(r.unit)} size={28} />
                <span className="root-grade">{r.unit.appGrade}</span>
                <span className="root-topic">{r.unit.topic}</span>
                <span className="root-go" aria-hidden>›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="sheet-foot">
        <Link to={`/app/list?unit=${encodeURIComponent(unit.id)}`} className="btn btn-terr sheet-open">
          {s.open}
        </Link>
        <Link to="/app/report" className="sheet-report" data-testid="sheet-report">
          {s.report}
        </Link>
      </div>
    </section>
  );
}

// ---------- 一覧 (tile view, unchanged behaviour) ----------

function ListHeader() {
  return (
    <>
      <p className="muted">{app.map.body}</p>
      <div className="legend">
        <span><i className="dot dot-review" />{app.map.legend.review}</span>
        <span><i className="dot dot-ok" />{app.map.legend.ok}</span>
        <span><i className="dot dot-gold" />{app.map.legend.gold}</span>
        <span><i className="dot dot-empty" />{app.map.legend.empty}</span>
      </div>
    </>
  );
}

function ListView({ pages, grade, lit }: { pages: Parameters<typeof mapSections>[0]; grade: Grade; lit: string[] }) {
  // Open: the child's own grade, plus any grade that holds a unit lit by the last save.
  const [open, setOpen] = useState<Set<Grade>>(() => {
    const s = new Set<Grade>([grade]);
    for (const id of lit) {
      const u = unitById(id);
      if (u) s.add(u.appGrade);
    }
    return s;
  });

  // Bring the first lit tile into view once the tiles are on screen.
  useEffect(() => {
    if (lit.length === 0) return;
    const el = document.querySelector(`[data-unit="${CSS.escape(lit[0])}"]`);
    el?.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
  }, [lit]);

  const sections = mapSections(pages, grade);
  const litSet = new Set(lit);
  const toggle = (g: Grade, isOpen: boolean) =>
    setOpen((s) => {
      if (s.has(g) === isOpen) return s;
      const n = new Set(s);
      if (isOpen) n.add(g);
      else n.delete(g);
      return n;
    });
  return (
    <>
      {sections.map((s) => (
        <Section key={s.grade} section={s} open={open.has(s.grade)} onToggle={toggle} lit={litSet} />
      ))}
    </>
  );
}

function Section(props: { section: MapSection; open: boolean; onToggle: (g: Grade, open: boolean) => void; lit: Set<string> }) {
  const { grade, own, tiles, counts } = props.section;
  return (
    <details
      className={`grade-sec ${own ? "is-own" : ""}`}
      open={props.open}
      onToggle={(e) => props.onToggle(grade, e.currentTarget.open)}
      data-grade={grade}
    >
      <summary>
        <span className="sec-grade">{grade}</span>
        {own && <span className="sec-own">{app.map.own}</span>}
        <span className="sec-sum">
          {counts.review > 0 && <span className="sum sum-review">{app.map.sum.review(counts.review)}</span>}
          {counts.gold > 0 && <span className="sum sum-gold">{app.map.sum.gold(counts.gold)}</span>}
          {counts.ok > 0 && <span className="sum sum-ok">{app.map.sum.ok(counts.ok)}</span>}
          <span>{app.map.units(tiles.length)}</span>
        </span>
      </summary>
      <Tiles tiles={tiles} showSubject={isHighSchool(grade)} lit={props.lit} />
    </details>
  );
}

function Tiles({ tiles, showSubject, lit }: { tiles: Tile[]; showSubject: boolean; lit: Set<string> }) {
  return (
    <ul className="tiles">
      {tiles.map((t) => (
        <li key={t.unit.id}>
          <Link
            to={`/app/list?unit=${encodeURIComponent(t.unit.id)}`}
            className={`tile tile-${t.status}${lit.has(t.unit.id) ? " is-lit" : ""}`}
            data-unit={t.unit.id}
            data-status={t.status}
          >
            <span className="tile-code">
              {showSubject ? `${t.unit.grade} ` : ""}
              {t.unit.unit}
              {t.status === "gold" && <span className="tile-star"> {app.map.star}</span>}
            </span>
            <span className="tile-topic">{t.unit.topic}</span>
            <span className="tile-stats">
              {t.count > 0 ? app.map.problems(t.count) : "—"}
              {/* A gold tile hides old ✕ counts: the newest test proved the unit. */}
              {t.wrong > 0 && t.status !== "gold" && <b className="tile-wrong">{app.map.wrong(t.wrong)}</b>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
