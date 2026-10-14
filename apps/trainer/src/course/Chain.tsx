// The chain runner (ADR-003 §2, WO-020): a problem whose card has `chain` plays stage by stage on one
// figure. The picker asks only for the first lens (chain[0].lens). Stage k runs the scene for
// chain[k].lens with stageSteps(card, k) and captions only that slice. Between stages: a halo on what
// the snap revealed, the next stage's goal_ja in the bubble, and its lens chip lighting up.
import { LensIcon, loadBundle, stageSteps, tokens, type LensCard, type LensOrDirect } from '@lens/scenes';
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../i18n/ja';
import { Aha } from './Aha';
import { readAttempts, todayMedian } from './attempts';
import { burst, sfx } from './fx';
import { GuideOverlay, useGuide } from './guide';
import { ClueCard, PickCard, usePickClue } from './PickClue';
import { isClean, type PlayOpts } from './play';
import { markSolved } from './progress';
import { SCENES } from './scenes';
import { C, SceneLock } from './scenes/kit';

/** How long the halo and the next goal stay before the next stage unlocks. */
export const STAGE_PAUSE_MS = 1400;

interface Props {
  card: LensCard;
  lens: string;
  passId: string;
  last: boolean;
  onNext: () => void;
  onAgain: () => void;
  stage: React.RefObject<HTMLDivElement | null>;
  opts: PlayOpts;
}

export function ChainFlow({ card, lens, passId, last, onNext, onAgain, stage, opts }: Props) {
  const { labels } = loadBundle();
  const guide = useGuide();
  const pc = usePickClue(card);
  const { s, dispatch } = pc;
  const chain = card.chain ?? [];
  const [k, setK] = useState(0);
  const [between, setBetween] = useState(false);
  const phase = s.phase;

  // A right clue lights up, then stage 1 unlocks.
  useEffect(() => {
    if (phase !== 'clue' || !s.clueChip) return;
    const go = window.setTimeout(() => dispatch({ type: 'play' }), 700);
    return () => window.clearTimeout(go);
  }, [phase, s.clueChip, dispatch]);

  const sRef = useRef(s);
  sRef.current = s;
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const kRef = useRef(k);
  kRef.current = k;

  const finish = useCallback(() => {
    dispatch({ type: 'solved' });
    sfx.aha();
    if (stage.current) burst(stage.current, [C.lens(lens), ...C.palette, C.ink]);
    guide.say(t('guide.aha'), 'd');
    if (optsRef.current.record !== false) markSolved(passId, lens, card.id);
    optsRef.current.onResult?.({ clean: isClean(sRef.current) });
  }, [dispatch, guide, stage, lens, passId, card.id]);

  // A stage snaps: the last one solves the problem; otherwise halo, the next goal, then the next stage.
  const stageSolved = useCallback(() => {
    const i = kRef.current;
    if (i >= chain.length - 1) return finish();
    setBetween(true);
    guide.say(chain[i + 1]!.goal_ja, 'd');
    window.setTimeout(() => {
      setBetween(false);
      setK(i + 1);
    }, STAGE_PAUSE_MS);
  }, [chain, finish, guide]);

  const locked = phase === 'pick' || phase === 'clue';
  const cur = chain[k]!;
  const Scene = SCENES[cur.lens]!;
  const steps = stageSteps(card, k);
  return (
    <>
      <div className={`stage${between ? ' stage-halo' : ''}`} ref={stage} data-card={card.id} data-mode="chain" data-stage={k}>
        <SceneLock.Provider value={locked}>
          <Scene key={locked ? 'locked' : `stage-${k}`} card={card} lens={cur.lens} onSolved={stageSolved} stage={{ index: k, steps }} />
        </SceneLock.Provider>
        <GuideOverlay />
      </div>
      <aside className="side">
        {phase === 'pick' && <PickCard card={card} pc={pc} trap={opts.practice ? undefined : card.trap_route.steps[0]?.ja} />}
        {phase === 'clue' && <ClueCard lens={chain[0]!.lens} pc={pc} />}
        {(phase === 'play' || phase === 'aha') && (
          <div className="card chain-card">
            <div className="chain-chips">
              {chain.map((c, i) => (
                <span key={i} className={`chip${i === k && phase === 'play' ? ' cur' : ''}${i < k || phase === 'aha' ? ' done' : ''}${between && i === k + 1 ? ' next' : ''}`} style={{ ['--lens' as string]: C.lens(c.lens) }}>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <LensIcon lens={c.lens as LensOrDirect} tokens={tokens} color={C.lens(c.lens)} />
                  </svg>
                  {labels.lenses[c.lens]?.ja ?? c.lens}
                </span>
              ))}
            </div>
            {phase === 'play' && <div className="trigger">{cur.goal_ja}</div>}
            {phase === 'play' && (
              <ol className="chain-steps">
                {steps.map((st, i) => (
                  <li key={i}>{st.ja}</li>
                ))}
              </ol>
            )}
          </div>
        )}
        {phase === 'aha' && <Aha card={card} last={last} onNext={onNext} onAgain={onAgain} nextLabel={opts.nextLabel} again={opts.again} pickMs={pc.pickMs} summary={opts.summary ? todayMedian(readAttempts(), passId, lens) : null} />}
      </aside>
    </>
  );
}
