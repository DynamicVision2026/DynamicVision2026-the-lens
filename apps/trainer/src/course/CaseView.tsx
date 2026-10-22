// /pass/:passId — the lens case: one tile per lesson (lens icon, name, hint, problem dots).
// Everything from bundle.passes. A Pass not unlocked on this device (WO-024 access link) shows its
// lessons locked, with the way to buy or open it.
import { LangSwitch } from '../i18n/LangSwitch';
import { LensIcon, loadBundle, tokens, type LensOrDirect } from '@lens/scenes';
import { t } from '../i18n/ja';
import { track } from '../launch/analytics';
import { navigate } from '../launch/navigate';
import { LAUNCH } from '../launch.config';
import { bookOpen, bookReader, passOpen, trialLens, trialState, type TrialState } from './access';
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
  // WO-024 §3a: before purchase, the free trial opens the first lesson for 3 days.
  const trial = open ? ({ status: 'none' } as TrialState) : trialState(pass.id);
  const trialOpen = trial.status === 'active' ? trialLens(pass.id) : null;
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
        <LangSwitch className="case-lang" />
        <span className="tag">{pass.title_ja}</span>
      </div>
      {open ? <p className="lede">{t('case.lede')}</p> : <Locked passId={pass.id} trial={trial} />}
      {open && <Measure passId={pass.id} />}
      <div className="case">
        {pass.lessons.map((lesson) => {
          const problems = lessonProblems(pass, lesson);
          const solved = solvedIn(pass.id, lesson.lens);
          const ready = !!SCENES[lesson.lens] && problems.length > 0;
          // WO-027: a lens opened from the book plays its masterclass (Step 1) only.
          const bookOnly = !open && lesson.lens !== trialOpen && bookOpen(pass.id, lesson.lens);
          const playable = (open || lesson.lens === trialOpen || bookOnly) && ready;
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
                navigate(bookOnly ? `/lesson/${pass.id}/${lesson.lens}/master` : lessonEntry(pass.id, lesson, masterclassSeen(pass.id, lesson.lens)));
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

/** 「無料体験：あと2日」 (whole days, rounded up; hours on the last day). */
export function trialLeft(msLeft: number): string {
  const hours = Math.ceil(msLeft / 3_600_000);
  return hours <= 24 ? t('case.trialHours', { n: hours }) : t('case.trialDays', { n: Math.ceil(hours / 24) });
}

/** A Pass not bought on this device: the trial's state, the way to buy it, and the way to open a purchase. */
function Locked({ passId, trial }: { passId: string; trial: TrialState }) {
  return (
    <div className={`locked-note trial-${trial.status}`}>
      {trial.status === 'active' && <p className="trial-left">{trialLeft(trial.msLeft)}</p>}
      <p className="lede">{trial.status === 'active' ? t('case.trialMore') : trial.status === 'ended' ? t('case.trialEnded') : t('case.locked')}</p>
      {bookReader(passId) && <p className="lede book-more">{t('case.bookMore')}</p>}
      <p className="lede actions">
        <CourseButtons passId={passId} trial={trial} />{' '}
        <a className="go ghost" href="/#access">
          {t('case.owned')}
        </a>
      </p>
    </div>
  );
}

/** 「このコースを買う」 and, before any trial, 「無料ではじめる（3日間）」 (also the book reader's masterclass end card). */
export function CourseButtons({ passId, trial = trialState(passId) }: { passId: string; trial?: TrialState }) {
  const shop = LAUNCH.passes[passId]?.shopUrl ?? '/#courses';
  return (
    <>
      <a className="go" href={shop} onClick={() => track({ name: 'select_course', params: { pass: passId } })}>
        {t('case.buyThis')}
      </a>{' '}
      {trial.status === 'none' && (
        <a className="go ghost" href={`/trial/${passId}`}>
          {t('case.trialStart')}
        </a>
      )}
    </>
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
