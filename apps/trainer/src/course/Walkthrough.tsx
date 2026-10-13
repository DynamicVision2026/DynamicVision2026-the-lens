// The walkthrough mode (WO-016) for problems without a drag interaction: failure and no-lens cards
// (when not to use the lens) and steps-only cards. Pick and clue as usual; then, for boundary cards,
// the trap beat (the habit's route, greyed, ending in ✕); then the lens route one tap at a time,
// with the aha on the result. The figure, when the card has one, shows static beside it.
import { getCard, hasScene, LensIcon, LensScene, loadBundle, tokens, type LensCard, type LensOrDirect } from '@lens/scenes';
import { useCallback, useEffect, useState } from 'react';
import { t } from '../i18n/ja';
import { Aha } from './Aha';
import { burst, sfx } from './fx';
import { GuideOverlay, useGuide } from './guide';
import { ClueCard, PickCard, usePickClue } from './PickClue';
import { markSolved } from './progress';
import { C } from './scenes/kit';

export const isBoundary = (card: LensCard) => card.kind === 'failure' || card.kind === 'no_lens';

/** The header chip for a boundary card, or null. */
export function boundaryChip(card: LensCard): string | null {
  if (card.kind === 'failure') return t('walk.chipFailure');
  if (card.kind === 'no_lens') return t('walk.chipNoLens');
  return null;
}

interface Props {
  card: LensCard;
  lens: string;
  passId: string;
  last: boolean;
  onNext: () => void;
  onAgain: () => void;
  stage: React.RefObject<HTMLDivElement | null>;
}

/** The trap beat (boundary cards) and the lens route revealed up to `shown` steps. Pure, for tests. */
export function WalkBoard({ card, shown, next, nudge = 0 }: { card: LensCard; shown: number; next: boolean; nudge?: number }) {
  const { labels } = loadBundle();
  const steps = card.lens_route.steps;
  const way = card.picker.correct;
  return (
    <div className="walk-board">
      {isBoundary(card) && (
        <div className="trapbeat">
          <b>{card.kind === 'no_lens' ? t('walk.trapNoLens') : t('walk.trapFailure')}</b>
          <ol>
            {card.trap_route.steps.map((st, i, all) => (
              <li key={i} className={i === all.length - 1 ? 'stop' : undefined}>
                {st.ja}
                {i === all.length - 1 && <span className="x" aria-label="✕">✕</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="reveal">
        <b>
          <svg viewBox="0 0 24 24" aria-hidden>
            <LensIcon lens={way as LensOrDirect} tokens={tokens} color={C.lens(way)} />
          </svg>
          {t('walk.way', { way: labels.lenses[way]?.ja ?? way })}
        </b>
        <ol>
          {steps.slice(0, shown).map((st, i) => (
            <li key={i} className={`in${st.op === 'result' ? ' result' : ''}`}>
              {st.ja}
            </li>
          ))}
        </ol>
        {next && shown < steps.length && (
          <button key={nudge} type="button" className={`go next${nudge ? ' nudge' : ''}`}>
            {t('walk.next')}
          </button>
        )}
      </div>
    </div>
  );
}

export function WalkFlow({ card, lens, passId, last, onNext, onAgain, stage }: Props) {
  const { labels } = loadBundle();
  const guide = useGuide();
  const pc = usePickClue(card);
  const { s, dispatch } = pc;
  const parent = getCard(card.id.replace(/-v\d+$/, '')) ?? card;
  const steps = card.lens_route.steps;
  const result = Math.max(0, steps.findIndex((st) => st.op === 'result'));
  const boundary = isBoundary(card);
  const way = card.picker.correct;
  const [shown, setShown] = useState(0);
  const [nudge, setNudge] = useState(0);
  const phase = s.phase;

  // A right clue lights up, then the walkthrough starts.
  useEffect(() => {
    if (phase !== 'clue' || !s.clueChip) return;
    const go = window.setTimeout(() => dispatch({ type: 'play' }), 700);
    return () => window.clearTimeout(go);
  }, [phase, s.clueChip, dispatch]);

  useEffect(() => {
    if (phase !== 'play') return;
    guide.say(boundary ? t('walk.stop') : t('walk.tap'), boundary ? 'q' : 'd');
    guide.idle(() => setNudge((n) => n + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const solved = useCallback(() => {
    dispatch({ type: 'solved' });
    guide.idle(null);
    sfx.aha();
    if (stage.current) burst(stage.current, [C.lens(lens), ...C.palette, C.ink]);
    guide.say(t('guide.aha'), 'd');
    markSolved(passId, lens, card.id);
  }, [dispatch, guide, stage, lens, passId, card.id]);

  // One tap, one step (the settle and the tick); the result step plays the aha.
  const advance = () => {
    if (phase !== 'play' || shown >= steps.length) return;
    const n = shown + 1;
    setShown(n);
    sfx.tap();
    if (n === 1 && boundary) guide.say(t('walk.tap'), 'd');
    if (n === result + 1) solved();
  };

  // The figure (when the card has one) follows the reveal through its keyframes.
  const keyframes = card.animation?.keyframes ?? [];
  const kf = phase === 'pick' || phase === 'clue' ? 0 : phase === 'aha' ? keyframes.length - 1 : Math.round((shown / steps.length) * (keyframes.length - 1));
  const figure = hasScene(card) && keyframes.length > 0;
  const live = phase === 'play' || phase === 'aha';
  const wayName = labels.lenses[way]?.ja ?? way;
  return (
    <>
      <div className={`stage walk${live ? ' live' : ''}`} ref={stage} data-card={card.id} data-mode="walkthrough" onClick={advance}>
        {figure ? (
          <LensScene card={card} keyframe={kf} t={1} theme="short_dark" className="fig walkfig" />
        ) : (
          !live && <p className="walk-text">{card.problem.text_ja}</p>
        )}
        {live && <WalkBoard card={card} shown={shown} next={phase === 'play'} nudge={nudge} />}
        <GuideOverlay />
      </div>
      <aside className="side">
        {phase === 'pick' && <PickCard card={card} pc={pc} trap={parent.trap_route.steps[0]?.ja} />}
        {phase === 'clue' && <ClueCard lens={way} pc={pc} />}
        {live && (
          <div className="card">
            <span className="chip" style={{ ['--lens' as string]: C.lens(way) }}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <LensIcon lens={way as LensOrDirect} tokens={tokens} color={C.lens(way)} />
              </svg>
              {wayName}
            </span>
            <div className="trigger">{card.trigger.ja}</div>
          </div>
        )}
        {phase === 'aha' && <Aha card={card} last={last} onNext={onNext} onAgain={onAgain} listSteps={false} />}
      </aside>
    </>
  );
}
