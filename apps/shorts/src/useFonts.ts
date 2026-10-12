import { tokens } from '@lens/scenes';
import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';

const FAMILIES = [tokens.type.family_ja, tokens.type.family_num, tokens.type.family_hand];

/** Holds the render until the token font families are loaded (fonts come from @lens/scenes/fonts). */
export function useFonts() {
  const [handle] = useState(() => delayRender('Loading fonts'));
  useEffect(() => {
    Promise.all(FAMILIES.map((f) => document.fonts.load(`16px "${f}"`, 'あA1')))
      .then(() => document.fonts.ready)
      .finally(() => continueRender(handle));
  }, [handle]);
}
