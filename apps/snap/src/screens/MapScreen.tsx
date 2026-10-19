import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { PageViewer } from "../components/PageViewer";
import { PhotoThumb } from "../components/PhotoThumb";
import { SnapFab } from "../components/SnapFab";
import { TerrGlyph } from "../components/TerrGlyph";
import { type MapApi, TerritoryMap } from "../components/TerritoryMap";
import { WelcomeCard } from "../components/WelcomeCard";
import { app } from "../copy";
import { type Grade, type Unit, isHighSchool, unitById } from "../curriculum";
import { focusFromParam, savedToast } from "../lib/home";
import { type NavStep, arrivalStep, closeTop, layersOf, openSheet, openViewer, openYears } from "../lib/layers";
import type { SavedPage } from "../lib/model";
import { type MapSection, type Tile, mapSections, mapTiles, parseLit, unfiled } from "../lib/review";
import { sheetData } from "../lib/starmap";
import { setReviewed } from "../lib/store";
import { type Hud, LEVELS, STRANDS, buildHud, colorKeyOf, zoneName } from "../lib/territory";
import { type SheetProblem, type UnitSheet, unitSheet } from "../lib/unitsheet";
import { type YearRow, yearlyRecord } from "../lib/yearly";
import { readPref, usePages, writePref } from "../state";

const TOAST_MS = 4500;
/** Rows of the unit's history shown in the sheet before 「ほか Nページ」. */
const HISTORY_ROWS = 6;
type View = "sky" | "list";

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const codeOf = (u: Unit) => (u.level === "高" ? `${u.grade} ${u.unit}` : u.unit);

export function MapScreen({ grade }: { grade: Grade }) {
  const { pages, reload, setPages } = usePages();
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
  // 「復習した」 in the sheet: the same data as the テスト前リスト (optimistic, then IndexedDB)
  const onTick = (pageId: string, index: number, checked: boolean) => {
    setPages(pages.map((pg) => (pg.id !== pageId ? pg : { ...pg, problems: pg.problems.map((p, j) => (j === index ? { ...p, reviewed: checked } : p)) })));
    setReviewed(pageId, index, checked).catch(() => reload());
  };
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
        <TerritoryView pages={pages} grade={grade} lit={lit} unit={unitParam} unfiled={nUnfiled} onList={() => setView("list")} onTick={onTick} />
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

function TerritoryView(props: {
  pages: SavedPage[];
  grade: Grade;
  lit: string[];
  unit: string | null;
  unfiled: number;
  onList: () => void;
  onTick: (pageId: string, index: number, checked: boolean) => void;
}) {
  const { pages, grade, lit, unit } = props;
  const tiles = useMemo(() => mapTiles(pages), [pages]);
  const hud = useMemo(() => buildHud(pages, grade), [pages, grade]);
  const empty = pages.length === 0;
  // Layers over the map live in the history (lib/layers): back / swipe-back closes the page viewer,
  // then the sheet, and only then leaves the map.
  const loc = useLocation();
  const navigate = useNavigate();
  const layers = layersOf(loc.state);
  const go = (step: NavStep | null) => {
    if (!step) return;
    if (step.kind === "back") navigate(-1);
    else navigate({ pathname: loc.pathname, search: loc.search }, { replace: step.kind === "replace", state: step.state });
  };
  const selected = layers.sheet;
  // ?unit=5-C3 (from the 学習レポート): that unit's sheet on arrival, as its own history entry.
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;
    go(arrivalStep(layers, focusFromParam(unit, grade).selected));
    // on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 次にやること: which of hud.next is being shown (one by one), and the tile pointed at.
  const [tour, setTour] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const api = useRef<MapApi | null>(null);
  const yearRows = useMemo(() => (layers.years ? yearlyRecord(pages, grade) : []), [layers.years, pages, grade]);
  const pointed = tour !== null && selected ? hud.next[tour] ?? null : null;
  useEffect(() => {
    if (!selected) setTour(null);
  }, [selected]);

  const select = (id: string | null) => {
    if (id) go(openSheet(layers, id));
    else if (selected) go(closeTop(layers));
    if (id === null || (tour !== null && hud.next[tour] !== id)) setTour(null);
  };
  const nextStep = () => {
    if (hud.next.length === 0) return;
    const i = tour === null ? 0 : (tour + 1) % hud.next.length;
    setTour(i);
    go(openSheet(layers, hud.next[i]));
  };

  useEffect(() => {
    if (!selected && !layers.years && !menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (menu) setMenu(false);
      else go(closeTop(layers));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const data = selected ? sheetData(selected, tiles) : null;
  const record = useMemo(() => (selected ? unitSheet(pages, selected) : null), [pages, selected]);
  const viewerPage = data && layers.viewer ? pages.find((pg) => pg.id === layers.viewer) : undefined;
  return (
    <div className={`terr${empty ? " is-empty" : ""}${data || layers.years ? " has-sheet" : ""}`}>
      <TerritoryMap tiles={tiles} grade={grade} selected={data ? selected : null} onSelect={select} lit={lit} pointed={pointed} sheetOpen={!!data} api={api} />
      <div className="terr-hud" aria-hidden={viewerPage ? true : undefined}>
        <div className="hud-tl">
          <div className="hud-brand">
            <h1 className="hud-title">{app.map.title}</h1>
            <button
              type="button"
              className={`hud-icon hud-menu${menu ? " is-on" : ""}`}
              aria-label={app.map.terr.menu}
              aria-expanded={menu}
              aria-controls="hud-menu"
              onClick={() => setMenu((m) => !m)}
              data-testid="hud-menu"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden focusable="false">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          {menu && (
            <div className="hud-menu-pop" id="hud-menu" role="menu" data-testid="hud-menu-pop">
              <button type="button" role="menuitem" onClick={props.onList} data-testid="map-to-list">
                {app.map.terr.list}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  setTour(null);
                  go(openYears(layers));
                }}
                data-testid="menu-year"
              >
                {app.map.terr.year.title}
              </button>
            </div>
          )}
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
        {!empty && !data && !layers.years && <SnapFab />}
      </div>
      {layers.years && (
        <YearSheet
          rows={yearRows}
          onClose={() => go(closeTop(layers))}
          onPick={(g) => {
            go(closeTop(layers));
            api.current?.flyToGrade(g);
          }}
        />
      )}
      {data && record && (
        <Sheet
          data={data}
          record={record}
          grade={grade}
          hidden={!!viewerPage}
          onClose={() => select(null)}
          onPick={(id) => select(id)}
          onOpenPage={(pageId) => go(openViewer(layers, pageId))}
          onTick={props.onTick}
          tour={tour !== null && hud.next[tour] === selected ? { i: tour + 1, n: hud.next.length, next: nextStep } : null}
        />
      )}
      {viewerPage && <PageViewer page={viewerPage} unitId={selected} onClose={() => go(closeTop(layers))} />}
    </div>
  );
}

/** Top-right card: one compact line (制覇 N / total of the child's grade, 要復習) + the whole-map 小・中・高 bars. */
function HudCard({ hud }: { hud: Hud }) {
  const t = app.map.terr;
  const review = hud.counts.review;
  return (
    <section className="hud-card" aria-label={t.hudLabel(hud.grade, hud.taken, hud.total, review)} data-testid="hud-card">
      <div className="hud-line">
        <span className="hud-t">{t.hudTitle(hud.grade)}</span>
        <span className="hud-n" data-testid="hud-taken">
          <b>{hud.taken}</b>
          <span> / {hud.total}</span>
        </span>
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

/** Bottom-left: a small 「凡例」 button; open, the strand legend + the four territory states. */
function Legend() {
  const t = app.map.terr;
  const [open, setOpen] = useState(false);
  return (
    <div className={`hud-legend-wrap${open ? " is-open" : ""}`}>
      {open && (
        <section className="hud-legend" id="map-legend" aria-label={t.legend} data-testid="map-legend">
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
      )}
      <button type="button" className="hud-legend-btn" aria-expanded={open} aria-controls="map-legend" onClick={() => setOpen((o) => !o)} data-testid="legend-toggle">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden focusable="false">
          <rect x="2" y="2.5" width="4" height="4" rx="1" />
          <rect x="2" y="9.5" width="4" height="4" rx="1" />
          <path d="M8.5 4.5h5.5M8.5 11.5h5.5" />
        </svg>
        {t.legend}
      </button>
    </div>
  );
}

/** 年度の記録: one row per school year; a row flies to that year's zone. */
function YearSheet({ rows, onClose, onPick }: { rows: YearRow[]; onClose: () => void; onPick: (g: Grade) => void }) {
  const y = app.map.terr.year;
  const t = app.map.terr;
  const any = rows.some((r) => r.pages > 0);
  return (
    <section className="sheet terr-sheet terr-year" role="dialog" aria-modal="false" aria-labelledby="year-title" data-testid="year-sheet">
      <div className="sheet-top">
        <h2 id="year-title" className="year-title">
          {y.title}
        </h2>
        <button type="button" className="sheet-close" onClick={onClose} aria-label={y.close}>
          ×
        </button>
      </div>
      <p className="year-note">{y.note}</p>
      <ol className="year-rows">
        {rows.map((r) => (
          <li key={r.year}>
            <button type="button" className="year-row" onClick={() => onPick(r.grade)} aria-label={y.go(r.year, r.grade, zoneName(r.grade))} data-testid="year-row" data-grade={r.grade}>
              <span className="yr-year">{y.label(r.year)}</span>
              <span className="yr-zone">
                <b>{zoneName(r.grade)}</b>
                <small>{r.grade}</small>
              </span>
              <span className="yr-bar" aria-hidden>
                <i style={{ width: `${r.total ? (r.taken / r.total) * 100 : 0}%` }} />
              </span>
              <span className="yr-num">{t.progress(r.taken, r.total)}</span>
              <span className={`yr-x${r.wrong > 0 ? " is-wrong" : ""}`}>{y.wrong(r.wrong)}</span>
              <span className="yr-go" aria-hidden>
                ›
              </span>
            </button>
          </li>
        ))}
      </ol>
      {!any && <p className="sheet-none">{y.empty}</p>}
    </section>
  );
}

/** Half height of the unit sheet (share of the window) and the drag thresholds. */
const SHEET_HALF = 0.56;
const DRAG_UP = 40;
const DRAG_DOWN = 60;

/**
 * The unit sheet = layer 3 (record: state, counts, もとになる単元, history) + layer 4 (this unit's
 * problems, newest first, with marks, the 「復習した」 tick and the page photo). Half height by default
 * with the tile still visible above; drag the handle up for full height, down (or ✕ / Esc / a tap on the
 * map) to close. The body scrolls on its own and keeps its place while the page viewer is open.
 */
export function Sheet(props: {
  data: NonNullable<ReturnType<typeof sheetData>>;
  record: UnitSheet;
  grade: Grade;
  hidden: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
  onOpenPage: (pageId: string) => void;
  onTick: (pageId: string, index: number, checked: boolean) => void;
  tour: { i: number; n: number; next: () => void } | null;
}) {
  const { data, record, onClose, onPick, onOpenPage, tour } = props;
  const { unit, tile, roots } = data;
  const s = app.map.sheet;
  const t = app.map.terr;
  const history = record.history;
  const ref = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const probs = useRef<HTMLElement>(null);
  const [full, setFull] = useState(false);
  const [dragH, setDragH] = useState<number | null>(null);
  const [allHistory, setAllHistory] = useState(false);
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  useEffect(() => {
    body.current?.scrollTo?.({ top: 0 });
    setAllHistory(false);
  }, [unit.id]);

  const maxH = () => {
    const top = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 56;
    return window.innerHeight - Math.max(0, top) - 8;
  };
  const onGrabDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest("button:not(.sheet-grab)")) return;
    drag.current = { y: e.clientY, h: ref.current?.getBoundingClientRect().height ?? 0, moved: false };
  };
  const onGrabMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dy) < 6) return;
    if (!d.moved) (e.currentTarget as Element).setPointerCapture?.(e.pointerId); // a drag, not a tap on the handle
    d.moved = true;
    setDragH(Math.max(80, Math.min(maxH(), d.h - dy)));
  };
  const onGrabUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return;
    const dy = e.clientY - d.y;
    const h = d.h - dy;
    setDragH(null);
    if (dy < -DRAG_UP) setFull(true);
    else if (dy > DRAG_DOWN) {
      if (full && h >= window.innerHeight * SHEET_HALF * 0.6) setFull(false);
      else onClose();
    }
  };
  /** 「この単元の問題を見る」: full height, then the 問題 section at the top of the sheet. */
  const toProblems = () => {
    setFull(true);
    requestAnimationFrame(() => {
      const b = body.current;
      const sec = probs.current;
      if (b && sec) b.scrollTo({ top: Math.max(0, sec.offsetTop - 4), behavior: reduceMotion() ? "auto" : "smooth" });
    });
  };

  const rows = allHistory ? history : history.slice(0, HISTORY_ROWS);
  const nProblems = record.problems.length + record.nennotame.length;
  return (
    <section
      ref={ref}
      className={`sheet terr-sheet unit-sheet${full ? " is-full" : ""}${dragH !== null ? " is-drag" : ""}`}
      style={dragH !== null ? { height: `${dragH}px`, maxHeight: `${dragH}px` } : undefined}
      role="dialog"
      aria-modal="false"
      aria-labelledby="sheet-title"
      aria-hidden={props.hidden || undefined}
      inert={props.hidden || undefined}
      data-testid="star-sheet"
      data-size={full ? "full" : "half"}
    >
      <div className="sheet-head" onPointerDown={onGrabDown} onPointerMove={onGrabMove} onPointerUp={onGrabUp} onPointerCancel={onGrabUp}>
        <button
          type="button"
          className="sheet-grab"
          aria-label={full ? s.shrink : s.grow}
          aria-expanded={full}
          onClick={() => setFull((f) => !f)}
          data-testid="sheet-grab"
        />
        <div className="sheet-top">
          <div className="sheet-kicker">
            <span className="sheet-grade">{unit.appGrade}</span>
            <span className="sheet-code">{codeOf(unit)}</span>
            <span className="sheet-zone" data-testid="sheet-zone">{zoneName(unit.appGrade)}</span>
          </div>
          {tour && (
            <button type="button" className="btn btn-terr-next" onClick={tour.next} data-testid="tour-next">
              {t.nextOf(tour.i, tour.n)}
            </button>
          )}
          <button type="button" className="sheet-close" onClick={onClose} aria-label={s.close} data-testid="sheet-close">
            ×
          </button>
        </div>
        <h2 id="sheet-title" className="sheet-title">
          <TerrGlyph status={tile.status} color={colorKeyOf(unit)} size={34} />
          {unit.topic}
        </h2>
      </div>
      <div ref={body} className="sheet-body" data-testid="sheet-body">
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
        {nProblems > 0 && (
          <button type="button" className="sheet-to-probs" onClick={toProblems} data-testid="sheet-to-problems">
            {s.open}
            <span aria-hidden>↓</span>
          </button>
        )}
        <h3 className="sheet-h">{t.history}</h3>
        {history.length === 0 ? (
          <p className="sheet-none">{t.noHistory}</p>
        ) : (
          <ol className="sheet-history" data-testid="sheet-history">
            {rows.map((h) => (
              <li key={h.pageId}>
                <button type="button" className="hist-row" onClick={() => onOpenPage(h.pageId)} aria-label={s.historyOpen(h.date, h.type)} data-testid="hist-row" data-page={h.pageId}>
                  <span className="hist-date">{h.date}</span>
                  <span className="hist-type">{h.type}</span>
                  <span className={`hist-x${h.wrong > 0 ? " is-wrong" : ""}`}>{t.historyRow.wrong(h.wrong)}</span>
                  <span className="hist-o">{t.historyRow.ok(h.ok)}</span>
                  {h.none > 0 && <span className="hist-n">{t.historyRow.none(h.none)}</span>}
                  <span className="hist-go" aria-hidden>›</span>
                </button>
              </li>
            ))}
            {history.length > HISTORY_ROWS && !allHistory && (
              <li className="hist-more">
                <button type="button" className="link-btn" onClick={() => setAllHistory(true)}>
                  {s.historyAll(history.length - HISTORY_ROWS)}
                </button>
              </li>
            )}
          </ol>
        )}
        <section ref={probs} className="sheet-probs" aria-labelledby="sheet-probs-h" data-testid="sheet-problems">
          <h3 id="sheet-probs-h" className="sheet-h sheet-probs-h">
            {s.problems}
            {nProblems > 0 && <span className="sheet-probs-n">{s.problemsCount(nProblems)}</span>}
          </h3>
          {nProblems === 0 && <p className="sheet-none">{s.noProblems}</p>}
          {record.problems.length > 0 && (
            <ol className="unit-probs" data-testid="unit-problems">
              {record.problems.map((p) => (
                <UnitProblem key={p.key} p={p} onOpenPage={onOpenPage} onTick={props.onTick} />
              ))}
            </ol>
          )}
          {record.nennotame.length > 0 && (
            <div className="sheet-nennotame" data-testid="sheet-nennotame">
              <h4 className="sheet-nen-h">
                {s.nennotame}
                <span className="pill pill-gold">{s.problemsCount(record.nennotame.length)}</span>
              </h4>
              <p className="sheet-nen-note">{s.nennotameNote}</p>
              <ol className="unit-probs">
                {record.nennotame.map((p) => (
                  <UnitProblem key={p.key} p={p} onOpenPage={onOpenPage} onTick={props.onTick} />
                ))}
              </ol>
            </div>
          )}
        </section>
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
          <Link to={`/app/list?unit=${encodeURIComponent(unit.id)}`} className="sheet-link" data-testid="sheet-list">
            {s.toList}
          </Link>
          <Link to="/app/report" className="sheet-link" data-testid="sheet-report">
            {s.report}
          </Link>
        </div>
      </div>
    </section>
  );
}

/** One problem of the unit in the sheet: text (2 lines, expandable), answer, final mark + source, 正答（AI）, tick, photo. */
function UnitProblem({ p, onOpenPage, onTick }: { p: SheetProblem; onOpenPage: (pageId: string) => void; onTick: (pageId: string, index: number, checked: boolean) => void }) {
  const s = app.map.sheet;
  const [open, setOpen] = useState(false);
  // the text is clamped to two lines; 「続きを読む」 only when it really overflows
  const [long, setLong] = useState(false);
  const q = useRef<HTMLParagraphElement>(null);
  const pr = p.problem;
  useLayoutEffect(() => {
    const el = q.current;
    if (!el || open) return;
    // re-measured when the width changes (the thumbnail appears once its photo URL is ready)
    const measure = () => setLong(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [pr.q, open]);
  const mk = p.mark === "✕" ? "x" : p.mark === "○" ? "o" : "none";
  return (
    <li className={`up${p.reason ? " has-reason" : ""}${pr.reviewed ? " is-done" : ""}`} data-testid="unit-problem" data-mark={mk} data-source={p.source ?? ""}>
      <div className="up-main">
        <div className="up-meta">
          <span className="up-when">
            {p.date} {p.type}
          </span>
          <span>{s.problemNo(pr.n)}</span>
        </div>
        <p ref={q} className={`up-q${open ? " is-open" : ""}`}>
          {pr.q}
        </p>
        {long && (
          <button type="button" className="up-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? s.less : s.more}
          </button>
        )}
        <p className="up-a">
          {s.yourAnswer}：<span className="up-ans">{pr.answer || s.blank}</span>
        </p>
        <div className="up-mark">
          <span className={`pv-mark mk-${mk}`}>{p.mark ?? "—"}</span>
          <span className="up-src" data-testid="up-source">
            {p.sourceLabel || s.noMark}
          </span>
          {p.reason === "low" && <span className="pill pill-warn">{s.low}</span>}
        </div>
        {pr.correctAnswer && <p className="up-ai">{app.confirm.correctAnswer(pr.correctAnswer)}</p>}
        {p.reason && (
          <label className="check up-check">
            <input type="checkbox" checked={pr.reviewed} onChange={(e) => onTick(p.page.id, p.index, e.target.checked)} data-testid="up-tick" />
            <span>{app.list.reviewed}</span>
          </label>
        )}
      </div>
      {p.page.photo ? (
        <PhotoThumb photo={p.page.photo} alt={s.photoOpen(p.date, p.type, pr.n)} onOpen={() => onOpenPage(p.page.id)} />
      ) : (
        <button type="button" className="thumb thumb-none" onClick={() => onOpenPage(p.page.id)} aria-label={s.photoOpen(p.date, p.type, pr.n)} data-testid="photo-thumb">
          {s.noPhoto}
        </button>
      )}
    </li>
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
