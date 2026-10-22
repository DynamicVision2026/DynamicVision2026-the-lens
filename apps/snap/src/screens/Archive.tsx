import { LangSwitch } from "../components/LangSwitch";
import { useState } from "react";
import { BackupCard } from "../components/BackupCard";
import { PhotoThumb } from "../components/PhotoThumb";
import { app, MISC } from "../copy";
import { unitById, gradeLabel } from "../curriculum";
import { deletePage } from "../lib/store";
import { usePlan } from "../lib/plan";
import { usePages } from "../state";
import { PlanChip } from "./PlanScreen";

type Period = keyof typeof app.archive.period;
const DAYS: Record<Period, number> = { all: Infinity, today: 1, week: 7, month: 30 };

export function Archive() {
  const { pages, reload } = usePages();
  const { plan } = usePlan();
  const [unit, setUnit] = useState("");
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [period, setPeriod] = useState<Period>("all");
  if (!pages) return <div className="page" />;

  const units = [...new Set(pages.flatMap((pg) => pg.problems.map((p) => p.unit).filter((u): u is string => !!u)))];
  const now = Date.now();
  const since = (d: string) => {
    if (period === "today") return new Date(d).toDateString() === new Date().toDateString();
    return now - new Date(d).getTime() <= DAYS[period] * 86400000;
  };
  const shown = pages
    .filter((pg) => since(pg.createdAt))
    .map((pg) => ({
      pg,
      problems: pg.problems.filter((p) => (!unit || p.unit === unit) && (!onlyWrong || p.mark === "✕")),
    }))
    .filter((x) => x.problems.length > 0 || (!unit && !onlyWrong));

  return (
    <div className="page page-archive">
      <div className="snap-head">
        <h1>{app.archive.title}</h1>
        <PlanChip plan={plan} />
      </div>
      <BackupCard pages={pages} onRestored={reload} />
      <div className="filters">
        <select className="select" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label={app.archive.allUnits}>
          <option value="">{app.archive.allUnits}</option>
          {units.map((id) => (
            <option key={id} value={id}>{gradeLabel(unitById(id)?.grade ?? "")} {unitById(id)?.label}</option>
          ))}
        </select>
        <select className="select" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
          {(Object.keys(app.archive.period) as Period[]).map((k) => (
            <option key={k} value={k}>{app.archive.period[k]}</option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} />
          <span>{app.archive.onlyWrong}</span>
        </label>
      </div>
      {shown.length === 0 && <p className="notice">{app.archive.empty}</p>}
      <ul className="cards">
        {shown.map(({ pg, problems }) => (
          <li key={pg.id} className="card">
            <div className="archive-head">
              <PhotoThumb photo={pg.photo} alt={app.pageType[pg.pageType]} />
              <div className="grow">
                <strong>{app.pageType[pg.pageType]}{pg.score ? MISC.points(pg.score) : ""}</strong>
                <div className="muted small">{app.archive.page(new Date(pg.createdAt).toLocaleDateString("ja-JP"), pg.problems.length)}</div>
              </div>
            </div>
            <ul className="mini-list">
              {problems.map((p) => (
                <li key={p.n} className={p.mark === "✕" ? "is-wrong" : ""}>
                  <span className="mini-mark">{p.mark ?? "・"}</span>
                  <span className="mini-q">{p.q}</span>
                  <span className="muted small">{unitById(p.unit)?.unit ?? "—"}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-danger-ghost btn-block"
              onClick={async () => {
                if (!window.confirm(app.archive.confirmDelete)) return;
                await deletePage(pg.id);
                await reload();
              }}
            >
              {app.archive.delete}
            </button>
          </li>
        ))}
      </ul>
      <div className="lang-row lang-row-end">
        <LangSwitch />
      </div>
    </div>
  );
}
