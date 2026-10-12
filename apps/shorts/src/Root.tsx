import { loadBundle } from '@lens/scenes';
import { Composition } from 'remotion';
import { calculatePreviewMetadata, EncloseMotionPreview, type EncloseMotionPreviewProps } from './EncloseMotionPreview';
import { calculateShortMetadata, EncloseShort, type EncloseShortProps } from './EncloseShort';

const SHORT_SECONDS = 30;
const PREVIEW_CARD = 'enclose-001';

export function RemotionRoot() {
  const { short } = loadBundle().tokens.layout;
  const [width, height] = short.size_px;

  return (
    <>
      <Composition
        id="EncloseShort"
        component={EncloseShort}
        width={width}
        height={height}
        fps={short.fps}
        durationInFrames={SHORT_SECONDS * short.fps}
        defaultProps={{ cardId: PREVIEW_CARD } satisfies EncloseShortProps}
        calculateMetadata={calculateShortMetadata}
      />
      <Composition
        id="EncloseMotionPreview"
        component={EncloseMotionPreview}
        width={width}
        height={height}
        fps={short.fps}
        durationInFrames={SHORT_SECONDS * short.fps}
        defaultProps={{ cardId: PREVIEW_CARD } satisfies EncloseMotionPreviewProps}
        calculateMetadata={calculatePreviewMetadata}
      />
    </>
  );
}
