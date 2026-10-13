// /pass/:passId — the lens case: one tile per lesson (lens icon, name, hint, problem dots).
// Everything from bundle.passes; planned Passes show 準備中.
import { LensIcon, loadBundle, tokens, type LensOrDirect } from '@lens/scenes';
import { t } from '../i18n/ja';
import { navigate } from '../launch/navigate';
import { lessonsOpen } from './access';
import { sfx } from './fx';
import { findPass, lessonProblems } from './lessons';
import { masteryOf } from './progress';
import { solvedIn } from './progress';
import { SCENES } from './scenes';
import { C, useCourseTheme } from './scenes/kit';

export function CaseView({ passId }: { passId: string }) {
  useCourseTheme();
  const bundle = loadBundle();
  const pass = findPass(bundle, passId);
  if (!pass) return <main className="course">{t('lesson.notFound')}</main>;
  const open = lessonsOpen();
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
                navigate(`/lesson/${pass.id}/${lesson.lens}`);
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
    </main>
  );
}
