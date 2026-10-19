import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { StarGlyph, StarMap } from "../components/StarMap";
import { app } from "../copy";
import { type Grade, type Unit, unitById } from "../curriculum";
import { type MapSection, type Tile, type TileStatus, mapSections, mapTiles, parseLit, unfiled } from "../lib/review";
import { type SkyLayout, gradeCounts, nearGrades, sheetData } from "../lib/starmap";
import { readPref, usePages, writePref } from "../state";

const TOAST_MS = 4500;
type View = "sky" | "list";
const STATES: TileStatus[] = ["review", "ok", "gold", "empty"];

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const codeOf = (u: Unit) => (u.level === "高" ? `${u.grade} ${u.unit}` : u.unit);

export function MapScreen({ grade }: { grade: Grade }) {
  const { pages } = usePages();
  const [params] = useSearchParams();
  const lit = useMemo(() => parseLit(params.get("lit")), [params]);
  const saved = Number(params.get("saved") ?? 0);
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

  if (!pages) return <div className={`page${view === "sky" ? " sky-page" : ""}`} />;
  const tiles = mapTiles(pages);
  const nUnfiled = unfiled(pages);

  return (
    <div className={`page${view === "sky" ? " sky-page" : ""}`} data-view={view}>
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
      {view === "sky" ? <SkyHeader tiles={tiles} grade={grade} /> : <ListHeader />}
      {nUnfiled > 0 && <p className="notice notice-warn">{app.map.unfiled(nUnfiled)}</p>}
      {view === "sky" ? <SkyView tiles={tiles} grade={grade} lit={lit} /> : <ListView pages={pages} grade={grade} lit={lit} />}
      {toast && (
        <div className="toast toast-row" role="status">
          <span data-testid="lit-toast">{app.map.litToast(saved, lit.length > 0)}</span>
          <Link to="/app/report" className="toast-link" data-testid="toast-report">
            {app.map.toReport}
          </Link>
        </div>
      )}
    </div>
  );
}

// ---------- 星図 ----------

function SkyHeader({ tiles, grade }: { tiles: Tile[]; grade: Grade }) {
  const c = gradeCounts(tiles, grade);
  return (
    <>
      <p className="sky-body">{app.map.skyBody}</p>
      <div className="sky-legend">
        {STATES.map((s) => (
          <span key={s}>
            <StarGlyph status={s} size={26} />
            {app.map.skyLegend[s]}
          </span>
        ))}
      </div>
      <p className="sky-summary" data-testid="sky-summary">
        <b>{app.map.gradeSummary(grade)}</b>
        {STATES.map((s) => (
          <span key={s} className={`sum-${s}`}>{app.map.count[s](c[s])}</span>
        ))}
      </p>
    </>
  );
}

function SkyView({ tiles, grade, lit }: { tiles: Tile[]; grade: Grade; lit: string[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  // One far band may be opened. After 保存, a lit unit in a far grade opens that grade.
  const [opened, setOpened] = useState<Grade | null>(() => {
    const base = nearGrades(grade);
    for (const id of lit) {
      const g = unitById(id)?.appGrade;
      if (g && !base.has(g)) return g;
    }
    return null;
  });
  const near = useMemo(() => nearGrades(grade, opened), [grade, opened]);
  const geo = useRef<{ L: SkyLayout; canvas: HTMLDivElement } | null>(null);
  const scrolled = useRef(false);
  const pending = useRef<string | null>(null); // star to scroll to once its band is laid out
  const pendingBand = useRef<Grade | null>(null); // band just opened: bring it into view

  /** Scroll so a star sits at `at` (0 = top, 1 = bottom) of the visible screen. */
  const scrollToStar = useCallback((id: string, at: number, smooth: boolean) => {
    const g = geo.current;
    const n = g?.L.byId.get(id);
    if (!g || !n) return;
    const top = g.canvas.getBoundingClientRect().top + window.scrollY + n.cy;
    window.scrollTo({ top: Math.max(0, top - window.innerHeight * at), behavior: smooth && !reduceMotion() ? "smooth" : "instant" });
  }, []);

  const onLayout = useCallback(
    (L: SkyLayout, canvas: HTMLDivElement) => {
      geo.current = { L, canvas };
      if (pendingBand.current) {
        const band = L.bands.find((b) => b.grade === pendingBand.current);
        pendingBand.current = null;
        if (band) {
          const top = canvas.getBoundingClientRect().top + window.scrollY + band.y;
          window.scrollTo({ top: Math.max(0, top - 100), behavior: "instant" });
        }
        return;
      }
      if (pending.current && L.byId.get(pending.current)?.far === false) {
        const id = pending.current;
        pending.current = null;
        scrollToStar(id, 0.16, true);
        return;
      }
      if (scrolled.current) return;
      scrolled.current = true;
      // On load: the first lit star (after 保存) in the middle, otherwise the child's grade band in view.
      if (lit.length > 0) return scrollToStar(lit[0], 0.5, false);
      const band = L.bands.find((b) => b.grade === grade);
      if (band) {
        const top = canvas.getBoundingClientRect().top + window.scrollY + band.y;
        window.scrollTo({ top: Math.max(0, top - window.innerHeight * 0.3), behavior: "instant" });
      }
    },
    [lit, grade, scrollToStar],
  );

  const select = useCallback(
    (id: string | null, fromSheet = false) => {
      setSelected(id);
      if (!id) return;
      const g = unitById(id)?.appGrade;
      if (g && !near.has(g)) {
        // A root in the far sky: open its band, then scroll once it is laid out.
        pending.current = id;
        setOpened(g);
        return;
      }
      const geoNow = geo.current;
      const n = geoNow?.L.byId.get(id);
      if (!geoNow || !n) return;
      const y = geoNow.canvas.getBoundingClientRect().top + n.cy;
      // Keep the star (and the roots below it) above the sheet.
      if (fromSheet || y > window.innerHeight * 0.25 || y < 90) scrollToStar(id, 0.16, true);
    },
    [near, scrollToStar],
  );

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const data = selected ? sheetData(selected, tiles) : null;
  return (
    <>
      <StarMap
        tiles={tiles}
        grade={grade}
        near={near}
        opened={opened}
        onOpen={(g) => {
          setSelected(null);
          pendingBand.current = g;
          setOpened(g);
        }}
        lit={lit}
        selected={selected}
        onSelect={(id) => select(id)}
        onLayout={onLayout}
      />
      {data && <Sheet data={data} onClose={() => setSelected(null)} onPick={(id) => select(id, true)} />}
      {data && <div className="sheet-spacer" aria-hidden />}
    </>
  );
}

function Sheet({ data, onClose, onPick }: { data: NonNullable<ReturnType<typeof sheetData>>; onClose: () => void; onPick: (id: string) => void }) {
  const { unit, tile, roots } = data;
  const s = app.map.sheet;
  return (
    <section className="sheet" role="dialog" aria-modal="false" aria-labelledby="sheet-title" data-testid="star-sheet">
      <div className="sheet-top">
        <div className="sheet-kicker">
          <span className="sheet-grade">{unit.appGrade}</span>
          <span className="sheet-code">{codeOf(unit)}</span>
        </div>
        <button type="button" className="sheet-close" onClick={onClose} aria-label={s.close}>
          ×
        </button>
      </div>
      <h2 id="sheet-title" className="sheet-title">
        <StarGlyph status={tile.status} size={34} />
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
          <dd className={`sum-${tile.status}`}>{app.map.skyLegend[tile.status]}</dd>
        </div>
      </dl>
      <h3 className="sheet-h">{s.roots}</h3>
      {roots.length === 0 ? (
        <p className="sheet-none">{s.noRoots}</p>
      ) : (
        <ul className="sheet-roots">
          {roots.map((r) => (
            <li key={r.unit.id}>
              <button type="button" className="root-btn" onClick={() => onPick(r.unit.id)} data-unit={r.unit.id}>
                <StarGlyph status={r.status} size={30} />
                <span className="root-grade">{r.unit.appGrade}</span>
                <span className="root-topic">{r.unit.topic}</span>
                <span className="root-go" aria-hidden>›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Link to={`/app/list?unit=${encodeURIComponent(unit.id)}`} className="btn btn-sky btn-block">
        {s.open}
      </Link>
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
      <Tiles tiles={tiles} showSubject={grade === "高校"} lit={props.lit} />
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
