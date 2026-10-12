import {
  formatExact,
  getCard,
  LensIcon,
  LensScene,
  loadBundle,
  motionPreviewTimeline,
  tokens,
  withVariant,
  type LensCard,
  type LensOrDirect,
} from '@lens/scenes';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { initialPickerState, isCleanSolve, pickerReducer, showsHint, shuffle } from './picker';
import { loadRecord, saveRecord } from './storage';
import { useBeatClock } from './useBeatClock';

/** Fixed app copy (the card text itself always comes from the bundle). */
const COPY = {
  pickLens: 'どのレンズで見る？',
  hint: 'ヒント',
  tryAgain: 'もう一度えらぶ',
  cluePrompt: 'どこを見て、このレンズにした？',
  confirm: '決定',
  next: 'つぎの問題へ',
  variantTitle: '同じ型の問題',
  reportTitle: '時間の比べ',
  first: 'はじめの問題',
  seconds: '秒',
  preorder: '先行予約（¥6,800）',
  previous: '前回の記録',
  notFound: 'この問題は見つかりません',
} as const;
const PREORDER_URL = 'https://lens.beyondculture.ai/preorder';

/** Whole seconds, with tenths under 10 s. */
const secondsText = (s: number) => (s < 10 ? s.toFixed(1) : String(Math.round(s)));

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Play({ cardId }: { cardId: string }) {
  const card = getCard(cardId);
  if (!card) return <main className="play">{COPY.notFound}</main>;
  return <PlayCard card={card} />;
}

function PlayCard({ card }: { card: LensCard }) {
  const { labels } = loadBundle();
  const variant = useMemo(() => (card.variants[0] ? withVariant(card, card.variants[0]) : card), [card]);
  const reducedMotion = prefersReducedMotion();
  const startedAt = useRef(performance.now());
  const previous = useMemo(() => loadRecord(card.id), [card.id]);

  const [state, dispatch] = useReducer(pickerReducer, undefined, () => {
    const realTags = card.trigger.tags.filter((t) => !labels.tags[t]?.generic);
    return initialPickerState({
      options: shuffle(card.picker.options, Math.random),
      correct: card.picker.correct,
      realTags,
      chips: shuffle([...realTags, ...card.picker.clue_distractors], Math.random),
    });
  });

  // Reveal: the approved study-pace walkthrough from the lens activating, then the steps one by one.
  const beats = useMemo(() => motionPreviewTimeline(card, tokens), [card]);
  const from = beats ? beats.findIndex((b) => b.name === 'lens_activate') : 0;
  const clock = useBeatClock(beats, Math.max(0, from), state.phase === 'reveal', reducedMotion);
  const [stepsShown, setStepsShown] = useState(0);
  useEffect(() => {
    if (state.phase !== 'reveal' || !clock.done) return;
    const steps = card.lens_route.steps.length;
    if (reducedMotion) {
      setStepsShown(steps);
      return;
    }
    if (stepsShown >= steps) return;
    const id = window.setTimeout(() => setStepsShown((n) => n + 1), tokens.motion.study.equation_term_ms);
    return () => window.clearTimeout(id);
  }, [state.phase, clock.done, stepsShown, card, reducedMotion]);

  useEffect(() => {
    if (state.phase !== 'report' || state.seconds === null) return;
    saveRecord({
      cardId: card.id,
      attempts: state.attempts,
      misses: state.misses,
      seconds: state.seconds,
      clueCorrect: isCleanSolve(state),
      variantSeconds: state.variantSeconds ?? undefined,
    });
  }, [state, card.id]);

  const optionButtons = (greyed: string[], onPick: (o: string) => void) => (
    <div className="options">
      {state.options.map((opt) => (
        <button key={opt} type="button" className="option" disabled={greyed.includes(opt)} onClick={() => onPick(opt)}>
          <svg viewBox="0 0 24 24" width={28} height={28} aria-hidden>
            <LensIcon lens={opt as LensOrDirect} tokens={tokens} />
          </svg>
          {labels.lenses[opt]?.ja ?? opt}
        </button>
      ))}
    </div>
  );

  const showVariant = state.phase === 'variant';
  const figureCard = showVariant ? variant : card;

  return (
    <main className={`play phase-${state.phase}${reducedMotion ? ' reduced' : ''}`}>
      <section className="figure">
        {state.phase === 'reveal' && beats ? (
          <LensScene card={card} keyframe={clock.index} t={clock.t} motion={beats} lensLabel={labels.lenses[card.lens]?.ja} reducedMotion={reducedMotion} />
        ) : (
          <LensScene card={figureCard} keyframe={0} t={1} />
        )}
      </section>

      <section className="panel">
        {state.phase !== 'report' && <p className="problem">{figureCard.problem.text_ja}</p>}

        {state.phase === 'problem' && (
          <>
            {previous && (
              <p className="previous">
                {COPY.previous}: {secondsText(previous.seconds)}
                {COPY.seconds}
              </p>
            )}
            <h2>{COPY.pickLens}</h2>
            {optionButtons(state.greyed, (o) => dispatch({ type: 'pick', option: o, at: performance.now(), startedAt: startedAt.current }))}
            {showsHint(state) && (
              <p className="hint">
                <strong>{COPY.hint}</strong> {card.trigger.ja}
              </p>
            )}
          </>
        )}

        {state.phase === 'feedback' && state.feedbackFor && (
          <div className="feedback fade">
            <p>{card.picker.feedback_ja[state.feedbackFor]}</p>
            <button type="button" className="primary" onClick={() => dispatch({ type: 'dismissFeedback' })}>
              {COPY.tryAgain}
            </button>
          </div>
        )}

        {state.phase === 'clue' && (
          <div className="fade">
            <p className="praise">{card.picker.feedback_ja[card.picker.correct]}</p>
            <h2>{COPY.cluePrompt}</h2>
            <div className="chips">
              {state.chips.map((tag) => (
                <button key={tag} type="button" className={`chip${state.selected.includes(tag) ? ' on' : ''}`} aria-pressed={state.selected.includes(tag)} onClick={() => dispatch({ type: 'toggleChip', tag })}>
                  {labels.tags[tag]?.ja ?? tag}
                </button>
              ))}
            </div>
            <button type="button" className="primary" disabled={state.selected.length === 0} onClick={() => dispatch({ type: 'confirmClue' })}>
              {COPY.confirm}
            </button>
          </div>
        )}

        {state.phase === 'reveal' && (
          <div className="fade">
            {state.clueCorrect === false && (
              <p className="hint">
                <strong>{COPY.hint}</strong> {card.trigger.ja}
              </p>
            )}
            <ol className="steps">
              {card.lens_route.steps.slice(0, stepsShown).map((step, i) => (
                <li key={i} className="fade">
                  {step.ja}
                  {step.value !== undefined && step.op !== 'result' && <span className="value">{formatExact(step.value)}</span>}
                </li>
              ))}
            </ol>
            {stepsShown >= card.lens_route.steps.length && (
              <button type="button" className="primary" onClick={() => dispatch({ type: 'startVariant', at: performance.now(), options: shuffle(card.picker.options, Math.random) })}>
                {COPY.next}
              </button>
            )}
          </div>
        )}

        {state.phase === 'variant' && (
          <>
            <h2>{COPY.variantTitle}</h2>
            {optionButtons(state.variantGreyed, (o) => dispatch({ type: 'pickVariant', option: o, at: performance.now() }))}
          </>
        )}

        {state.phase === 'report' && state.seconds !== null && state.variantSeconds !== null && (
          <Report card={card} first={state.seconds} variant={state.variantSeconds} />
        )}
      </section>
    </main>
  );
}

function Report({ card, first, variant }: { card: LensCard; first: number; variant: number }) {
  const badge = tokens.time_cost.source_badge[card.lens_route.time_source];
  const max = Math.max(first, variant, 1);
  return (
    <div className="report fade">
      <h2>
        {COPY.reportTitle} <span className="badge">{badge}</span>
      </h2>
      <div className="bars">
        <Bar label={COPY.first} seconds={first} max={max} kind="first" />
        <Bar label={COPY.variantTitle} seconds={variant} max={max} kind="variant" />
      </div>
      <p className="trigger">{card.trigger.ja}</p>
      <a className="primary preorder" href={PREORDER_URL}>
        {COPY.preorder}
      </a>
    </div>
  );
}

function Bar({ label, seconds, max, kind }: { label: string; seconds: number; max: number; kind: 'first' | 'variant' }) {
  return (
    <div className={`bar ${kind}`}>
      <span className="bar-label">{label}</span>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: `${(seconds / max) * 100}%` }} />
      </span>
      <span className="bar-value">
        {secondsText(seconds)}
        {COPY.seconds}
      </span>
    </div>
  );
}
