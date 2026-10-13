// The pick → clue steps, shared by the lesson player (WO-012) and the どのレンズ？ check (WO-013):
// the guide asks, wrong picks try on their feedback, the real clue chip lights up.
import { LensIcon, loadBundle, tokens, type LensCard, type LensOrDirect } from '@lens/scenes';
import { useEffect, useMemo, useReducer, useState, type Dispatch } from 'react';
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

  return { s, dispatch, options, chips, glow, pick, chip };
}

export function PickCard({ card, pc, trap }: { card: LensCard; pc: PickClue; trap?: string }) {
  const { labels } = loadBundle();
  const { s, options, glow, pick } = pc;
  return (
    <div className="card">
      <h2>{t('lesson.pickTitle')}</h2>
      {trap && (
        <div className="trap">
          {t('lesson.trapLead')}
          {trap}
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
