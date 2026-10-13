// The lesson's four steps (Masterclass: さわって学ぶ → いっしょに発見 → ひとりで練習 → 時間をはかって確認).
// Step 1, the interactive intro, is still to come; steps 2–4 are the ladder, practice and the timed check.
import { t } from '../i18n/ja';
import { navigate } from '../launch/navigate';
import { sfx } from './fx';

export type Step = 2 | 3 | 4;

export function StepNav({ passId, lens, current }: { passId: string; lens: string; current: Step }) {
  const go: Record<Step, string> = { 2: `/lesson/${passId}/${lens}`, 3: `/lesson/${passId}/${lens}/practice`, 4: `/lesson/${passId}/${lens}/timed` };
  return (
    <nav className="steps-nav" aria-label={t('step.label')}>
      <span className="st off" title={t('step.soon')}>
        <i>1</i>
        <span className="lbl">{t('step.1')}</span>
      </span>
      {([2, 3, 4] as const).map((n) => (
        <button key={n} type="button" className={`st${n === current ? ' cur' : ''}`} onClick={() => n !== current && (sfx.tap(), navigate(go[n]))}>
          <i>{n}</i>
          <span className="lbl">{t(`step.${n}`)}</span>
        </button>
      ))}
    </nav>
  );
}

