// /lesson/:passId/:lens/master — Step 1 さわって学ぶ (WO-014): the 6-minute masterclass in 5 beats
// (わなとレンズ → 例題1 → 例題2 → 使えないとき → 練習のしかた), then the Step 3 round. Content from
// passes[].lessons[].masterclass, timings from tokens.motion.masterclass. Beats advance on tap only;
// the bar fills at target pace and never moves a beat on by itself.
import { hasScene, LensIcon, LensScene, loadBundle, tokens, type LensCard, type LensOrDirect, type Masterclass, type MasterclassToken } from '@lens/scenes';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { t } from '../i18n/ja';
import { lessonOpened } from '../launch/analytics';
import { CourseButtons } from './CaseView';
import { lessonOpen } from './access';
import { navigate } from '../launch/navigate';
import { Aha } from './Aha';
import { AttemptContext, useAttemptScope, type AttemptScope } from './attemptContext';
import { burst, sfx } from './fx';
import { GuideOverlay, GuideProvider, useGuide } from './guide';
import { findLesson, findPass } from './lessons';
import { barFill, boundaryHeading, captionsShown, clock, masterCards, masterToken, type MasterCards } from './masterclass';
import { PickCard, usePickClue } from './PickClue';
import { markMasterclassSeen } from './progress';
import { SCENES } from './scenes';
import { C, useCourseTheme, useFigScale } from './scenes/kit';
import { StepNav } from './StepNav';
import { clipFor, MuteButton, useVoiceSession, voice, VoiceCredit } from './voice';
import { TACTILE } from './fx';
import { WalkBoard } from './Walkthrough';

export function MasterView({ passId, lens }: { passId: string; lens: string }) {
  useCourseTheme();
  const pass = findPass(loadBundle(), passId);
  const lesson = pass && findLesson(pass, lens);
  const cards = lesson ? masterCards(lesson) : null;
  const m = masterToken();
  const [beat, setBeat] = useState(0);
  const startAt = useRef(performance.now());
  const beatAt = useRef(performance.now());
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  // The last beat reached: the case opens Step 2 from now on (Step 1 stays replayable).
  useEffect(() => {
    if (beat === m.beats.length - 1) markMasterclassSeen(passId, lens);
  }, [beat, m.beats.length, passId, lens]);
  const scope = useAttemptScope('lesson', passId);
  useVoiceSession();
  // WO-025: the masterclass opened.
  useEffect(() => {
    if (lesson) lessonOpened(passId, lens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passId, lens]);
  if (!lesson || !cards || !SCENES[lens]) return <main className="course">{t('lesson.notFound')}</main>;
  const next = () => {
    beatAt.current = performance.now();
    setNow(beatAt.current);
    setBeat((b) => b + 1);
    window.scrollTo?.(0, 0);
  };
  const id = m.beats[beat]!.id;
  return (
    <main className="course lesson master" style={{ ['--lens' as string]: C.lens(lens) }}>
      <div className="bar">
        <button type="button" className="back" aria-label={t('lesson.backLabel')} onClick={() => navigate(`/pass/${passId}`)}>
          {t('lesson.back')}
        </button>
        <StepNav passId={passId} lens={lens} current={1} />
        <MuteButton />
      </div>
      <MasterBar m={m} beat={beat} beatSec={(now - beatAt.current) / 1000} totalSec={(now - startAt.current) / 1000} />
      <h2 className="beat-title">
        <b>{m.beats[beat]!.ja}</b>
        {cards.mc.title[id]}
      </h2>
      <MasterBeat key={beat} beat={id} cards={cards} lens={lens} passId={passId} m={m} onNext={next} scope={scope} />
      <VoiceCredit />
    </main>
  );
}

/** The 5-segment bar (the 5th styled as 練習の準備) and 「m:ss / 6:00」. */
export function MasterBar({ m, beat, beatSec, totalSec }: { m: MasterclassToken; beat: number; beatSec: number; totalSec: number }) {
  const fill = barFill(beat, beatSec, m);
  return (
    <div className="mbar" role="progressbar" aria-label={t('master.label')} aria-valuemin={0} aria-valuemax={m.beats.length} aria-valuenow={beat + 1}>
      <div className="segs">
        {m.beats.map((b, i) => (
          <span key={b.id} className={`seg ${b.part}${i === beat ? ' cur' : ''}`} style={{ flexGrow: b.sec }} title={b.part === 'onboarding' ? t('master.prep') : b.ja}>
            <i style={{ width: `${fill[i]! * 100}%` }} />
          </span>
        ))}
      </div>
      <span className="mclock">{t('master.clock', { t: clock(totalSec), total: clock(m.total_sec) })}</span>
    </div>
  );
}

interface BeatProps {
  cards: MasterCards;
  lens: string;
  passId: string;
  m: MasterclassToken;
  onNext: () => void;
}

export function MasterBeat({ beat, scope, idle = false, ...p }: BeatProps & { beat: string; scope: AttemptScope | null; idle?: boolean }) {
  // Leaving the beat stops its voice.
  useEffect(() => () => voice.stop(), []);
  return (
    <IdleForced.Provider value={idle}>
      <BeatBody beat={beat} scope={scope} {...p} />
    </IdleForced.Provider>
  );
}

function BeatBody({ beat, scope, ...p }: BeatProps & { beat: string; scope: AttemptScope | null }) {
  const { cards } = p;
  const { mc } = cards;
  switch (beat) {
    case 'principle':
      return <Principle {...p} />;
    case 'example1':
      return <Example {...p} card={cards.example1} mode="scene" start={mc.say.example1} done={mc.say.example1_done} nextLabel={t('master.toExample2')} />;
    case 'example2':
      return <Example {...p} card={cards.example2} mode={mc.example2_mode} start={mc.say.example2} done={mc.say.example2_done} nextLabel={t('master.toBoundary')} />;
    case 'boundary':
      return <Boundary {...p} />;
    default:
      return (
        <AttemptContext.Provider value={scope}>
          <Onboarding {...p} />
        </AttemptContext.Provider>
      );
  }
}

/** The question, then the stage + side under one guide. */
function Shell({ card, lens, mc, onCoach, finger = false, children }: { card: LensCard; lens: string; mc: Masterclass; onCoach?: (phase: string) => void; finger?: boolean; children: (stage: RefObject<HTMLDivElement | null>) => ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);
  useFigScale(stage);
  // WO-022: each bubble plays its line's clip (when the bundle has one); other lines stop the last clip.
  const onSay = useCallback((text: string) => voice.say(clipFor(text, mc.say, mc.audio)), [mc]);
  return (
    <>
      <p className="qtext">{card.problem.text_ja}</p>
      <div className="main">
        <GuideProvider lens={lens} stageRef={stage} onCoach={onCoach} guaranteeFinger={finger} onSay={onSay}>
          {children(stage)}
        </GuideProvider>
      </div>
    </>
  );
}

/**
 * A card at rest: its figure at keyframe `kf`, or its sentence when it has no figure. A word problem's
 * figure leaves out the story (the sentence is printed just above); at its first keyframe nothing is
 * drawn yet, so a short prompt stands in for it.
 */
function Still({ card, kf = 0 }: { card: LensCard; kf?: number }) {
  if (!hasScene(card) || (card.animation?.keyframes.length ?? 0) === 0) return <p className="walk-text no-figure">{card.problem.text_ja}</p>;
  if (card.problem.figure.type === 'word_problem' && kf === 0) return <p className="walk-text no-figure">{t('drill.noFigure')}</p>;
  return <LensScene card={card} keyframe={kf} t={1} theme="short_dark" className="fig walkfig" hideStory />;
}

const say = (guide: ReturnType<typeof useGuide>, text: string, pose: 'q' | 'd' = 'q') => guide.say(text, pose);

/** For tests: render a beat as if the child had been idle (the one target pulses). */
const IdleForced = createContext(false);

/**
 * WO-022: after idle_ms with no touch, the beat's one next target pulses (`nudge`); a touch stops it and
 * re-arms. `target` names it (null: nothing to touch yet, or a drag scene whose knob the guide pulses).
 */
export function useIdleNudge(target: string | null): (name: string) => boolean {
  const forced = useContext(IdleForced);
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(false);
    if (!target) return;
    let id = window.setTimeout(() => setOn(true), TACTILE.idleMs);
    const touch = () => {
      setOn(false);
      window.clearTimeout(id);
      id = window.setTimeout(() => setOn(true), TACTILE.idleMs);
    };
    document.addEventListener('pointerdown', touch, { capture: true });
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('pointerdown', touch, { capture: true });
    };
  }, [target]);
  return (name) => (forced || on) && target === name;
}

// ---------- 1 わなとレンズ ----------

function Principle(p: BeatProps) {
  return <Shell card={p.cards.example1} lens={p.lens} mc={p.cards.mc}>{(stage) => <PrincipleIn {...p} stage={stage} />}</Shell>;
}

function PrincipleIn({ cards, m, onNext, stage }: BeatProps & { stage: RefObject<HTMLDivElement | null> }) {
  const guide = useGuide();
  const card = cards.example1;
  const trap = card.trap_route.steps;
  const kfs = card.animation?.keyframes.length ?? 0;
  const [lines, setLines] = useState(1);
  const [lensOn, setLensOn] = useState(false);
  const [kf, setKf] = useState(0);
  useEffect(() => say(guide, cards.mc.say.principle), []); // eslint-disable-line react-hooks/exhaustive-deps
  // The usual way, one line at a time; then the turn.
  useEffect(() => {
    if (lines >= trap.length) {
      say(guide, cards.mc.say.principle_turn);
      return;
    }
    const id = window.setTimeout(() => setLines((n) => n + 1), m.trap_line_stagger_ms);
    return () => window.clearTimeout(id);
  }, [lines]); // eslint-disable-line react-hooks/exhaustive-deps
  // The breakthrough preview: the lens keyframes once, quickly (not yet solved).
  useEffect(() => {
    if (!lensOn || kf >= kfs - 1) return;
    const id = window.setTimeout(() => setKf((k) => k + 1), m.lens_step_min_ms);
    return () => window.clearTimeout(id);
  }, [lensOn, kf, kfs, m.lens_step_min_ms]);
  const pulse = useIdleNudge(lensOn ? 'try' : lines >= trap.length ? 'lensLook' : null);
  const look = () => {
    sfx.snap();
    setLensOn(true);
    say(guide, cards.mc.say.principle_lens, 'd');
  };
  return (
    <>
      <div className="stage walk" ref={stage} data-card={card.id} data-beat="principle">
        <Still card={card} kf={kf} />
        <GuideOverlay />
      </div>
      <aside className="side">
        <div className="card trapbeat">
          <b>{t('walk.trapFailure')}</b>
          <ol>
            {trap.slice(0, lines).map((st, i) => (
              <li key={i} className="in">
                {st.ja}
              </li>
            ))}
          </ol>
          <div className="timeleft" style={{ animationDuration: `${trap.length * m.trap_line_stagger_ms}ms` }} />
        </div>
        {!lensOn && lines >= trap.length && (
          <button type="button" className={`go${pulse('lensLook') ? ' nudge' : ''}`} data-target="lensLook" onClick={look}>
            {t('master.lensLook')}
          </button>
        )}
        {lensOn && (
          <>
            {card.grounding && <div className="card idea in">{card.grounding.principle_ja}</div>}
            <button type="button" className={`go${pulse('try') ? ' nudge' : ''}`} data-target="try" onClick={() => (sfx.tap(), onNext())}>
              {t('master.try')}
            </button>
          </>
        )}
      </aside>
    </>
  );
}

// ---------- 2–3 例題 ----------

function Example(p: BeatProps & { card: LensCard; mode: Masterclass['example2_mode']; start: string; done: string; nextLabel: string }) {
  const [phases, setPhases] = useState<string[]>([]);
  const onCoach = useCallback((ph: string) => setPhases((xs) => (xs.includes(ph) ? xs : [...xs, ph])), []);
  return (
    <Shell card={p.card} lens={p.lens} mc={p.cards.mc} onCoach={onCoach} finger>
      {(stage) => (p.mode === 'scene' ? <SceneExample {...p} stage={stage} phases={phases.length} /> : <WalkExample {...p} stage={stage} />)}
    </Shell>
  );
}

type ExampleIn = BeatProps & { card: LensCard; start: string; done: string; nextLabel: string; stage: RefObject<HTMLDivElement | null> };

function useSolve({ card, lens, done, stage }: ExampleIn) {
  const guide = useGuide();
  const [solved, setSolved] = useState(false);
  const solve = useCallback(() => {
    setSolved(true);
    sfx.aha();
    if (stage.current) burst(stage.current, [C.lens(lens), ...C.palette, C.ink]);
    say(guide, done, 'd');
  }, [guide, stage, lens, done]);
  return { solved, solve, card };
}

function SceneExample(p: ExampleIn & { phases: number }) {
  const { card, lens, start, nextLabel, onNext, stage, phases } = p;
  const guide = useGuide();
  const { solved, solve } = useSolve(p);
  // Through a ref, so onSolved keeps its identity (scenes restart their timers when it changes).
  const solveRef = useRef(solve);
  solveRef.current = solve;
  const onSolved = useCallback(() => solveRef.current(), []);
  // After the scene's own coaching line (child effects run first): what this example is about.
  useEffect(() => say(guide, start), []); // eslint-disable-line react-hooks/exhaustive-deps
  // Before the snap the guide pulses the coached knob; after it, the next button.
  const pulse = useIdleNudge(solved ? 'next' : null);
  const Scene = SCENES[lens]!;
  const steps = card.lens_route.steps;
  const shown = captionsShown(card, phases, solved);
  return (
    <>
      <div className="stage" ref={stage} data-card={card.id} data-beat="example">
        <Scene card={card} lens={lens} onSolved={onSolved} />
        <GuideOverlay />
      </div>
      <aside className="side">
        <LensChip lens={lens} trigger={card.trigger.ja} />
        {/* No empty card before the first step is reached. */}
        {shown > 0 && (
          <ol className="card captions">
            {steps.slice(0, shown).map((st, i) => (
              <li key={i} className={`in${st.op === 'result' ? ' result' : ''}`}>
                {st.ja}
              </li>
            ))}
          </ol>
        )}
        {solved && <Aha card={card} last={false} onNext={onNext} onAgain={() => {}} listSteps={false} again={false} nextLabel={nextLabel} nudge={pulse('next')} />}
      </aside>
    </>
  );
}

function WalkExample(p: ExampleIn) {
  const { card, lens, start, nextLabel, onNext, stage } = p;
  const guide = useGuide();
  const { solved, solve } = useSolve(p);
  const steps = card.lens_route.steps;
  const result = Math.max(0, steps.findIndex((st) => st.op === 'result'));
  const [shown, setShown] = useState(0);
  // Before the result the guide pulses 「次へ」 (tap to reveal); after it, the next button.
  const [nudge, setNudge] = useState(0);
  const pulse = useIdleNudge(solved ? 'next' : null);
  useEffect(() => {
    say(guide, start);
    guide.idle(() => setNudge((n) => n + 1));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const advance = () => {
    if (shown >= steps.length) return;
    const n = shown + 1;
    setShown(n);
    sfx.tap();
    if (n === result + 1) {
      guide.idle(null);
      solve();
    }
  };
  const kfs = card.animation?.keyframes.length ?? 0;
  const kf = Math.round((shown / steps.length) * Math.max(0, kfs - 1));
  return (
    <>
      <div className="stage walk live" ref={stage} data-card={card.id} data-beat="example" data-mode="walkthrough" onClick={advance}>
        {/* The figure, or (steps-only cards) the problem's sentence, so the panel is never empty. */}
        <Still card={card} kf={kf} />
        <WalkBoard card={card} shown={shown} next={!solved} nudge={nudge} />
        <GuideOverlay />
      </div>
      <aside className="side">
        <LensChip lens={lens} trigger={card.trigger.ja} />
        {solved && <Aha card={card} last={false} onNext={onNext} onAgain={() => {}} listSteps={false} again={false} nextLabel={nextLabel} nudge={pulse('next')} />}
      </aside>
    </>
  );
}

function LensChip({ lens, trigger }: { lens: string; trigger?: string }) {
  const { labels } = loadBundle();
  return (
    <div className="card">
      <span className="chip" style={{ ['--lens' as string]: C.lens(lens) }}>
        <svg viewBox="0 0 24 24" aria-hidden>
          <LensIcon lens={lens as LensOrDirect} tokens={tokens} color={C.lens(lens)} />
        </svg>
        {labels.lenses[lens]?.ja ?? lens}
      </span>
      {trigger && <div className="trigger">{trigger}</div>}
    </div>
  );
}

// ---------- 4 使えないとき ----------

function Boundary(p: BeatProps) {
  return <Shell card={p.cards.boundary} lens={p.lens} mc={p.cards.mc}>{(stage) => <BoundaryIn {...p} stage={stage} />}</Shell>;
}

function BoundaryIn({ cards, onNext, stage }: BeatProps & { stage: RefObject<HTMLDivElement | null> }) {
  const guide = useGuide();
  const card = cards.boundary;
  const head = boundaryHeading(card);
  const pulse = useIdleNudge('got');
  useEffect(() => say(guide, cards.mc.say.boundary), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="stage walk" ref={stage} data-card={card.id} data-beat="boundary">
        <Still card={card} />
        <GuideOverlay />
      </div>
      <aside className="side">
        <div className="card boundary-beat">
          <h3>{head.kind === 'own' ? t('master.boundaryOwn') : t('master.boundaryOther')}</h3>
          {head.kind === 'other' && <LensChip lens={head.lens} />}
          <p className="boundary-line">{cards.mc.boundary_line}</p>
        </div>
        <button type="button" className={`go${pulse('got') ? ' nudge' : ''}`} data-target="got" onClick={() => (sfx.tap(), onNext())}>
          {t('master.got')}
        </button>
      </aside>
    </>
  );
}

// ---------- 5 練習のしかた ----------

function Onboarding(p: BeatProps) {
  return <Shell card={p.cards.try} lens={p.lens} mc={p.cards.mc}>{(stage) => <OnboardingIn {...p} stage={stage} />}</Shell>;
}

function OnboardingIn({ cards, passId, lens, m, stage }: BeatProps & { stage: RefObject<HTMLDivElement | null> }) {
  const { labels } = loadBundle();
  const guide = useGuide();
  const card = cards.try;
  const pc = usePickClue(card);
  const [tapped, setTapped] = useState<string[]>([]);
  const clues = cards.mc.clues;
  const ready = clues.every((c) => tapped.includes(c));
  const done = pc.s.phase !== 'pick';
  // The one next thing: the first clue chip not yet tapped, then the options (as one), then the start button.
  const nextClue = clues.find((c) => !tapped.includes(c));
  const pulse = useIdleNudge(!ready ? `clue:${nextClue}` : !done ? 'options' : 'start');
  // The real practice routine, with no hints: no glow, no ghost finger, only this beat's lines.
  useEffect(() => {
    guide.idle(null);
    if (done) say(guide, cards.mc.say.onboarding_done, 'd');
    else if (pc.s.tried.length === 0) say(guide, cards.mc.say.onboarding);
  }, [pc.s.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const tap = (c: string) => {
    if (tapped.includes(c)) return;
    sfx.snap();
    setTapped((xs) => [...xs, c]);
  };
  return (
    <>
      <div className="stage walk" ref={stage} data-card={card.id} data-beat="onboarding">
        <Still card={card} />
        <GuideOverlay />
      </div>
      <aside className="side">
        <div className="card how">
          <ol className="how-steps">
            <li className={ready ? 'ok' : 'cur'}>{t('master.how1')}</li>
            <li className={done ? 'ok' : ready ? 'cur' : ''}>{t('master.how2')}</li>
            <li>{t('master.how3')}</li>
          </ol>
          <b className="clues-label">{t('master.clues')}</b>
          <div className="chips">
            {clues.map((c) => (
              <button key={c} type="button" className={`cl${tapped.includes(c) ? ' yes' : ''}${pulse(`clue:${c}`) ? ' nudge' : ''}`} data-target={`clue:${c}`} onClick={() => tap(c)}>
                {labels.tags[c]?.ja ?? c}
              </button>
            ))}
          </div>
        </div>
        {ready && !done && <PickCard card={card} pc={pc} nudge={pulse('options')} />}
        {done &&
          (lessonOpen(passId, lens) ? (
            <button type="button" className={`go${pulse('start') ? ' nudge' : ''}`} data-target="start" onClick={() => (sfx.tap(), navigate(`/lesson/${passId}/${lens}/practice`))}>
              {t('master.start', { n: m.practice_round })}
            </button>
          ) : (
            // WO-027: a book reader's end card: the practice is in the book; the course has the rest.
            <div className="card book-end" data-target="start">
              <p className="why">{t('master.bookEnd')}</p>
              <p className="actions">
                <CourseButtons passId={passId} />
              </p>
            </div>
          ))}
      </aside>
    </>
  );
}
