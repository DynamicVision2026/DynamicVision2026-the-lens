// /lesson/:passId/:lens — the course player (WO-012): problem by problem, the child picks the lens
// (wrong picks "try on" their feedback), taps the clue, then moves the figure until it snaps,
// guided by ナゼホリ. Everything shown comes from the bundle.
import { answerText, getCard, LensIcon, loadBundle, tokens, type LensCard, type LensOrDirect } from '@lens/scenes';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { t } from '../i18n/ja';
import { navigate } from '../launch/navigate';
import { burst, sfx, TACTILE } from './fx';
import { flowReducer, initialFlow } from './flow';
import { GuideOverlay, GuideProvider, useGuide } from './guide';
import { findLesson, findPass, lessonProblems } from './lessons';
import { markSolved, solvedIn } from './progress';
import { SCENES } from './scenes';
import { C, SceneLock, useCourseTheme } from './scenes/kit';

/** Fisher–Yates with a given random source (tests pass a fixed one). */
export function shuffle<T>(xs: readonly T[], rand: () => number = Math.random): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function LessonView({ passId, lens }: { passId: string; lens: string }) {
  useCourseTheme();
  const bundle = loadBundle();
  const pass = findPass(bundle, passId);
  const lesson = pass && findLesson(pass, lens);
  const problems = useMemo(() => (pass && lesson ? lessonProblems(pass, lesson) : []), [pass, lesson]);
  const [index, setIndex] = useState(() => Math.min(solvedIn(passId, lens).length, Math.max(0, problems.length - 1)));
  const [round, setRound] = useState(0);
  if (!pass || !lesson || problems.length === 0 || !SCENES[lens]) return <main className="course">{t('lesson.notFound')}</main>;
  const card = problems[index]!;
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
            <i key={p.id} className={i === index ? 'cur' : solvedIn(passId, lens).includes(p.id) ? 'on' : ''} />
          ))}
        </span>
      </div>
      <Problem key={`${card.id}-${round}`} card={card} lens={lens} passId={passId} last={index >= problems.length - 1} onNext={next} onAgain={() => setRound(round + 1)} />
    </main>
  );
}

function Problem({ card, lens, passId, last, onNext, onAgain }: { card: LensCard; lens: string; passId: string; last: boolean; onNext: () => void; onAgain: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  return (
    <>
      <p className="qtext">{card.problem.text_ja}</p>
      <div className="main">
        <GuideProvider lens={lens} stageRef={stage}>
          <Flow card={card} lens={lens} passId={passId} last={last} onNext={onNext} onAgain={onAgain} stage={stage} />
        </GuideProvider>
      </div>
    </>
  );
}

function Flow({ card, lens, passId, last, onNext, onAgain, stage }: { card: LensCard; lens: string; passId: string; last: boolean; onNext: () => void; onAgain: () => void; stage: React.RefObject<HTMLDivElement | null> }) {
  const { labels } = loadBundle();
  const guide = useGuide();
  const [s, dispatch] = useReducer(flowReducer, card.picker.correct, initialFlow);
  const options = useMemo(() => shuffle(card.picker.options), [card]);
  const chips = useMemo(() => {
    const real = card.trigger.tags.filter((tag) => !labels.tags[tag]?.generic);
    return shuffle([...real.map((tag) => ({ tag, real: true })), ...card.picker.clue_distractors.map((tag) => ({ tag, real: false }))]);
  }, [card, labels]);
  const [glow, setGlow] = useState(0);
  const Scene = SCENES[lens]!;
  const parent = getCard(card.id.replace(/-v\d+$/, '')) ?? card;
  const lensName = labels.lenses[lens]?.ja ?? lens;

  // Pick and clue: the guide asks, and the idle prompt glows the options/chips.
  useEffect(() => {
    if (s.phase === 'pick') {
      guide.say(t('guide.pick'));
      guide.idle(() => setGlow((g) => g + 1));
    }
    if (s.phase === 'clue') {
      guide.say(t('guide.clue'));
      guide.idle(() => setGlow((g) => g + 1));
    }
    if (s.phase === 'aha') guide.idle(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase]);

  // A right clue lights up, then the figure unlocks.
  useEffect(() => {
    if (s.phase !== 'clue' || !s.clueChip) return;
    const go = window.setTimeout(() => dispatch({ type: 'play' }), 700);
    return () => window.clearTimeout(go);
  }, [s.phase, s.clueChip]);
  const phase = s.phase;

  const solved = useCallback(() => {
    dispatch({ type: 'solved' });
    sfx.aha();
    if (stage.current) burst(stage.current, [C.lens(lens), ...C.palette, C.ink]);
    guide.say(t('guide.aha'), 'd');
    markSolved(passId, lens, card.id);
  }, [guide, stage, lens, passId, card.id]);

  const pick = (o: string) => {
    if (s.tried.includes(o) || s.phase !== 'pick') return;
    if (o === s.correct) {
      sfx.snap();
      guide.say(t('guide.pickRight'), 'd');
    } else {
      sfx.soft();
      guide.say(t('guide.pickWrong'));
    }
    dispatch({ type: 'pick', option: o });
  };

  const chip = (tag: string, real: boolean) => {
    if (s.clueChip || s.wrongChips.includes(tag)) return;
    if (real) {
      sfx.snap();
      guide.say(t('guide.clueRight'), 'd');
    } else sfx.soft();
    dispatch({ type: 'chip', tag, real });
  };

  const locked = phase === 'pick' || phase === 'clue';
  return (
    <>
      <div className="stage" ref={stage}>
        <SceneLock.Provider value={locked}>
          <Scene key={locked ? 'locked' : 'live'} card={card} lens={lens} onSolved={solved} />
        </SceneLock.Provider>
        <GuideOverlay />
      </div>
      <aside className="side">
        {phase === 'pick' && (
          <div className="card">
            <h2>{t('lesson.pickTitle')}</h2>
            {parent.trap_route.steps[0] && (
              <div className="trap">
                {t('lesson.trapLead')}
                {parent.trap_route.steps[0].ja}
              </div>
            )}
            <div className="opts">
              {options.map((o) => (
                <button key={`${o}-${glow}`} type="button" className={`opt${s.tried.includes(o) ? ' tried' : ''}${s.tryOn === o ? ' shake' : ''}${glow && !s.tried.includes(o) ? ' nudge' : ''}`} onClick={() => pick(o)}>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <LensIcon lens={o as LensOrDirect} tokens={tokens} color={C.lens(o)} />
                  </svg>
                  <span>{labels.lenses[o]?.ja ?? o}</span>
                </button>
              ))}
            </div>
            {s.tryOn && (
              <div className="try" key={s.tryOn}>
                <b>{t('lesson.tryOn', { lens: labels.lenses[s.tryOn]?.ja ?? s.tryOn })}</b>
                <br />
                {card.picker.feedback_ja[s.tryOn]}
              </div>
            )}
          </div>
        )}
        {phase === 'clue' && (
          <div className="card">
            <h2>{t('lesson.clueTitle', { lens: lensName })}</h2>
            <div className="chips">
              {chips.map(({ tag, real }) => (
                <button key={`${tag}-${glow}`} type="button" className={`cl${s.clueChip === tag ? ' yes' : ''}${s.wrongChips.includes(tag) ? ' no shake' : ''}${glow && !s.clueChip && !s.wrongChips.includes(tag) ? ' nudge' : ''}`} onClick={() => chip(tag, real)}>
                  {labels.tags[tag]?.ja ?? tag}
                </button>
              ))}
            </div>
            {(s.clueChip || s.wrongChips.length > 0) && <div className="why">{s.clueChip ? t('lesson.clueRight') : t('lesson.clueWrong')}</div>}
          </div>
        )}
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

function Aha({ card, last, onNext, onAgain }: { card: LensCard; last: boolean; onNext: () => void; onAgain: () => void }) {
  const steps = card.lens_route.steps;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= steps.length) return;
    const id = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 350 : TACTILE.stepStaggerMs);
    return () => window.clearTimeout(id);
  }, [shown, steps.length]);
  let sub = 0;
  return (
    <div className="card">
      <div className="answer in">{answerText(card)}</div>
      <ul className="steps">
        {steps.slice(0, shown).map((st, i) => (
          <li key={i} className="in">
            <i style={{ background: st.op === 'sub' ? C.palette[sub++ % 4] : 'var(--lens)' }} />
            <span>{st.ja}</span>
          </li>
        ))}
      </ul>
      {card.grounding && <div className="why">{card.grounding.principle_ja}</div>}
      {shown >= steps.length && (
        <>
          <button type="button" className="go" onClick={() => (sfx.tap(), onNext())}>
            {last ? t('lesson.toCase') : t('lesson.next')}
          </button>
          <button type="button" className="go ghost" onClick={() => (sfx.tap(), onAgain())}>
            {t('lesson.again')}
          </button>
        </>
      )}
    </div>
  );
}
