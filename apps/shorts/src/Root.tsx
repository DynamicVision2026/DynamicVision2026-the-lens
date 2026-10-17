import { loadBundle } from '@lens/scenes';
import { Composition } from 'remotion';
import { calculatePreviewMetadata, EncloseMotionPreview, type EncloseMotionPreviewProps } from './EncloseMotionPreview';
import { calculateLensShortMetadata, LensShort, type LensShortProps } from './LensShort';

const SHORT_SECONDS = 30;
const PREVIEW_CARD = 'enclose-001';

export function RemotionRoot() {
  const { short } = loadBundle().tokens.layout;
  const [width, height] = short.size_px;

  return (
    <>
      <Composition
        id="LensShort"
        component={LensShort}
        width={width}
        height={height}
        fps={short.fps}
        durationInFrames={SHORT_SECONDS * short.fps}
        defaultProps={{ cardId: 'constant-001' } satisfies LensShortProps}
        calculateMetadata={calculateLensShortMetadata}
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
