import { useMemo } from 'react';
import { CaseView } from './course/CaseView';
import { CheckView } from './course/CheckView';
import { lessonsOpen } from './course/access';
import { LessonView } from './course/LessonView';
import { DevScenes } from './dev/DevScenes';
import { GoPreorder, Landing, Privacy, Thanks } from './launch/Landing';
import { usePath } from './launch/navigate';
import { rememberShort } from './launch/tracking';
import { Play } from './play/Play';

// Minimal path switch; no router library.
export function App() {
  const path = usePath();
  // ?s=<card-id> from a Short: kept for this tab (signup tags, preorder UTM).
  const short = useMemo(() => rememberShort(window.location.search), []);
  if (path.startsWith('/dev/scenes')) return <DevScenes />;
  // /play/:cardId, and /play/:cardId/report once the report is shown (counted as its own path).
  const play = /^\/play\/([\w-]+)(?:\/report)?\/?$/.exec(path);
  if (play) return <Play cardId={play[1]!} short={short} />;
  // The free どのレンズ？ check (WO-013): open to everyone.
  if (path === '/check') return <CheckView short={short} />;
  // The course player (WO-012): the lens case and a lesson.
  const pass = /^\/pass\/([\w-]+)\/?$/.exec(path);
  if (pass) return <CaseView passId={pass[1]!} />;
  const lesson = /^\/lesson\/([\w-]+)\/([\w-]+)\/?$/.exec(path);
  if (lesson) return lessonsOpen() ? <LessonView key={path} passId={lesson[1]!} lens={lesson[2]!} /> : <CaseView passId={lesson[1]!} />;
  if (path === '/privacy') return <Privacy />;
  if (path === '/thanks') return <Thanks />;
  if (path === '/go/preorder') return <GoPreorder short={short} />;
  return <Landing short={short} />;
}
