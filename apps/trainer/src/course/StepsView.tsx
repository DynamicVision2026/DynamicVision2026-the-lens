// Steps 3–4 of a lesson (/lesson/:passId/:lens/practice and …/timed). Step 3 ひとりで練習 plays the
// lesson's variants with no hints in rounds of 5 (WO-014) and counts clean problems in a row (3 = mastered). Step 4
// 時間をはかって確認 times a short set and keeps the record, so the child sees how much faster they got.
import { loadBundle } from '@lens/scenes';
import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n/ja';
import { navigate } from '../launch/navigate';
import { sfx } from './fx';
import { findLesson, findPass, lessonProblems } from './lessons';
import { Problem } from './LessonView';
import { AttemptContext, useAttemptScope } from './attemptContext';
import type { PlayResult } from './play';
import { applyPractice, fasterBy, MASTERY_STREAK, practiceQueue, summarizeTimed, timedSet, trapMinutes, type TimedItem, type TimedRun } from './practice';
import { masterToken, withoutMasterCards } from './masterclass';
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
  // WO-014: never the masterclass's own example1, example2 or try cards.
  const queue = useMemo(() => (lesson ? withoutMasterCards(practiceQueue(problems, lesson), lesson) : []), [problems, lesson]);
  const roundN = masterToken().practice_round;
  const [i, setI] = useState(0);
  // The round of 5 (WO-014): where it started in the queue, and each problem's clean / not clean.
  const [roundAt, setRoundAt] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [roundDone, setRoundDone] = useState(false);
  const [m, setM] = useState(() => masteryOf(passId, lens));
  const [justMastered, setJustMastered] = useState(false);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const shownAt = useRef(performance.now());
  useEffect(() => {
    shownAt.current = performance.now();
    setLastMs(null);
  }, [i]);
  const scope = useAttemptScope('lesson', passId);
  if (!lesson || queue.length === 0 || !SCENES[lens]) return <main className="course">{t('lesson.notFound')}</main>;
  const p = queue[i % queue.length]!;
  const k = i - roundAt;
  const lastOfRound = k >= roundN - 1;
  const onResult = ({ clean }: PlayResult) => {
    setLastMs(performance.now() - shownAt.current);
    setResults((xs) => [...xs, clean]);
    const next = applyPractice(m, clean);
    saveMastery(next);
    if (!m.done && next.done) setJustMastered(true);
    setM(next);
  };
  const next = () => {
    if (lastOfRound) setRoundDone(true);
    setI(i + 1);
  };
  const again = () => {
    setRoundAt(i);
    setResults([]);
    setRoundDone(false);
  };
  return (
    <AttemptContext.Provider value={scope}>
    <main className="course lesson practice" style={{ ['--lens' as string]: C.lens(lens) }}>
      <div className="bar">
        <button type="button" className="back" aria-label={t('lesson.backLabel')} onClick={() => navigate(`/pass/${passId}`)}>
          {t('lesson.back')}
        </button>
        <StepNav passId={passId} lens={lens} current={3} />
        <span className="streak" aria-label={t('practice.streak', { n: m.streak, m: MASTERY_STREAK })}>
          {!roundDone && <b className="round">{t('practice.round', { i: k + 1, n: roundN })}</b>}
          {Array.from({ length: MASTERY_STREAK }, (_, j) => (
            <i key={j} className={j < Math.min(m.streak, MASTERY_STREAK) ? 'on' : ''} />
          ))}
          {lastMs !== null && !roundDone && <b>{t('practice.time', { s: seconds(lastMs) })}</b>}
        </span>
      </div>
      {(justMastered || m.done) && !roundDone && (
        <div className={`mastered${justMastered ? ' in' : ''}`}>
          <span>★ {t('practice.mastered')}</span>
          <button type="button" className="go" onClick={() => (sfx.tap(), navigate(`/lesson/${passId}/${lens}/timed`))}>
            {t('practice.toTimed')}
          </button>
        </div>
      )}
      {roundDone ? (
        <section className="card round-result">
          <h2>{t('practice.roundTitle')}</h2>
          <p className="why">{t('practice.roundClean')}</p>
          <div className="answer in">{t('practice.roundCount', { c: results.filter(Boolean).length, n: results.length })}</div>
          <p className="round-marks">
            {results.map((c, j) => (
              <span key={j} className={c ? 'ok' : 'miss'}>
                {c ? '✓' : '△'}
              </span>
            ))}
          </p>
          {m.done && <p className="why">★ {t('practice.mastered')}</p>}
          <button type="button" className="go" onClick={() => (sfx.tap(), again())}>
            {t('practice.roundAgain')}
          </button>
          <button type="button" className="go ghost" onClick={() => (sfx.tap(), navigate(`/lesson/${passId}/${lens}/timed`))}>
            {t('practice.roundTimed')}
          </button>
        </section>
      ) : (
        <Problem
          key={`${p.card.id}-${i}`}
          card={p.card}
          mode={p.mode}
          lens={lens}
          passId={passId}
          last={false}
          onNext={next}
          onAgain={next}
          opts={{ practice: true, record: false, onResult, again: false, nextLabel: lastOfRound ? t('practice.toResult') : t('practice.next') }}
        />
      )}
    </main>
    </AttemptContext.Provider>
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
  const scope = useAttemptScope('timer', passId, round);
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
    <AttemptContext.Provider value={scope}>
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
    </AttemptContext.Provider>
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
