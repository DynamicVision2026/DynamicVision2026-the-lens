import { Composition } from "remotion";
import { SHORT_TOTAL, Short } from "./short/Short";
import { STORY_TOTAL, Story } from "./story/Story";
import { STORY_SHORT_TOTAL, StoryShort } from "./story/StoryShort";
import { Guide2, TL } from "./v2/Guide2";

export function Root() {
  return (
    <>
      <Composition id="Guide" component={Guide2} durationInFrames={TL.total} fps={30} width={1920} height={1080} />
      <Composition id="Short" component={Short} durationInFrames={SHORT_TOTAL} fps={30} width={1080} height={1920} />
      <Composition id="Story" component={Story} durationInFrames={STORY_TOTAL} fps={30} width={1920} height={1080} />
      <Composition id="StoryShort" component={StoryShort} durationInFrames={STORY_SHORT_TOTAL} fps={30} width={1080} height={1920} />
    </>
  );
}
