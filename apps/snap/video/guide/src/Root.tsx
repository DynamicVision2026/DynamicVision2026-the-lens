import { Composition } from "remotion";
import { CHAT_DEFAULT, Chat, chatFrames, type ChatProps } from "./shorts/Chat";
import { TREE_DEFAULT, Tree, treeFrames, type TreeProps } from "./shorts/Tree";
import { SHORT_TOTAL, Short } from "./short/Short";
import { STORY_TOTAL, Story } from "./story/Story";
import { STORY_SHORT_TOTAL, StoryShort } from "./story/StoryShort";
import { Guide2, TL } from "./v2/Guide2";
import { LENS_GUIDE_TOTAL, LensGuide } from "./lens/LensGuide";
import { LensShort, lensShortFrames, type LensShortProps } from "./lens/LensShort";

export function Root() {
  return (
    <>
      <Composition id="Guide" component={Guide2} durationInFrames={TL.total} fps={30} width={1920} height={1080} />
      <Composition id="Short" component={Short} durationInFrames={SHORT_TOTAL} fps={30} width={1080} height={1920} />
      <Composition id="Story" component={Story} durationInFrames={STORY_TOTAL} fps={30} width={1920} height={1080} />
      <Composition id="StoryShort" component={StoryShort} durationInFrames={STORY_SHORT_TOTAL} fps={30} width={1080} height={1920} />
      <Composition id="ShortB-Chat" component={Chat} defaultProps={CHAT_DEFAULT} calculateMetadata={({ props }: { props: ChatProps }) => ({ durationInFrames: chatFrames(props) })} durationInFrames={chatFrames(CHAT_DEFAULT)} fps={30} width={1080} height={1920} />
      <Composition id="ShortA-Tree" component={Tree} defaultProps={TREE_DEFAULT} calculateMetadata={({ props }: { props: TreeProps }) => ({ durationInFrames: treeFrames(props) })} durationInFrames={treeFrames(TREE_DEFAULT)} fps={30} width={1080} height={1920} />
      <Composition id="LensGuide" component={LensGuide} durationInFrames={LENS_GUIDE_TOTAL} fps={30} width={1920} height={1080} />
      <Composition id="LensShort" component={LensShort} defaultProps={{ stage: "ca" } as LensShortProps} calculateMetadata={({ props }: { props: LensShortProps }) => ({ durationInFrames: lensShortFrames(props) })} durationInFrames={lensShortFrames({ stage: "ca" })} fps={30} width={1080} height={1920} />
    </>
  );
}
