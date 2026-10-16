// /report/:passId — the parent report (WO-019): day 1 vs week 4 from this child's own measurements,
// medians with both dates. No percentages of improvement, no projected minutes, no comparison with
// other children, no score words. Screenshot-friendly. Everything is read from this device only.
import { loadBundle } from '@lens/scenes';
import { useState } from 'react';
import { t } from '../i18n/ja';
import { BookLink } from '../launch/BookLink';
import { navigate } from '../launch/navigate';
import { baseline, clearAttempts, readAttempts, stats, week4, week4Open, weeklyCounts, type SessionStats } from './attempts';
import { sfx } from './fx';
import { findPass } from './lessons';
import { C, useCourseTheme } from './scenes/kit';

const sec = (ms: number) => (ms / 1000).toFixed(1);
const day = (iso: string) => new Date(iso).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });

export function ReportView({ passId }: { passId: string }) {
  useCourseTheme();
  const { labels } = loadBundle();
  const pass = findPass(loadBundle(), passId);
  const [all, setAll] = useState(() => readAttempts());
  if (!pass) return <main className="course">{t('lesson.notFound')}</main>;
  const base = baseline(all, passId);
  const wk = week4(all, passId);
  const b = base ? stats(base) : null;
  const w = wk ? stats(wk) : null;
  const name = (lens: string) => labels.lenses[lens]?.ja ?? lens;
  const clear = () => {
    if (!window.confirm(t('report.clearConfirm'))) return;
    clearAttempts();
    setAll([]);
  };
  return (
    <main className="course report" style={{ ['--lens' as string]: C.lens('enclose') }}>
      <div className="bar">
        <button type="button" className="back" aria-label={t('lesson.backLabel')} onClick={() => navigate(`/pass/${passId}`)}>
          {t('lesson.back')}
        </button>
        <span className="chip">{t('report.title')}</span>
      </div>
      <section className="card report-card">
        {!b ? (
          <>
            <p>{t('report.noBaseline')}</p>
            <button type="button" className="go" onClick={() => (sfx.tap(), navigate(`/baseline/${passId}`))}>
              {t('baseline.offer')}
            </button>
          </>
        ) : !w ? (
          <>
            <h2>{t('report.day1', { d: day(b.at) })}</h2>
            <dl className="rows">
              <dt>{t('report.rowSpeed')}</dt>
              <dd>{t('report.secs', { s: sec(b.medianMs) })}</dd>
              <dt>{t('report.rowOk')}</dt>
              <dd>{t('report.count', { n: b.ok, total: b.total })}</dd>
            </dl>
            <p className="why">{t('report.waitWeek4')}</p>
            <Weekly all={all} passId={passId} from={b.at} />
          </>
        ) : (
          <Compare b={b} w={w} name={name} lenses={pass.lessons.map((l) => l.lens)} all={all} passId={passId} />
        )}
        {b && !w && (
          <p className="parent-link">
            {week4Open(base) ? null : <span className="why">{t('report.week4When')} </span>}
            <button type="button" className="linkish" onClick={() => (sfx.tap(), navigate(`/week4/${passId}`))}>
              {t('report.measureNow')}
            </button>
          </p>
        )}
        {/* Once week 4 is in, the unlock line goes; a re-measure gets its own line (Architect, #74). */}
        {b && w && (
          <p className="parent-link">
            <button type="button" className="linkish" onClick={() => (sfx.tap(), navigate(`/week4/${passId}`))}>
              {t('report.measureAgain')}
            </button>
          </p>
        )}
        <BookLink passId={passId} />
        <p className="why foot">{t('report.footer')}</p>
        <button type="button" className="linkish clear" onClick={clear}>
          {t('report.clear')}
        </button>
      </section>
    </main>
  );
}

function Compare({ b, w, name, lenses, all, passId }: { b: SessionStats; w: SessionStats; name: (l: string) => string; lenses: string[]; all: ReturnType<typeof readAttempts>; passId: string }) {
  const pairs = [...new Set([...Object.keys(b.confusions), ...Object.keys(w.confusions)])];
  return (
    <>
      <h2>{t('report.compareTitle', { d1: day(b.at), d4: day(w.at) })}</h2>
      <dl className="rows">
        <dt>{t('report.rowSpeed')}</dt>
        <dd>{t('report.speedThenNow', { a: sec(b.medianMs), b: sec(w.medianMs) })}</dd>
        <dt>{t('report.rowOk')}</dt>
        <dd>{t('report.okThenNow', { a: b.ok, at: b.total, b: w.ok, bt: w.total })}</dd>
        <dt>{t('report.rowConfusions')}</dt>
        <dd>
          {pairs.length === 0 ? (
            t('report.none')
          ) : (
            <ul className="pairs">
              {pairs.map((k) => {
                const [want, first] = k.split('→') as [string, string];
                return <li key={k}>{t('report.pair', { a: name(want), b: name(first), x: b.confusions[k] ?? 0, y: w.confusions[k] ?? 0 })}</li>;
              })}
            </ul>
          )}
        </dd>
      </dl>
      <h3>{t('report.rowLens')}</h3>
      <table className="per-lens">
        {/* ✓/✗ alone can read like a grade: the header says what it means (Architect, #74). */}
        <thead>
          <tr>
            <th rowSpan={2} />
            <th colSpan={2}>{t('report.then')}</th>
            <th colSpan={2}>{t('report.now')}</th>
          </tr>
          <tr className="sub">
            <th>{t('report.colTime')}</th>
            <th>{t('report.colRight')}</th>
            <th>{t('report.colTime')}</th>
            <th>{t('report.colRight')}</th>
          </tr>
        </thead>
        <tbody>
          {lenses.map((l) => {
            const x = b.perLens[l];
            const y = w.perLens[l];
            return (
              <tr key={l}>
                <th style={{ color: C.lens(l) }}>{name(l)}</th>
                <td>{x ? t('report.secs', { s: sec(x.ms) }) : '—'}</td>
                <td>{x ? (x.ok ? '✓' : '✗') : '—'}</td>
                <td>{y ? t('report.secs', { s: sec(y.ms) }) : '—'}</td>
                <td>{y ? (y.ok ? '✓' : '✗') : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Weekly all={all} passId={passId} from={b.at} />
    </>
  );
}

function Weekly({ all, passId, from }: { all: ReturnType<typeof readAttempts>; passId: string; from: string }) {
  const weeks = weeklyCounts(all, passId, from);
  return (
    <p className="weekly">
      <b>{t('report.rowPractice')}</b>
      {weeks.map((n, i) => t('report.week', { w: i + 1, n })).join(' · ')}
    </p>
  );
}
