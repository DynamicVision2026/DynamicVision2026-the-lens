// The lesson's four steps: さわって学ぶ (the masterclass, WO-014) → いっしょに発見 (the ladder) →
// ひとりで練習 (the round) → 時間をはかって確認 (the timed check).
import { loadBundle } from '@lens/scenes';
import { t } from '../i18n/ja';
import { navigate } from '../launch/navigate';
import { sfx } from './fx';
import { findLesson, findPass } from './lessons';

export type Step = 1 | 2 | 3 | 4;

export function StepNav({ passId, lens, current }: { passId: string; lens: string; current: Step }) {
  const pass = findPass(loadBundle(), passId);
  const master = !!(pass && findLesson(pass, lens)?.masterclass);
  const base = `/lesson/${passId}/${lens}`;
  const go: Record<Step, string> = { 1: `${base}/master`, 2: base, 3: `${base}/practice`, 4: `${base}/timed` };
  return (
    <nav className="steps-nav" aria-label={t('step.label')}>
      {([1, 2, 3, 4] as const).map((n) =>
        n === 1 && !master ? (
          <span key={n} className="st off" title={t('step.soon')}>
            <i>1</i>
            <span className="lbl">{t('step.1')}</span>
          </span>
        ) : (
          <button key={n} type="button" className={`st${n === current ? ' cur' : ''}`} onClick={() => n !== current && (sfx.tap(), navigate(go[n]))}>
            <i>{n}</i>
            <span className="lbl">{t(`step.${n}`)}</span>
          </button>
        ),
      )}
    </nav>
  );
}
