import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PhotoThumb } from "../components/PhotoThumb";
import { app } from "../copy";
import { type Grade, type Unit, unitById, unitsForGrade } from "../curriculum";
import { type ListItem, parseLit, readiness, splitTestList } from "../lib/review";
import { setReviewed } from "../lib/store";
import { readPref, usePages, writePref } from "../state";

export function TestList({ grade }: { grade: Grade }) {
  const { pages, reload, setPages } = usePages();
  const [params] = useSearchParams();
  const key = `range:${grade}`;
  const [range, setRange] = useState<string[]>(() => {
    // ?units=5-C3,5-D2 (from the レポート) or ?unit=5-C3 (from the map) wins over the saved range.
    const many = parseLit(params.get("units"));
    if (many.length) return many;
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
  const { main, nennotame } = splitTestList(pages, range);
  const ready = readiness(pages, range);
  const toggle = (id: string) => setRange((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const onTick = async (item: ListItem, checked: boolean) => {
    // Optimistic: tick at once, then persist.
    setPages(
      pages.map((pg) =>
        pg.id !== item.page.id
          ? pg
          : { ...pg, problems: pg.problems.map((p, j) => (j === item.index ? { ...p, reviewed: checked } : p)) },
      ),
    );
    await setReviewed(item.page.id, item.index, checked).catch(() => reload());
  };

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
            <span className="muted small">{app.list.count(main.length)}</span>
          </div>
          {main.length === 0 && (
            <p className="notice notice-ok" data-testid="list-empty">
              {nennotame.length > 0 ? app.list.onlyNennotame : app.list.allDone}
            </p>
          )}
          <ul className="cards" data-testid="test-list">
            {main.map((item) => (
              <Item key={`${item.page.id}-${item.index}`} item={item} onTick={onTick} />
            ))}
          </ul>
          {nennotame.length > 0 && (
            <details className="nennotame" data-testid="nennotame">
              <summary>
                <span className="nennotame-title">{app.list.nennotame}</span>
                <span className="pill pill-gold">{app.list.count(nennotame.length)}</span>
              </summary>
              <p className="small muted nennotame-note">{app.list.nennotameNote}</p>
              <ul className="cards">
                {nennotame.map((item) => (
                  <Item key={`${item.page.id}-${item.index}`} item={item} onTick={onTick} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function Item({ item, onTick }: { item: ListItem; onTick: (item: ListItem, checked: boolean) => void }) {
  const { page, problem, reason } = item;
  return (
    <li className={`card review-item ${problem.reviewed ? "is-done" : ""}`} data-testid="review-item">
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
          <input type="checkbox" checked={problem.reviewed} onChange={(e) => onTick(item, e.target.checked)} />
          <span>{app.list.reviewed}</span>
        </label>
      </div>
      <PhotoThumb photo={page.photo} alt={`${app.confirm.problem(problem.n)}`} />
    </li>
  );
}
