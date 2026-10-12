import { getCard, loadBundle, motionPreviewTimeline, timelineDuration, tokens } from '@lens/scenes';
import { Composition } from 'remotion';
import { EncloseMotionPreview, type EncloseMotionPreviewProps } from './EncloseMotionPreview';
import { EncloseShort } from './EncloseShort';

const SHORT_SECONDS = 30;
const PREVIEW_CARD = 'enclose-001';

export function RemotionRoot() {
  const { short } = loadBundle().tokens.layout;
  const [width, height] = short.size_px;
  const previewBeats = motionPreviewTimeline(getCard(PREVIEW_CARD)!, tokens)!;
  const previewFrames = Math.round((timelineDuration(previewBeats) / 1000) * short.fps);

  return (
    <>
      <Composition
        id="EncloseShort"
        component={EncloseShort}
        width={width}
        height={height}
        fps={short.fps}
        durationInFrames={SHORT_SECONDS * short.fps}
      />
      <Composition
        id="EncloseMotionPreview"
        component={EncloseMotionPreview}
        width={width}
        height={height}
        fps={short.fps}
        durationInFrames={previewFrames}
        defaultProps={{ cardId: PREVIEW_CARD } satisfies EncloseMotionPreviewProps}
      />
    </>
  );
}
