import { beatAt, getCard, LensScene, loadBundle, motionViewBox, shortTimeline, themed, timelineDuration, tokens } from '@lens/scenes';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, type CalculateMetadataFunction } from 'remotion';
import { useFonts } from './useFonts';

export type EncloseShortProps = {
  cardId: string;
};

const THEME = 'short_dark';

/** Frame count for a card's full Short: the study-pace walkthrough plus the WO-003 framing beats. */
export const calculateShortMetadata: CalculateMetadataFunction<EncloseShortProps> = ({ props }) => {
  const card = getCard(props.cardId);
  const beats = card ? shortTimeline(card, tokens) : null;
  if (!beats) throw new Error(`EncloseShort: "${props.cardId}" is not a standard Enclose card in the bundle`);
  return { durationInFrames: Math.round((timelineDuration(beats) / 1000) * tokens.layout.short.fps) };
};

/**
 * WO-003 step 2: the full Short. Remotion only maps the frame to (beat, t); all drawing is
 * LensScene with theme="short_dark". Every word and number comes from the bundle except the
 * fixed series copy (SHORT_COPY).
 */
export function EncloseShort({ cardId }: EncloseShortProps) {
  useFonts();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = getCard(cardId);
  const beats = card ? shortTimeline(card, tokens) : null;
  const { short } = tokens.layout;
  const paper = themed(tokens, THEME).tokens.color.paper.value;
  if (!card || !beats) throw new Error(`EncloseShort: "${cardId}" is not a standard Enclose card in the bundle`);

  const { labels } = loadBundle();
  const optionLabels = Object.fromEntries(card.picker.options.map((o) => [o, labels.lenses[o]?.ja ?? o]));
  const { index, t } = beatAt(beats, (frame / fps) * 1000);
  const area = motionViewBox(short);

  return (
    <AbsoluteFill style={{ backgroundColor: paper }}>
      <div style={{ position: 'absolute', top: area.y, left: area.x, width: area.width, height: area.height }}>
        <LensScene
          card={card}
          keyframe={index}
          t={t}
          motion={beats}
          theme={THEME}
          lensLabel={labels.lenses[card.lens]?.ja}
          optionLabels={optionLabels}
        />
      </div>
    </AbsoluteFill>
  );
}
