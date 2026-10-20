import type { ReactElement } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { ExamScene, Hook, LadderScene, MapScene, PlansScene, RootsScene, SnapScene, DevicesScene, Title } from "./scenes";
import { type Line, type Scene, TIMELINE } from "./timeline";
import { C, FONT } from "./ui";

const VIEW: Record<Scene["id"], (p: { sc: Scene }) => ReactElement> = {
  hook: Hook,
  title: Title,
  map: MapScene,
  snap: SnapScene,
  ladder: LadderScene,
  roots: RootsScene,
  exam: ExamScene,
  devices: DevicesScene,
  plans: PlansScene,
};

/** Subtitles: the line being spoken, in a soft bar at the bottom. */
function Subtitle({ line }: { line: Line }) {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 6, line.dur + 4, line.dur + 12], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 46, opacity: o }}>
      <div style={{ maxWidth: 1500, padding: "14px 34px", borderRadius: 16, background: "rgba(6,12,24,0.72)", fontFamily: FONT, fontSize: 40, fontWeight: 700, color: C.text, textAlign: "center", lineHeight: 1.45, letterSpacing: "0.02em" }}>
        {line.text}
      </div>
    </AbsoluteFill>
  );
}

export function Guide() {
  const frame = useCurrentFrame();
  // music ducks a little under the voice
  const speaking = TIMELINE.scenes.some((s) => s.lines.some((l) => frame >= l.from - 4 && frame <= l.from + l.dur + 4));
  return (
    <AbsoluteFill style={{ background: C.bg0 }}>
      {TIMELINE.scenes.map((sc) => {
        const V = VIEW[sc.id];
        return (
          <Sequence key={sc.id} from={sc.from} durationInFrames={sc.dur + 14} name={sc.id}>
            <V sc={sc} />
          </Sequence>
        );
      })}
      {TIMELINE.scenes.flatMap((sc) =>
        sc.lines.map((l) => (
          <Sequence key={l.id} from={l.from} durationInFrames={l.dur + 14} name={`voice ${l.id}`}>
            <Audio src={staticFile(`audio/${l.id}.wav`)} />
            <Subtitle line={l} />
          </Sequence>
        )),
      )}
      <Audio src={staticFile("audio/pad.wav")} volume={speaking ? 0.55 : 0.9} />
    </AbsoluteFill>
  );
}
