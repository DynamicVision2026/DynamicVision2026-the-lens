// /pass/:passId — the lens case: one tile per lesson (lens icon, name, hint, problem dots).
// Everything from bundle.passes. A Pass not unlocked on this device (WO-024 access link) shows its
// lessons locked, with the way to buy or open it.
import { LensIcon, loadBundle, tokens, type LensOrDirect } from '@lens/scenes';
import { t } from '../i18n/ja';
import { navigate } from '../launch/navigate';
import { passOpen } from './access';
import { sfx } from './fx';
import { findPass, lessonProblems } from './lessons';
import { lessonEntry } from './masterclass';
import { masterclassSeen, masteryOf } from './progress';
import { baseline, readAttempts, week4, week4Open } from './attempts';
import { solvedIn } from './progress';
import { SCENES } from './scenes';
import { C, useCourseTheme } from './scenes/kit';

export function CaseView({ passId }: { passId: string }) {
  useCourseTheme();
  const bundle = loadBundle();
  const pass = findPass(bundle, passId);
  if (!pass) return <main className="course">{t('lesson.notFound')}</main>;
  const open = passOpen(pass.id);
  if (pass.lessons.length === 0)
    return (
      <main className="course">
        <div className="brand">
          <h1>{pass.title_ja}</h1>
        </div>
        <p className="lede">{t('case.planned')}</p>
      </main>
    );
  return (
    <main className="course">
      <div className="brand">
        <h1>{t('case.title')}</h1>
        <span className="tag">{pass.title_ja}</span>
      </div>
      <p className="lede">{open ? t('case.lede') : t('case.locked')}</p>
      {!open && (
        <p className="lede">
          <a className="go" href="/#courses">
            {t('case.buy')}
          </a>{' '}
          <a className="go ghost" href="/#access">
            {t('case.owned')}
          </a>
        </p>
      )}
      {open && <Measure passId={pass.id} />}
      <div className="case">
        {pass.lessons.map((lesson) => {
          const problems = lessonProblems(pass, lesson);
          const solved = solvedIn(pass.id, lesson.lens);
          const ready = !!SCENES[lesson.lens] && problems.length > 0;
          const playable = open && ready;
          const label = bundle.labels.lenses[lesson.lens];
          const c = C.lens(lesson.lens);
          return (
            <button
              key={lesson.lens}
              type="button"
              className={`tile${problems.length > 0 && problems.every((p) => solved.includes(p.card.id)) ? ' done' : ''}${playable ? '' : ' locked'}`}
              style={{ ['--c' as string]: c }}
              disabled={!playable}
              onClick={() => {
                sfx.tap();
                // Step 1 the first time (WO-014), then Step 2.
                navigate(lessonEntry(pass.id, lesson, masterclassSeen(pass.id, lesson.lens)));
              }}
            >
              <span className="ring">
                <svg viewBox="0 0 24 24" aria-hidden>
                  <LensIcon lens={lesson.lens as LensOrDirect} tokens={tokens} color={c} />
                </svg>
              </span>
              <span className="nm">
                {label?.ja ?? lesson.lens}
                {masteryOf(pass.id, lesson.lens).done && <span className="star" aria-label={t('practice.masteredShort')}> ★</span>}
              </span>
              <span className="hn">{ready ? label?.hint_ja : t('case.planned')}</span>
              <span className="dots">
                {problems.map((p) => (
                  <i key={p.card.id} className={solved.includes(p.card.id) ? 'on' : ''} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {/* Week 4: the mixed drill across all lenses (WO-013), with the lessons' access. */}
      <button type="button" className="go drill-link" disabled={!open} onClick={() => (sfx.tap(), navigate(`/drill/${pass.id}`))}>
        {t('drill.link')}
      </button>
    </main>
  );
}

/** WO-019: the day-1 check before lesson 1, the week-4 check from day 22, and the parent report. */
function Measure({ passId }: { passId: string }) {
  const all = readAttempts();
  const base = baseline(all, passId);
  const due = base && week4Open(base) && !week4(all, passId);
  return (
    <div className="measure">
      {!base && (
        <button type="button" className="go" onClick={() => (sfx.tap(), navigate(`/baseline/${passId}`))}>
          {t('baseline.offer')}
        </button>
      )}
      {due && (
        <button type="button" className="go" onClick={() => (sfx.tap(), navigate(`/week4/${passId}`))}>
          {t('week4.offer')}
        </button>
      )}
      <button type="button" className="linkish" onClick={() => (sfx.tap(), navigate(`/report/${passId}`))}>
        {t('report.link')}
      </button>
    </div>
  );
}
