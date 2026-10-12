import { beatAt, getCard, LensScene, loadBundle, motionPreviewTimeline, motionViewBox, themed, timelineDuration, tokens } from '@lens/scenes';
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
  const { fps } = useVideoConfig();
  const card = getCard(cardId);
  const beats = card ? motionPreviewTimeline(card, tokens) : null;
  const { short } = tokens.layout;
  const paper = themed(tokens, THEME).tokens.color.paper.value;

  if (!card || !beats) {
    throw new Error(`EncloseMotionPreview: "${cardId}" is not a standard Enclose card in the bundle`);
  }

  const { index, t } = beatAt(beats, (frame / fps) * 1000);
  // The scene's viewBox is the safe area in frame px, so it is placed 1:1 at safe_top.
  const area = motionViewBox(short);

  return (
    <AbsoluteFill style={{ backgroundColor: paper, alignItems: 'center' }}>
      <div style={{ position: 'absolute', top: area.y, left: area.x, width: area.width, height: area.height }}>
        <LensScene card={card} keyframe={index} t={t} motion={beats} theme={THEME} lensLabel={loadBundle().labels?.lenses[card.lens]?.ja} />
      </div>
    </AbsoluteFill>
  );
}
