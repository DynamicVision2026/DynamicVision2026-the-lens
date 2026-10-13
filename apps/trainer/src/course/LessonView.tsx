// /lesson/:passId/:lens — the course player (WO-012): problem by problem, the child picks the lens
// (wrong picks "try on" their feedback), taps the clue, then moves the figure until it snaps,
// guided by ナゼホリ. Everything shown comes from the bundle.
import { allSceneCards, getCard, LensIcon, loadBundle, tokens, type LensCard, type LensOrDirect } from '@lens/scenes';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n/ja';
import { navigate } from '../launch/navigate';
import { Aha } from './Aha';
import { burst, sfx } from './fx';
import { GuideOverlay, GuideProvider, useGuide } from './guide';
import { findLesson, findPass, isPlayable, lessonProblems, type LessonProblem, type ProblemMode } from './lessons';
import { markSolved, solvedIn } from './progress';
import { ClueCard, PickCard, usePickClue } from './PickClue';
import { SCENES } from './scenes';
import { C, SceneLock, useCourseTheme } from './scenes/kit';
import { boundaryChip, WalkFlow } from './Walkthrough';

export function LessonView({ passId, lens }: { passId: string; lens: string }) {
  useCourseTheme();
  const bundle = loadBundle();
  const pass = findPass(bundle, passId);
  const lesson = pass && findLesson(pass, lens);
  const problems = useMemo(() => (pass && lesson ? (oneCard(lens) ?? lessonProblems(pass, lesson)) : []), [pass, lesson, lens]);
  const [index, setIndex] = useState(() => Math.min(solvedIn(passId, lens).length, Math.max(0, problems.length - 1)));
  const [round, setRound] = useState(0);
  if (!pass || !lesson || problems.length === 0 || !SCENES[lens]) return <main className="course">{t('lesson.notFound')}</main>;
  const { card, mode } = problems[index]!;
  const chip = boundaryChip(card);
  const next = () => {
    if (index >= problems.length - 1) navigate(`/pass/${passId}`);
    else setIndex(index + 1);
  };
  return (
    <main className="course lesson" style={{ ['--lens' as string]: C.lens(lens) }}>
      <div className="bar">
        <button type="button" className="back" aria-label={t('lesson.backLabel')} onClick={() => navigate(`/pass/${passId}`)}>
          {t('lesson.back')}
        </button>
        <span className="pdots">
          {problems.map((p, i) => (
            <i key={p.card.id} className={i === index ? 'cur' : solvedIn(passId, lens).includes(p.card.id) ? 'on' : ''} />
          ))}
        </span>
        {chip && <span className="chip boundary">{chip}</span>}
      </div>
      <Problem key={`${card.id}-${round}`} card={card} mode={mode} lens={lens} passId={passId} last={index >= problems.length - 1} onNext={next} onAgain={() => setRound(round + 1)} />
    </main>
  );
}

/**
 * Review aid (the lesson is already behind ?preview=1 until launch): ?card=<id> plays just that card
 * or variant of this lens, so every variant can be checked, not only the lesson's first few.
 */
function oneCard(lens: string): LessonProblem[] | null {
  const id = new URLSearchParams(window.location.search).get('card');
  const card = id ? allSceneCards(loadBundle()).find((c) => c.id === id) : undefined;
  if (!card || card.lens !== lens) return null;
  return [{ card, mode: isPlayable(card, lens) ? 'scene' : 'walkthrough' }];
}

function Problem({ card, mode, lens, passId, last, onNext, onAgain }: { card: LensCard; mode: ProblemMode; lens: string; passId: string; last: boolean; onNext: () => void; onAgain: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  return (
    <>
      <p className="qtext">{card.problem.text_ja}</p>
      <div className="main">
        <GuideProvider lens={lens} stageRef={stage}>
          {mode === 'scene' ? (
            <Flow card={card} lens={lens} passId={passId} last={last} onNext={onNext} onAgain={onAgain} stage={stage} />
          ) : (
            <WalkFlow card={card} lens={lens} passId={passId} last={last} onNext={onNext} onAgain={onAgain} stage={stage} />
          )}
        </GuideProvider>
      </div>
    </>
  );
}

function Flow({ card, lens, passId, last, onNext, onAgain, stage }: { card: LensCard; lens: string; passId: string; last: boolean; onNext: () => void; onAgain: () => void; stage: React.RefObject<HTMLDivElement | null> }) {
  const { labels } = loadBundle();
  const guide = useGuide();
  const pc = usePickClue(card);
  const { s, dispatch } = pc;
  const Scene = SCENES[lens]!;
  const parent = getCard(card.id.replace(/-v\d+$/, '')) ?? card;
  const lensName = labels.lenses[lens]?.ja ?? lens;

  // A right clue lights up, then the figure unlocks.
  useEffect(() => {
    if (s.phase !== 'clue' || !s.clueChip) return;
    const go = window.setTimeout(() => dispatch({ type: 'play' }), 700);
    return () => window.clearTimeout(go);
  }, [s.phase, s.clueChip, dispatch]);
  const phase = s.phase;

  const solved = useCallback(() => {
    dispatch({ type: 'solved' });
    sfx.aha();
    if (stage.current) burst(stage.current, [C.lens(lens), ...C.palette, C.ink]);
    guide.say(t('guide.aha'), 'd');
    markSolved(passId, lens, card.id);
  }, [dispatch, guide, stage, lens, passId, card.id]);

  const locked = phase === 'pick' || phase === 'clue';
  return (
    <>
      <div className="stage" ref={stage} data-card={card.id}>
        <SceneLock.Provider value={locked}>
          <Scene key={locked ? 'locked' : 'live'} card={card} lens={lens} onSolved={solved} />
        </SceneLock.Provider>
        <GuideOverlay />
      </div>
      <aside className="side">
        {phase === 'pick' && <PickCard card={card} pc={pc} trap={parent.trap_route.steps[0]?.ja} />}
        {phase === 'clue' && <ClueCard lens={lens} pc={pc} />}
        {(phase === 'play' || phase === 'aha') && (
          <div className="card">
            <span className="chip">
              <svg viewBox="0 0 24 24" aria-hidden>
                <LensIcon lens={lens as LensOrDirect} tokens={tokens} color={C.lens(lens)} />
              </svg>
              {lensName}
            </span>
            <div className="trigger">{card.trigger.ja}</div>
          </div>
        )}
        {phase === 'aha' && <Aha card={card} last={last} onNext={onNext} onAgain={onAgain} />}
      </aside>
    </>
  );
}
