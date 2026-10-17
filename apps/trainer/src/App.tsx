import { useEffect, useMemo } from 'react';
import { CaseView } from './course/CaseView';
import { CheckView } from './course/CheckView';
import { fromBook, lessonOpen, masterclassOpen, passLesson, passOpen } from './course/access';
import { LessonView } from './course/LessonView';
import { MasterView } from './course/MasterView';
import { PracticeView, TimedView } from './course/StepsView';
import { ReportView } from './course/ReportView';
import { DevScenes } from './dev/DevScenes';
import { rememberSrc, srcFrom, track } from './launch/analytics';
import { BookVisit, Redirect } from './launch/BookVisit';
import { External, GoPreorder, Landing, Privacy, Thanks } from './launch/Landing';
import { Open } from './launch/Open';
import { TrialStart } from './launch/Trial';
import { usePath } from './launch/navigate';
import { rememberShort } from './launch/tracking';
import { Play } from './play/Play';

/** Short links for end cards and bios (Oct 17): lens.domo-ai.com/x → /?src=x, so typed-in visits still count by channel. */
export const SHORT_LINKS: Record<string, string> = { '/x': 'x', '/yt': 'yt', '/ig': 'ig', '/tt': 'tiktok', '/note': 'note' };

// Minimal path switch; no router library.
export function App() {
  const path = usePath();
  // ?s=<card-id> from a Short: kept for this tab (signup tags, preorder UTM).
  const short = useMemo(() => rememberShort(window.location.search), []);
  // WO-025: a GA4 page_view for each route (the path only; never the query, which may hold an access key).
  // WO-027: ?src= (the book QR codes) is the one query value kept, as a param.
  useEffect(() => {
    if (SHORT_LINKS[path.replace(/\/$/, '')]) return; // redirecting: the page_view comes from the landing page
    const src = srcFrom(window.location.search);
    // A ?src= on any page (the back-cover QR lands on /) is remembered first, so the user property rides on this page_view.
    if (src) rememberSrc(src);
    track({ name: 'page_view', params: src ? { page_path: path, src } : { page_path: path } });
  }, [path]);
  const shortSrc = SHORT_LINKS[path.replace(/\/$/, '')];
  if (shortSrc) return <Redirect to={`/?src=${shortSrc}`} />;
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
    const [, passId, lens, step] = lesson as unknown as [string, string, string, string | undefined];
    // WO-027: a book QR (/lesson/<pass>/<lens>?src=book) opens this lens's masterclass, remembered on the device.
    const book = fromBook() && passLesson(passId, lens);
    const view = lessonRoute(path, passId, lens, step, book);
    return book ? <BookVisit passId={passId} lens={lens}>{view}</BookVisit> : view;
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

/** A lesson step behind its access (WO-024 §3a, WO-027). */
function lessonRoute(path: string, passId: string, lens: string, step: string | undefined, book: boolean) {
  const open = lessonOpen(passId, lens);
  // The QR address has no step: a book reader goes to Step 1 (a buyer keeps the lesson as before).
  if (book && !step && !open) return <Redirect to={`/lesson/${passId}/${lens}/master${window.location.search}`} />;
  // A bought Pass opens every lesson; the free trial its first lesson; the book a lens's masterclass only.
  if (step === 'master' ? !(book || masterclassOpen(passId, lens)) : !open) return <CaseView passId={passId} />;
  if (step === 'master') return <MasterView key={path} passId={passId} lens={lens} />;
  if (step === 'practice') return <PracticeView key={path} passId={passId} lens={lens} />;
  if (step === 'timed') return <TimedView key={path} passId={passId} lens={lens} />;
  return <LessonView key={path} passId={passId} lens={lens} />;
}
