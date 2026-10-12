import { beatAt, getCard, LensScene, loadBundle, motionPreviewTimeline, SCENE_HEIGHT, SCENE_WIDTH, themed, timelineDuration, tokens } from '@lens/scenes';
import type { CalculateMetadataFunction } from 'remotion';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useFonts } from './useFonts';

export type EncloseMotionPreviewProps = {
  cardId: string;
};

const THEME = 'short_dark';

/** Frame count for a card's study-pace timeline (900 at 30 fps for a 4-corner card). */
export const calculatePreviewMetadata: CalculateMetadataFunction<EncloseMotionPreviewProps> = ({ props }) => {
  const card = getCard(props.cardId);
  const beats = card ? motionPreviewTimeline(card, tokens) : null;
  if (!beats) throw new Error(`EncloseMotionPreview: "${props.cardId}" is not a standard Enclose card in the bundle`);
  return { durationInFrames: Math.round((timelineDuration(beats) / 1000) * tokens.layout.short.fps) };
};

/**
 * WO-003 step 1b: the ≈30 s study-pace Enclose walkthrough. Remotion only maps the frame to (beat, t);
 * all drawing is LensScene with theme="short_dark".
 */
export function EncloseMotionPreview({ cardId }: EncloseMotionPreviewProps) {
  useFonts();
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const card = getCard(cardId);
  const beats = card ? motionPreviewTimeline(card, tokens) : null;
  const { short } = tokens.layout;
  const paper = themed(tokens, THEME).tokens.color.paper.value;

  if (!card || !beats) {
    throw new Error(`EncloseMotionPreview: "${cardId}" is not a standard Enclose card in the bundle`);
  }

  const { index, t } = beatAt(beats, (frame / fps) * 1000);
  // Fit the scene between the safe zones, centred horizontally.
  const sceneHeight = height - short.safe_top_px - short.safe_bottom_px;
  const sceneWidth = (sceneHeight * SCENE_WIDTH) / SCENE_HEIGHT;

  return (
    <AbsoluteFill style={{ backgroundColor: paper, alignItems: 'center' }}>
      <div style={{ position: 'absolute', top: short.safe_top_px, width: sceneWidth, height: sceneHeight }}>
        <LensScene card={card} keyframe={index} t={t} motion={beats} theme={THEME} lensLabel={loadBundle().labels?.lenses[card.lens]?.ja} />
      </div>
    </AbsoluteFill>
  );
}
