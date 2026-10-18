import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PhotoThumb } from "../components/PhotoThumb";
import { app } from "../copy";
import { type Grade, type Unit, unitById, unitsForGrade } from "../curriculum";
import { readiness, testList } from "../lib/review";
import { setReviewed } from "../lib/store";
import { readPref, usePages, writePref } from "../state";

export function TestList({ grade }: { grade: Grade }) {
  const { pages, reload, setPages } = usePages();
  const [params] = useSearchParams();
  const key = `range:${grade}`;
  const [range, setRange] = useState<string[]>(() => {
    const fromUrl = params.get("unit");
    if (fromUrl) return [fromUrl];
    try {
      return JSON.parse(readPref(key) ?? "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => writePref(key, JSON.stringify(range)), [key, range]);

  const choices: Unit[] = useMemo(() => {
    const own = unitsForGrade(grade);
    const ids = new Set(own.map((u) => u.id));
    const extra = new Set<string>(range.filter((id) => !ids.has(id)));
    for (const pg of pages ?? []) for (const p of pg.problems) if (p.unit && !ids.has(p.unit)) extra.add(p.unit);
    return [...own, ...[...extra].map((id) => unitById(id)).filter((u): u is Unit => !!u)];
  }, [grade, pages, range]);

  if (!pages) return <div className="page" />;
  const items = testList(pages, range);
  const ready = readiness(pages, range);
  const toggle = (id: string) => setRange((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

  return (
    <div className="page">
      <h1>{app.list.title}</h1>
      <p className="muted">{app.list.body}</p>
      <div className="chips" role="group">
        {choices.map((u) => (
          <button
            key={u.id}
            type="button"
            className={`chip ${range.includes(u.id) ? "is-on" : ""}`}
            aria-pressed={range.includes(u.id)}
            data-unit={u.id}
            onClick={() => toggle(u.id)}
          >
            {u.appGrade !== grade ? `${u.grade} ` : ""}
            {u.label}
          </button>
        ))}
      </div>

      {range.length === 0 ? (
        <p className="notice">{app.list.chooseUnits}</p>
      ) : ready === null ? (
        <p className="notice">{app.list.noData}</p>
      ) : (
        <>
          <div className="readiness" aria-label={app.list.readiness}>
            <div className="readiness-top">
              <span>{app.list.readiness}</span>
              <strong data-testid="readiness">{ready}%</strong>
            </div>
            <div className="bar"><div className="bar-fill" style={{ width: `${ready}%` }} /></div>
            <span className="muted small">{app.list.count(items.length)}</span>
          </div>
          {items.length === 0 && <p className="notice notice-ok">{app.list.allDone}</p>}
          <ul className="cards" data-testid="test-list">
            {items.map(({ page, problem, index, reason }) => (
              <li key={`${page.id}-${index}`} className={`card review-item ${problem.reviewed ? "is-done" : ""}`} data-testid="review-item">
                <div className="review-main">
                  <div className="row gap">
                    <span className={`pill ${reason === "wrong" ? "pill-wrong" : "pill-warn"}`}>
                      {reason === "wrong" ? app.list.wrong : app.list.low}
                    </span>
                    <span className="muted small">{unitById(problem.unit)?.label}</span>
                  </div>
                  <p className="problem-q">{problem.q}</p>
                  {problem.answer && (
                    <p className="small muted">{app.list.yourAnswer}：<span className="answer">{problem.answer}</span></p>
                  )}
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={problem.reviewed}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        // Optimistic: tick at once, then persist.
                        setPages(
                          pages.map((pg) =>
                            pg.id !== page.id
                              ? pg
                              : { ...pg, problems: pg.problems.map((p, j) => (j === index ? { ...p, reviewed: checked } : p)) },
                          ),
                        );
                        await setReviewed(page.id, index, checked).catch(() => reload());
                      }}
                    />
                    <span>{app.list.reviewed}</span>
                  </label>
                </div>
                <PhotoThumb photo={page.photo} alt={`${app.confirm.problem(problem.n)}`} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
