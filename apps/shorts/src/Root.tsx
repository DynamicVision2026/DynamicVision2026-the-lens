import { loadBundle } from '@lens/scenes';
import { Composition } from 'remotion';
import { EncloseShort } from './EncloseShort';

const SHORT_SECONDS = 30;

export function RemotionRoot() {
  const { short } = loadBundle().tokens.layout;
  const [width, height] = short.size_px;

  return (
    <Composition
      id="EncloseShort"
      component={EncloseShort}
      width={width}
      height={height}
      fps={short.fps}
      durationInFrames={SHORT_SECONDS * short.fps}
    />
  );
}
