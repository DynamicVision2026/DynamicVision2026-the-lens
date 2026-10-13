// /check — 「どのレンズ？」 (WO-013): 8 problems, one per lens, mixed order. The child picks the lens
// and the clue; no solving. Each first pick is timed. Then the result for the parent, signup and the
// founder offer. Nothing leaves the device except what the parent submits in the signup form.
import { loadBundle, type LensCard } from '@lens/scenes';
import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n/ja';
import { Footer, Preorder } from '../launch/Landing';
import { Signup } from '../launch/Signup';
import { checkProblems, saveCheck, seconds, summarize, type CheckAnswer } from './check';
import { burst, sfx } from './fx';
import { GuideOverlay, GuideProvider, useGuide } from './guide';
import { findPass } from './lessons';
import { ClueCard, PickCard, usePickClue } from './PickClue';
import { firstTime } from './progress';
import { SCENES } from './scenes';
import { C, SceneLock, useCourseTheme } from './scenes/kit';

const PASS = 'chugaku_juken';

export function CheckView({ short }: { short: string | null }) {
  useCourseTheme();
  const pass = findPass(loadBundle(), PASS);
  const [round, setRound] = useState(0);
  const problems = useMemo(() => (pass ? checkProblems(pass) : []), [pass, round]);
  const [answers, setAnswers] = useState<CheckAnswer[]>([]);
  if (!pass || problems.length === 0) return <main className="course">{t('lesson.notFound')}</main>;
  const done = answers.length >= problems.length;
  const card = problems[Math.min(answers.length, problems.length - 1)]!;
  return (
    <main className="course check" style={{ ['--lens' as string]: C.lens('enclose') }}>
      <div className="bar">
        <span className="chip">{t('check.title')}</span>
        <span className="pdots">
          {problems.map((p, i) => (
            <i key={p.id} className={i === answers.length ? 'cur' : i < answers.length ? 'on' : ''} />
          ))}
        </span>
      </div>
      {done ? (
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
  const Scene = SCENES[card.lens];
  const [hint] = useState(() => first && firstTime('check', 'pick'));

  // The real clue: a beat, then the next problem.
  useEffect(() => {
    if (!pc.s.clueChip) return;
    const id = window.setTimeout(() => {
      guide.idle(null);
      const fp = firstPick.current ?? { option: card.lens, ms: 0 };
      onDone({ cardId: card.id, lens: card.lens, firstPick: fp.option, ms: fp.ms });
    }, 700);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pc.s.clueChip]);

  return (
    <>
      <div className="stage" ref={stage}>
        <SceneLock.Provider value={true}>{Scene && <Scene card={card} lens={card.lens} onSolved={() => {}} />}</SceneLock.Provider>
        <GuideOverlay />
      </div>
      <aside className={`side${hint && pc.s.phase === 'pick' && pc.s.tried.length === 0 ? ' tap-hint' : ''}`}>
        {pc.s.phase === 'pick' && <PickCard card={card} pc={pc} />}
        {pc.s.phase === 'clue' && <ClueCard lens={card.lens} pc={pc} />}
      </aside>
    </>
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
  const share = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(window.location.origin + '/')}`;
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
          <a className="go" href={share} target="_blank" rel="noopener">
            {t('check.shareLine')}
          </a>
          <button type="button" className="go ghost" onClick={onAgain}>
            {t('check.again')}
          </button>
        </div>
        <p className="why">{t('check.private')}</p>
      </section>
      <Signup short={short} />
      <Preorder />
      <Footer />
    </div>
  );
}
