import { beatAt, getCard, LensScene, motionPreviewTimeline, SCENE_HEIGHT, SCENE_WIDTH, themed, tokens } from '@lens/scenes';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useFonts } from './useFonts';

export type EncloseMotionPreviewProps = {
  cardId: string;
};

const THEME = 'short_dark';

/**
 * WO-003 step 1: the ~10 s Enclose collapse preview. Remotion only maps the frame to (beat, t);
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
        <LensScene card={card} keyframe={index} t={t} motion={beats} theme={THEME} />
      </div>
    </AbsoluteFill>
  );
}
