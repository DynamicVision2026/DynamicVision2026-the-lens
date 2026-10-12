import { loadBundle } from '@lens/scenes';
import { AbsoluteFill } from 'remotion';

// WO-001 placeholder: an empty paper-coloured frame. The scene arrives in WO-003.
export function EncloseShort() {
  const { color } = loadBundle().tokens;
  return <AbsoluteFill style={{ backgroundColor: color.paper.value }} />;
}
