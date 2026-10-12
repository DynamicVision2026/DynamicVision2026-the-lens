import { getCard, LensScene, tokens } from '@lens/scenes';
import { useEffect, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender } from 'remotion';

const FAMILIES = [tokens.type.family_ja, tokens.type.family_num, tokens.type.family_hand];

// WO-002: a still LensScene proves the shared scene and fonts render in Remotion.
// The 30 s timeline arrives in WO-003.
export function EncloseShort() {
  const [handle] = useState(() => delayRender('Loading fonts'));
  useEffect(() => {
    Promise.all(FAMILIES.map((f) => document.fonts.load(`16px "${f}"`, 'あA1')))
      .then(() => document.fonts.ready)
      .finally(() => continueRender(handle));
  }, [handle]);
  const card = getCard('enclose-001');
  return (
    <AbsoluteFill style={{ backgroundColor: tokens.color.paper.value, justifyContent: 'center' }}>
      {card && <LensScene card={card} keyframe={0} t={1} />}
    </AbsoluteFill>
  );
}
