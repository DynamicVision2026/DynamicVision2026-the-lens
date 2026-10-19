import { Link } from "react-router-dom";
import { app } from "../copy";
import type { Grade, Unit } from "../curriculum";
import { mapUnitUrl } from "../lib/home";
import { BAR_ORDER, CHIP_ORDER, type Report as ReportData, buildReport, listUrl } from "../lib/report";
import { usePages } from "../state";

const r = app.report;

/**
 * 学習レポート: the 単元マップ's 「詳しく」 page (light theme). Every unit opens its star on the map;
 * 「テスト前リストで見る」 goes to the list.
 */
export function Report({ grade }: { grade: Grade }) {
  const { pages } = usePages();
  if (!pages) return <div className="page" />;
  if (pages.length === 0) return <EmptyReport grade={grade} />;
  const data = buildReport(pages, grade);
  return (
    <div className="page report" data-testid="report">
      <BackToMap />
      <h1 className="report-title">{r.title(grade)}</h1>
      <p className="report-meta">{r.meta(dateOf(data.lastAt), data.pages)}</p>
      <Glance data={data} />
      <Next data={data} />
      {data.earlier.length > 0 && <Earlier data={data} />}
      <Week data={data} />
      <Chips data={data} />
      <Link to="/app/map" className="report-more">
        {r.toMap} <span aria-hidden>›</span>
      </Link>
    </div>
  );
}

function BackToMap() {
  return (
    <Link to="/app/map" className="report-back" data-testid="report-back">
      <span aria-hidden>‹ </span>
      {r.backToMap}
    </Link>
  );
}

function dateOf(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return app.backup.date(d.getMonth() + 1, d.getDate());
}

function Glance({ data }: { data: ReportData }) {
  const shown = BAR_ORDER.filter((s) => data.counts[s] > 0);
  const summary = `${r.of(data.total)} ${shown.map((s) => `${r.state[s]} ${data.counts[s]}`).join(" ・ ")}`;
  return (
    <section className="card glance" aria-labelledby="glance-h">
      <h2 id="glance-h" className="sr-only">{r.barLabel}</h2>
      <div className="glance-bar" role="img" aria-label={summary} data-testid="glance-bar">
        {shown.map((s) => (
          <span key={s} className={`gb gb-${s}`} style={{ flexGrow: data.counts[s] }} data-state={s} />
        ))}
      </div>
      <p className="glance-sum" data-testid="glance-sum" aria-hidden>
        <span className="glance-of">{r.of(data.total)}</span>
        {shown.map((s) => (
          <span key={s} className="glance-item">
            <i className={`sw sw-${s}`} />
            {r.state[s]} <b>{data.counts[s]}</b>
          </span>
        ))}
      </p>
    </section>
  );
}

function Next({ data }: { data: ReportData }) {
  return (
    <section className="card report-card" aria-labelledby="next-h" data-testid="report-next">
      <h2 id="next-h" className="report-h">{r.next}</h2>
      {data.next.length === 0 ? (
        <p className="report-none">{r.noNext}</p>
      ) : (
        <>
          <ul className="report-rows">
            {data.next.map((n) => (
              <li key={n.unit.id}>
                <Link to={mapUnitUrl(n.unit.id)} className="report-row report-link" data-unit={n.unit.id}>
                  <span className="report-unit">{n.unit.topic}</span>
                  <span className="pill pill-wrong-soft">{r.wrong(n.wrong)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link to={listUrl(data.next.map((n) => n.unit.id))} className="btn btn-primary btn-block" data-testid="report-open-list">
            {r.openList}
          </Link>
        </>
      )}
    </section>
  );
}

function Earlier({ data }: { data: ReportData }) {
  return (
    <section className="card report-card" aria-labelledby="earlier-h" data-testid="report-earlier">
      <h2 id="earlier-h" className="report-h">{r.earlier}</h2>
      <p className="report-sub">{r.earlierBody}</p>
      <ul className="report-rows">
        {data.earlier.map((e) => (
          <li key={e.unit.id}>
            <Link to={mapUnitUrl(e.unit.id)} className="report-row report-link" data-unit={e.unit.id}>
              <span className="report-unit">
                <span className="report-grade">{e.unit.appGrade}</span>
                {e.unit.topic}
                {e.supports && <span className="report-supports">→ {r.supports(e.supports.appGrade, e.supports.topic)}</span>}
              </span>
              <span className="pill pill-wrong-soft">{r.wrong(e.wrong)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Week({ data }: { data: ReportData }) {
  const items: [string, number][] = [
    [r.weekPages, data.week.pages],
    [r.weekProblems, data.week.problems],
    [r.weekWrong, data.week.wrong],
  ];
  return (
    <section className="report-week" aria-labelledby="week-h" data-testid="report-week">
      <h2 id="week-h" className="report-h">{r.week}</h2>
      <dl className="week-grid">
        {items.map(([label, n]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{n}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Chips({ data }: { data: ReportData }) {
  // Red units already shown in 次にやること are not repeated here (one-glance: no duplicates).
  const inNext = new Set(data.next.map((n) => n.unit.id));
  const chipsFor = (s: (typeof CHIP_ORDER)[number]) => (s === "review" ? data.chips[s].filter((u) => !inNext.has(u.id)) : data.chips[s]);
  const groups = CHIP_ORDER.filter((s) => chipsFor(s).length > 0);
  if (groups.length === 0) return null;
  return (
    <section className="report-chips" aria-label={r.units} data-testid="report-chips">
      {groups.map((s) => (
        <div key={s} className="chip-group" data-state={s}>
          <h3 className="chip-h">
            <i className={`sw sw-${s}`} />
            {r.state[s]}
          </h3>
          <div className="mini-chips">
            {chipsFor(s).map((u: Unit) => (
              <Link key={u.id} to={mapUnitUrl(u.id)} className={`mini-chip mc-${s}`} data-unit={u.id}>
                {u.topic}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function EmptyReport({ grade }: { grade: Grade }) {
  return (
    <div className="page report" data-testid="report-empty">
      <BackToMap />
      <h1 className="report-title">{r.title(grade)}</h1>
      <section className="card report-empty">
        <div className="glance-bar glance-bar-empty" aria-hidden>
          <span className="gb gb-empty" style={{ flexGrow: 1 }} />
        </div>
        <h2>{r.emptyTitle}</h2>
        <p>{r.emptyBody}</p>
        <ul className="report-empty-legend">
          {BAR_ORDER.map((s) => (
            <li key={s}>
              <i className={`sw sw-${s}`} />
              <b>{r.state[s]}</b>
              <span>{r.stateHint[s]}</span>
            </li>
          ))}
        </ul>
        <Link to="/app/snap" className="btn btn-accent btn-block">
          {r.emptyCta}
        </Link>
      </section>
    </div>
  );
}
