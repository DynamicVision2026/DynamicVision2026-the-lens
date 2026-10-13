// The pick → clue steps, shared by the lesson player (WO-012) and the どのレンズ？ check (WO-013):
// the guide asks, wrong picks try on their feedback, the real clue chip lights up.
import { LensIcon, loadBundle, tokens, type LensCard, type LensOrDirect } from '@lens/scenes';
import { useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch } from 'react';
import { PickLogger, VisibleClock } from './attempts';
import { AttemptContext } from './attemptContext';
import { t } from '../i18n/ja';
import { sfx } from './fx';
import { flowReducer, initialFlow, type FlowAction, type FlowState } from './flow';
import { useGuide } from './guide';
import { shuffle } from './shuffle';
import { C } from './scenes/kit';

export interface PickClue {
  s: FlowState;
  dispatch: Dispatch<FlowAction>;
  options: string[];
  chips: { tag: string; real: boolean }[];
  glow: number;
  /** The first pick's visible time (ms), once made: 「えらぶまで 2.8秒」. */
  pickMs: number | null;
  markVisible: () => void;
  pick: (option: string) => void;
  chip: (tag: string, real: boolean) => void;
}

export function usePickClue(card: LensCard, onPick?: (option: string) => void): PickClue {
  const { labels } = loadBundle();
  const guide = useGuide();
  const [s, dispatch] = useReducer(flowReducer, card.picker.correct, initialFlow);
  const options = useMemo(() => shuffle(card.picker.options), [card]);
  const chips = useMemo(() => {
    const real = card.trigger.tags.filter((tag) => !labels.tags[tag]?.generic);
    return shuffle([...real.map((tag) => ({ tag, real: true })), ...card.picker.clue_distractors.map((tag) => ({ tag, real: false }))]);
  }, [card, labels]);
  const [glow, setGlow] = useState(0);

  // Decision-speed log (WO-019): visible time from the pick buttons to the first tap, one record per
  // appearance of the problem; msRight is added when the first tap was wrong.
  const scope = useContext(AttemptContext);
  const clock = useRef<VisibleClock | null>(null);
  // Fallback when the buttons were never reported on screen (no IntersectionObserver, or a tap that
  // beat its first callback): count from when the problem appeared, never from the tap itself.
  const mountClock = useRef<VisibleClock | null>(null);
  const logger = useRef<PickLogger | null>(null);
  const [pickMs, setPickMs] = useState<number | null>(null);
  useEffect(() => {
    const m = new VisibleClock();
    m.start();
    mountClock.current = m;
    logger.current = new PickLogger(scope, card, () => (clock.current ?? m).elapsed());
    setPickMs(null);
    return () => {
      clock.current?.stop();
      clock.current = null;
      m.stop();
    };
  }, [card, scope]);
  /** The pick buttons are on screen (PickCard): the clock starts once, here. */
  const markVisible = () => {
    if (clock.current) return;
    const c = new VisibleClock();
    c.start();
    clock.current = c;
  };
  const logPick = (o: string) => {
    const ms = logger.current?.pick(o);
    if (ms !== null && ms !== undefined) setPickMs(ms);
  };

  // The guide asks; the idle prompt glows the options or chips.
  useEffect(() => {
    if (s.phase === 'pick') guide.say(t('guide.pick'));
    if (s.phase === 'clue') guide.say(t('guide.clue'));
    if (s.phase === 'pick' || s.phase === 'clue') guide.idle(() => setGlow((g) => g + 1));
    else guide.idle(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase]);

  const pick = (o: string) => {
    if (s.tried.includes(o) || s.phase !== 'pick') return;
    logPick(o);
    onPick?.(o);
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

  return { s, dispatch, options, chips, glow, pickMs, markVisible, pick, chip };
}

export function PickCard({ card, pc, trap }: { card: LensCard; pc: PickClue; trap?: string }) {
  const { labels } = loadBundle();
  const { s, options, glow, pick } = pc;
  const opts = useRef<HTMLDivElement>(null);
  // The decision clock starts when the buttons are actually on screen (on a phone they sit below the figure).
  useEffect(() => {
    const el = opts.current;
    if (!el || typeof IntersectionObserver === 'undefined') return pc.markVisible();
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        pc.markVisible();
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card]);
  return (
    <div className="card">
      <h2>{t('lesson.pickTitle')}</h2>
      {trap && (
        <div className="trap">
          {t('lesson.trapLead')}
          {trap}
        </div>
      )}
      <div className="opts" ref={opts}>
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
  );
}

export function ClueCard({ lens, pc }: { lens: string; pc: PickClue }) {
  const { labels } = loadBundle();
  const { s, chips, glow, chip } = pc;
  return (
    <div className="card">
      <h2>{t('lesson.clueTitle', { lens: labels.lenses[lens]?.ja ?? lens })}</h2>
      <div className="chips">
        {chips.map(({ tag, real }) => (
          <button key={`${tag}-${glow}`} type="button" className={`cl${s.clueChip === tag ? ' yes' : ''}${s.wrongChips.includes(tag) ? ' no shake' : ''}${glow && !s.clueChip && !s.wrongChips.includes(tag) ? ' nudge' : ''}`} onClick={() => chip(tag, real)}>
            {labels.tags[tag]?.ja ?? tag}
          </button>
        ))}
      </div>
      {(s.clueChip || s.wrongChips.length > 0) && <div className="why">{s.clueChip ? t('lesson.clueRight') : t('lesson.clueWrong')}</div>}
    </div>
  );
}
