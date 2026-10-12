import { useMemo } from 'react';
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
  if (path === '/privacy') return <Privacy />;
  if (path === '/thanks') return <Thanks />;
  if (path === '/go/preorder') return <GoPreorder short={short} />;
  return <Landing short={short} />;
}
