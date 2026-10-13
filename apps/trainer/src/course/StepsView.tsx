// Steps 3–4 of a lesson (/lesson/:passId/:lens/practice and …/timed). Step 3 ひとりで練習 plays the
// lesson's variants with no hints and counts clean problems in a row (3 = mastered). Step 4
// 時間をはかって確認 times a short set and keeps the record, so the child sees how much faster they got.
import { loadBundle } from '@lens/scenes';
import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n/ja';
import { navigate } from '../launch/navigate';
import { sfx } from './fx';
import { findLesson, findPass, lessonProblems } from './lessons';
import { Problem } from './LessonView';
import type { PlayResult } from './play';
import { applyPractice, fasterBy, MASTERY_STREAK, practiceQueue, summarizeTimed, timedSet, trapMinutes, type TimedItem, type TimedRun } from './practice';
import { masteryOf, saveMastery, saveTimedRun, timedRuns } from './progress';
import { SCENES } from './scenes';
import { C, useCourseTheme } from './scenes/kit';
import { StepNav } from './StepNav';

const seconds = (ms: number) => (ms / 1000).toFixed(1);

function useLesson(passId: string, lens: string) {
  const bundle = loadBundle();
  const pass = findPass(bundle, passId);
  const lesson = pass && findLesson(pass, lens);
  const problems = useMemo(() => (pass && lesson ? lessonProblems(pass, lesson) : []), [pass, lesson]);
  return { pass, lesson, problems };
}

export function PracticeView({ passId, lens }: { passId: string; lens: string }) {
  useCourseTheme();
  const { lesson, problems } = useLesson(passId, lens);
  const queue = useMemo(() => (lesson ? practiceQueue(problems, lesson) : []), [problems, lesson]);
  const [i, setI] = useState(0);
  const [m, setM] = useState(() => masteryOf(passId, lens));
  const [justMastered, setJustMastered] = useState(false);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const shownAt = useRef(performance.now());
  useEffect(() => {
    shownAt.current = performance.now();
    setLastMs(null);
  }, [i]);
  if (!lesson || queue.length === 0 || !SCENES[lens]) return <main className="course">{t('lesson.notFound')}</main>;
  const p = queue[i % queue.length]!;
  const onResult = ({ clean }: PlayResult) => {
    setLastMs(performance.now() - shownAt.current);
    const next = applyPractice(m, clean);
    saveMastery(next);
    if (!m.done && next.done) setJustMastered(true);
    setM(next);
  };
  return (
    <main className="course lesson practice" style={{ ['--lens' as string]: C.lens(lens) }}>
      <div className="bar">
        <button type="button" className="back" aria-label={t('lesson.backLabel')} onClick={() => navigate(`/pass/${passId}`)}>
          {t('lesson.back')}
        </button>
        <StepNav passId={passId} lens={lens} current={3} />
        <span className="streak" aria-label={t('practice.streak', { n: m.streak, m: MASTERY_STREAK })}>
          {Array.from({ length: MASTERY_STREAK }, (_, k) => (
            <i key={k} className={k < Math.min(m.streak, MASTERY_STREAK) ? 'on' : ''} />
          ))}
          {lastMs !== null && <b>{t('practice.time', { s: seconds(lastMs) })}</b>}
        </span>
      </div>
      {(justMastered || m.done) && (
        <div className={`mastered${justMastered ? ' in' : ''}`}>
          <span>★ {t('practice.mastered')}</span>
          <button type="button" className="go" onClick={() => (sfx.tap(), navigate(`/lesson/${passId}/${lens}/timed`))}>
            {t('practice.toTimed')}
          </button>
        </div>
      )}
      <Problem
        key={`${p.card.id}-${i}`}
        card={p.card}
        mode={p.mode}
        lens={lens}
        passId={passId}
        last={false}
        onNext={() => setI(i + 1)}
        onAgain={() => setI(i + 1)}
        opts={{ practice: true, record: false, onResult, again: false, nextLabel: t('practice.next') }}
      />
    </main>
  );
}

export function TimedView({ passId, lens }: { passId: string; lens: string }) {
  useCourseTheme();
  const { lesson, problems } = useLesson(passId, lens);
  const [round, setRound] = useState(0);
  const set = useMemo(() => (lesson ? timedSet(problems, lesson) : []), [problems, lesson, round]);
  const [i, setI] = useState(0);
  const [items, setItems] = useState<TimedItem[]>([]);
  const [run, setRun] = useState<{ run: TimedRun; previous?: TimedRun } | null>(null);
  const startAt = useRef(performance.now());
  const [now, setNow] = useState(0);
  const running = items.length === i && !run;
  useEffect(() => {
    startAt.current = performance.now();
    setNow(0);
  }, [i, round]);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(performance.now() - startAt.current), 100);
    return () => window.clearInterval(id);
  }, [running, i, round]);
  if (!lesson || set.length === 0 || !SCENES[lens]) return <main className="course">{t('lesson.notFound')}</main>;
  const p = set[Math.min(i, set.length - 1)]!;
  const onResult = ({ clean }: PlayResult) => {
    const ms = performance.now() - startAt.current;
    setNow(ms);
    setItems((xs) => [...xs, { cardId: p.card.id, text: p.card.problem.text_ja, ms, clean, trapSec: p.card.trap_route.time_cost_sec ?? null }]);
  };
  const finish = (all: TimedItem[]) => {
    const r = summarizeTimed(all);
    const previous = timedRuns(passId, lens)[0];
    saveTimedRun(passId, lens, r);
    setRun({ run: r, previous });
  };
  const again = () => {
    setItems([]);
    setRun(null);
    setI(0);
    setRound(round + 1);
  };
  return (
    <main className="course lesson timed" style={{ ['--lens' as string]: C.lens(lens) }}>
      <div className="bar">
        <button type="button" className="back" aria-label={t('lesson.backLabel')} onClick={() => navigate(`/pass/${passId}`)}>
          {t('lesson.back')}
        </button>
        <StepNav passId={passId} lens={lens} current={4} />
        {!run && (
          <span className="clock">
            {t('timed.progress', { i: i + 1, n: set.length })} ⏱ {t('practice.time', { s: seconds(now) })}
          </span>
        )}
      </div>
      {run ? (
        <TimedResult items={items} run={run.run} previous={run.previous} onAgain={again} onCase={() => navigate(`/pass/${passId}`)} />
      ) : (
        <Problem
          key={`${round}-${p.card.id}-${i}`}
          card={p.card}
          mode={p.mode}
          lens={lens}
          passId={passId}
          last={i >= set.length - 1}
          onNext={() => (i >= set.length - 1 ? finish(items) : setI(i + 1))}
          onAgain={() => {}}
          opts={{ practice: true, record: false, onResult, again: false, nextLabel: i >= set.length - 1 ? t('timed.finish') : t('practice.next') }}
        />
      )}
    </main>
  );
}

function TimedResult({ items, run, previous, onAgain, onCase }: { items: TimedItem[]; run: TimedRun; previous?: TimedRun; onAgain: () => void; onCase: () => void }) {
  const diff = fasterBy(run, previous);
  return (
    <section className="card timed-result">
      <h2>{t('timed.resultTitle')}</h2>
      <div className="answer in">{t('timed.total', { s: seconds(run.totalMs) })}</div>
      <p className="why">
        {t('timed.clean', { c: run.clean, n: run.n })}
        {' ・ '}
        {diff === null ? t('timed.first') : diff >= 0 ? t('timed.faster', { s: diff }) : t('timed.slower', { s: -diff })}
      </p>
      <ol className="timed-items">
        {items.map((it) => {
          const min = trapMinutes(it.trapSec);
          return (
            <li key={it.cardId}>
              <span className="q">{it.text}</span>
              <b>{t('practice.time', { s: seconds(it.ms) })}</b>
              {it.clean ? <span className="ok">✓</span> : <span className="miss">△</span>}
              {min !== null && <span className="trap">{t('timed.trap', { m: min })}</span>}
            </li>
          );
        })}
      </ol>
      <button type="button" className="go" onClick={() => (sfx.tap(), onAgain())}>
        {t('timed.again')}
      </button>
      <button type="button" className="go ghost" onClick={() => (sfx.tap(), onCase())}>
        {t('lesson.toCase')}
      </button>
    </section>
  );
}
