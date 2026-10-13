// The aha card: the answer, the lens steps in a stagger, the principle, then next / again.
import { answerText, type LensCard } from '@lens/scenes';
import { useEffect, useState } from 'react';
import { t } from '../i18n/ja';
import { sfx, TACTILE } from './fx';
import { C } from './scenes/kit';

export function Aha({ card, last, onNext, onAgain, listSteps = true, nextLabel, again = true, pickMs = null, summary = null }: { card: LensCard; last: boolean; onNext: () => void; onAgain: () => void; listSteps?: boolean; nextLabel?: string; again?: boolean; pickMs?: number | null; summary?: number | null }) {
  // The walkthrough has already revealed the steps one by one; then only the answer and the buttons.
  const steps = listSteps ? card.lens_route.steps : [];
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
      {/* WO-019: the child's own decision time, no judgement; the ladder's end adds today's median. */}
      {pickMs !== null && <p className="pick-time">{t('speed.pick', { s: (pickMs / 1000).toFixed(1) })}</p>}
      {summary !== null && <p className="pick-time">{t('speed.today', { s: (summary / 1000).toFixed(1) })}</p>}
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
            {nextLabel ?? (last ? t('lesson.toCase') : t('lesson.next'))}
          </button>
          {again && (
            <button type="button" className="go ghost" onClick={() => (sfx.tap(), onAgain())}>
              {t('lesson.again')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
