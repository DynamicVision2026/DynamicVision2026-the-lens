import { useEffect, useMemo } from 'react';
import { CaseView } from './course/CaseView';
import { CheckView } from './course/CheckView';
import { lessonOpen, passOpen } from './course/access';
import { LessonView } from './course/LessonView';
import { MasterView } from './course/MasterView';
import { PracticeView, TimedView } from './course/StepsView';
import { ReportView } from './course/ReportView';
import { DevScenes } from './dev/DevScenes';
import { track } from './launch/analytics';
import { External, GoPreorder, Landing, Privacy, Thanks } from './launch/Landing';
import { Open } from './launch/Open';
import { TrialStart } from './launch/Trial';
import { usePath } from './launch/navigate';
import { rememberShort } from './launch/tracking';
import { Play } from './play/Play';

// Minimal path switch; no router library.
export function App() {
  const path = usePath();
  // ?s=<card-id> from a Short: kept for this tab (signup tags, preorder UTM).
  const short = useMemo(() => rememberShort(window.location.search), []);
  // WO-025: a GA4 page_view for each route (the path only; never the query, which may hold an access key).
  useEffect(() => track({ name: 'page_view', params: { page_path: path } }), [path]);
  if (path.startsWith('/dev/scenes')) return <DevScenes />;
  // /play/:cardId, and /play/:cardId/report once the report is shown (counted as its own path).
  const play = /^\/play\/([\w-]+)(?:\/report)?\/?$/.exec(path);
  if (play) return <Play cardId={play[1]!} short={short} />;
  // The free どのレンズ？ check (WO-013): open to everyone.
  if (path === '/check') return <CheckView short={short} />;
  // The week-4 mixed drill (WO-013): part of the paid course, so behind the same access as lessons.
  const drill = /^\/drill\/([\w-]+)\/?$/.exec(path);
  if (drill) return passOpen(drill[1]!) ? <CheckView key={path} short={short} mode="drill" passId={drill[1]!} /> : <CaseView passId={drill[1]!} />;
  // WO-019: the course's day-1 check, the week-4 check and the parent report (same access as lessons).
  const measure = /^\/(baseline|week4|report)\/([\w-]+)\/?$/.exec(path);
  if (measure) {
    const [, what, passId] = measure as unknown as [string, 'baseline' | 'week4' | 'report', string];
    if (!passOpen(passId)) return <CaseView passId={passId} />;
    if (what === 'report') return <ReportView key={path} passId={passId} />;
    return <CheckView key={path} short={short} mode={what} passId={passId} />;
  }
  // The course player (WO-012): the lens case and a lesson.
  const pass = /^\/pass\/([\w-]+)\/?$/.exec(path);
  if (pass) return <CaseView passId={pass[1]!} />;
  // A lesson: /master (step 1), the ladder (step 2), then /practice (step 3) and /timed (step 4).
  const lesson = /^\/lesson\/([\w-]+)\/([\w-]+)(?:\/(master|practice|timed))?\/?$/.exec(path);
  if (lesson) {
    // WO-024 §3a: a bought Pass opens every lesson; the free trial opens its first lesson only.
    if (!lessonOpen(lesson[1]!, lesson[2]!)) return <CaseView passId={lesson[1]!} />;
    const [, passId, lens, step] = lesson as unknown as [string, string, string, string | undefined];
    if (step === 'master') return <MasterView key={path} passId={passId} lens={lens} />;
    if (step === 'practice') return <PracticeView key={path} passId={passId} lens={lens} />;
    if (step === 'timed') return <TimedView key={path} passId={passId} lens={lens} />;
    return <LessonView key={path} passId={passId} lens={lens} />;
  }
  // WO-024 §3a: 「無料ではじめる（3日間）」 starts that Pass's free trial and opens its first lesson.
  const trial = /^\/trial\/([\w-]+)\/?$/.exec(path);
  if (trial) return <TrialStart passId={trial[1]!} />;
  // WO-024: the order email's access link.
  if (path === '/open') return <Open />;
  if (path === '/privacy') return <Privacy />;
  if (path === '/external') return <External />;
  if (path === '/thanks') return <Thanks />;
  if (path === '/go/preorder') return <GoPreorder short={short} />;
  return <Landing />;
}
