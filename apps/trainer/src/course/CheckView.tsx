// /check — 「どのレンズ？」 (WO-013): 8 problems, one per lens, mixed order. /drill/:passId is the paid
// week-4 mixed drill in the same mode: 10 problems (8 lenses + 2 boundary cards), scored on pick + clue.
// /check: 8 problems, one per lens, mixed order. The child picks the lens
// and the clue; no solving. Each first pick is timed. Then the result for the parent, the email form,
// the X share and the founder offer. Nothing leaves the device unless the parent submits the email
// form (tags: free-check + top confusion) or taps the X share (score and average seconds only).
import { hasScene, LensScene, loadBundle, type LensCard } from '@lens/scenes';
import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n/ja';
import { Footer, Preorder } from '../launch/Landing';
import { LAUNCH } from '../launch.config';
import { Signup } from '../launch/Signup';
import { checkTags, xShareHref } from '../launch/tracking';
import { checkProblems, drillProblems, saveCheck, saveDrill, seconds, summarize, type CheckAnswer } from './check';
import { burst, sfx } from './fx';
import { GuideOverlay, GuideProvider, useGuide } from './guide';
import { findPass, problemMode } from './lessons';
import { navigate } from '../launch/navigate';
import { ClueCard, PickCard, usePickClue } from './PickClue';
import { firstTime } from './progress';
import { SCENES } from './scenes';
import { C, SceneLock, useCourseTheme, useFigScale } from './scenes/kit';

const PASS = 'chugaku_juken';

export function CheckView({ short, drill = false, passId = PASS }: { short: string | null; drill?: boolean; passId?: string }) {
  useCourseTheme();
  const pass = findPass(loadBundle(), passId);
  const [round, setRound] = useState(0);
  const problems = useMemo(() => (pass ? (drill ? drillProblems(pass) : checkProblems(pass)) : []), [pass, round, drill]);
  const [answers, setAnswers] = useState<CheckAnswer[]>([]);
  if (!pass || problems.length === 0) return <main className="course">{t('lesson.notFound')}</main>;
  const done = answers.length >= problems.length;
  const card = problems[Math.min(answers.length, problems.length - 1)]!;
  return (
    <main className="course check" style={{ ['--lens' as string]: C.lens('enclose') }}>
      <div className="bar">
        <span className="chip">{drill ? t('drill.title') : t('check.title')}</span>
        <span className="pdots">
          {problems.map((p, i) => (
            <i key={p.id} className={i === answers.length ? 'cur' : i < answers.length ? 'on' : ''} />
          ))}
        </span>
      </div>
      {done && drill ? (
        <DrillResult
          answers={answers}
          onAgain={() => {
            setAnswers([]);
            setRound(round + 1);
          }}
          onCase={() => navigate(`/pass/${passId}`)}
        />
      ) : done ? (
        <Result
          answers={answers}
          short={short}
          onAgain={() => {
            setAnswers([]);
            setRound(round + 1);
          }}
        />
      ) : (
        <CheckProblem key={`${round}-${card.id}`} card={card} first={answers.length === 0} onDone={(a) => setAnswers((xs) => [...xs, a])} />
      )}
    </main>
  );
}

function CheckProblem({ card, first, onDone }: { card: LensCard; first: boolean; onDone: (a: CheckAnswer) => void }) {
  const stage = useRef<HTMLDivElement>(null);
  useFigScale(stage);
  return (
    <>
      <p className="qtext">{card.problem.text_ja}</p>
      <div className="main">
        <GuideProvider lens="check" stageRef={stage}>
          <Steps card={card} first={first} stage={stage} onDone={onDone} />
        </GuideProvider>
      </div>
    </>
  );
}

function Steps({ card, first, stage, onDone }: { card: LensCard; first: boolean; stage: React.RefObject<HTMLDivElement | null>; onDone: (a: CheckAnswer) => void }) {
  const shown = useRef(performance.now());
  const firstPick = useRef<{ option: string; ms: number } | null>(null);
  const pc = usePickClue(card, (option) => {
    if (!firstPick.current) firstPick.current = { option, ms: performance.now() - shown.current };
  });
  const guide = useGuide();
  const right = card.picker.correct;
  const [hint] = useState(() => first && firstTime('check', 'pick'));

  // The real clue: a beat, then the next problem.
  useEffect(() => {
    if (!pc.s.clueChip) return;
    const id = window.setTimeout(() => {
      guide.idle(null);
      const fp = firstPick.current ?? { option: right, ms: 0 };
      onDone({ cardId: card.id, lens: right, firstPick: fp.option, ms: fp.ms, clue: pc.s.wrongChips.length === 0 });
    }, 700);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pc.s.clueChip]);

  return (
    <>
      <div className="stage" ref={stage}>
        <RestFigure card={card} />
        <GuideOverlay />
      </div>
      <aside className={`side${hint && pc.s.phase === 'pick' && pc.s.tried.length === 0 ? ' tap-hint' : ''}`}>
        {pc.s.phase === 'pick' && <PickCard card={card} pc={pc} />}
        {pc.s.phase === 'clue' && <ClueCard lens={right} pc={pc} />}
      </aside>
    </>
  );
}

/** The figure at rest: the locked scene, else the static diagram, else a note (steps-only cards have no figure). */
function RestFigure({ card }: { card: LensCard }) {
  const Scene = SCENES[card.lens];
  if (Scene && problemMode(card, card.lens) === 'scene')
    return (
      <SceneLock.Provider value={true}>
        <Scene card={card} lens={card.lens} onSolved={() => {}} />
      </SceneLock.Provider>
    );
  if (hasScene(card)) return <LensScene card={card} keyframe={0} t={1} theme="short_dark" className="fig" />;
  // The sentence is already above the stage; say why there is no figure instead of repeating it.
  return <p className="walk-text no-figure">{t('drill.noFigure')}</p>;
}

/** The drill's report for the parent: picks and clues, mix-ups (「そのまま計算」 included), time, a lens to revisit. */
function DrillResult({ answers, onAgain, onCase }: { answers: CheckAnswer[]; onAgain: () => void; onCase: () => void }) {
  const { labels } = loadBundle();
  const r = useMemo(() => summarize(answers), [answers]);
  const host = useRef<HTMLDivElement>(null);
  const name = (lens: string) => labels.lenses[lens]?.ja ?? lens;
  useEffect(() => {
    saveDrill(r, answers);
    sfx.aha();
    if (host.current) burst(host.current, [...C.palette, C.lens('enclose')]);
  }, [r, answers]);
  return (
    <div className="result" ref={host}>
      <section className="card score">
        <h2>{t('drill.resultTitle')}</h2>
        <div className="answer">{t('check.score', { n: r.correct, total: r.total })}</div>
        <p className="why">
          {t('drill.clean', { n: r.clean, total: r.total })}
          {' ・ '}
          {t('check.average', { s: seconds(r.averageMs) })}
        </p>
        {r.confusions.length > 0 && (
          <>
            <h3>{t('check.confusedTitle')}</h3>
            <ul className="confusions">
              {r.confusions.map(([rightLens, picked, n]) => (
                <li key={`${rightLens}-${picked}`}>
                  <b style={{ color: C.lens(rightLens) }}>{name(rightLens)}</b> ↔ <b style={{ color: C.lens(picked) }}>{name(picked)}</b>
                  {n > 1 && <span className="why"> ×{n}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
        {r.suggest && <p className="trigger">{t('drill.suggest', { lens: name(r.suggest) })}</p>}
        <div className="result-actions">
          <p className="why">{t('check.private')}</p>
          <button type="button" className="go ghost" onClick={onAgain}>
            {t('drill.again')}
          </button>
        </div>
        <button type="button" className="go" onClick={onCase}>
          {t('lesson.toCase')}
        </button>
      </section>
    </div>
  );
}

function Result({ answers, short, onAgain }: { answers: CheckAnswer[]; short: string | null; onAgain: () => void }) {
  const { labels } = loadBundle();
  const r = useMemo(() => summarize(answers), [answers]);
  const host = useRef<HTMLDivElement>(null);
  const name = (lens: string) => labels.lenses[lens]?.ja ?? lens;
  useEffect(() => {
    saveCheck(r, answers);
    sfx.aha();
    if (host.current) burst(host.current, [...C.palette, C.lens('enclose')]);
  }, [r, answers]);
  const share = xShareHref(t('check.shareText', { score: r.correct, sec: seconds(r.averageMs) }), LAUNCH.siteUrl || window.location.origin);
  return (
    <div className="result" ref={host}>
      <section className="card score">
        <h2>{t('check.resultTitle')}</h2>
        <div className="answer">{t('check.score', { n: r.correct, total: r.total })}</div>
        <p className="why">{t('check.average', { s: seconds(r.averageMs) })}</p>
        {r.confusions.length > 0 && (
          <>
            <h3>{t('check.confusedTitle')}</h3>
            <ul className="confusions">
              {r.confusions.map(([right, picked, n]) => (
                <li key={`${right}-${picked}`}>
                  <b style={{ color: C.lens(right) }}>{name(right)}</b> ↔ <b style={{ color: C.lens(picked) }}>{name(picked)}</b>
                  {n > 1 && <span className="why"> ×{n}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
        {r.suggest && <p className="trigger">{t('check.suggest', { lens: name(r.suggest) })}</p>}
        <div className="result-actions">
          <p className="why">{t('check.private')}</p>
          <button type="button" className="go ghost" onClick={onAgain}>
            {t('check.again')}
          </button>
        </div>
      </section>
      <Signup short={short} title={t('check.emailTitle')} tags={checkTags(r.confusions[0], short)} stay />
      <div className="share-x">
        <a className="go ghost" href={share} target="_blank" rel="noopener">
          {t('check.shareX')}
        </a>
      </div>
      <Preorder />
      <Footer />
    </div>
  );
}
