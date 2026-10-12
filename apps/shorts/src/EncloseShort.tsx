import { getCard, LensScene, tokens } from '@lens/scenes';
import { AbsoluteFill } from 'remotion';
import { useFonts } from './useFonts';

// WO-002: a still LensScene proves the shared scene and fonts render in Remotion.
// The 30 s timeline comes in WO-003 step 2, after the motion preview is approved.
export function EncloseShort() {
  useFonts();
  const card = getCard('enclose-001');
  return (
    <AbsoluteFill style={{ backgroundColor: tokens.color.paper.value, justifyContent: 'center' }}>
      {card && <LensScene card={card} keyframe={0} t={1} />}
    </AbsoluteFill>
  );
}
