import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { app } from "../copy";
import { type Grade, unitById } from "../curriculum";
import { type MapSection, type Tile, mapSections, parseLit, unfiled } from "../lib/review";
import { usePages } from "../state";

const TOAST_MS = 4500;

export function MapScreen({ grade }: { grade: Grade }) {
  const { pages } = usePages();
  const [params] = useSearchParams();
  const lit = useMemo(() => parseLit(params.get("lit")), [params]);
  const saved = Number(params.get("saved") ?? 0);

  // Open: the child's own grade, plus any grade that holds a unit lit by the last save.
  const [open, setOpen] = useState<Set<Grade>>(() => {
    const s = new Set<Grade>([grade]);
    for (const id of lit) {
      const u = unitById(id);
      if (u) s.add(u.appGrade);
    }
    return s;
  });
  const [toast, setToast] = useState(saved > 0);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  // Bring the first lit tile into view once the tiles are on screen.
  useEffect(() => {
    if (!pages || lit.length === 0) return;
    const el = document.querySelector(`[data-unit="${CSS.escape(lit[0])}"]`);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [pages, lit]);

  if (!pages) return <div className="page" />;
  const sections = mapSections(pages, grade);
  const nUnfiled = unfiled(pages);
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
    <div className="page">
      <h1>{app.map.title}</h1>
      <p className="muted">{app.map.body}</p>
      <div className="legend">
        <span><i className="dot dot-review" />{app.map.legend.review}</span>
        <span><i className="dot dot-ok" />{app.map.legend.ok}</span>
        <span><i className="dot dot-gold" />{app.map.legend.gold}</span>
        <span><i className="dot dot-empty" />{app.map.legend.empty}</span>
      </div>
      {nUnfiled > 0 && <p className="notice notice-warn">{app.map.unfiled(nUnfiled)}</p>}
      {sections.map((s) => (
        <Section key={s.grade} section={s} open={open.has(s.grade)} onToggle={toggle} lit={litSet} />
      ))}
      {toast && (
        <div className="toast" role="status" data-testid="lit-toast">
          {app.map.litToast(saved, lit.length > 0)}
        </div>
      )}
    </div>
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
