import { Composition } from "remotion";
import { Guide } from "./Guide";
import { FPS, TIMELINE } from "./timeline";

export function Root() {
  return <Composition id="Guide" component={Guide} durationInFrames={TIMELINE.total} fps={FPS} width={1920} height={1080} />;
}
