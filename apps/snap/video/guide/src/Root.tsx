import { Composition } from "remotion";
import { Guide2, TL } from "./v2/Guide2";

export function Root() {
  return <Composition id="Guide" component={Guide2} durationInFrames={TL.total} fps={30} width={1920} height={1080} />;
}
