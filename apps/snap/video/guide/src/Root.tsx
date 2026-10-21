import { Composition } from "remotion";
import { SHORT_TOTAL, Short } from "./short/Short";
import { Guide2, TL } from "./v2/Guide2";

export function Root() {
  return (
    <>
      <Composition id="Guide" component={Guide2} durationInFrames={TL.total} fps={30} width={1920} height={1080} />
      <Composition id="Short" component={Short} durationInFrames={SHORT_TOTAL} fps={30} width={1080} height={1920} />
    </>
  );
}
