import type { ReactElement } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import timeline from "../timeline2.json";
import timelineEn from "../timeline2.en.json";
import timelineZh from "../timeline2.zh-Hant.json";
import { VLANG, lfile } from "../vlang";
import { C, FONT, Sfx, clamp } from "./kit";
import { DailyScene, ExamScene, Hook, LadderScene, type Line, MapScene, PlansScene, RootsScene, type Scene, SnapScene, Title, TrustScene, UseCases } from "./scenes";

type TLine = { fps: number; total: number; scenes: Scene[] };
/** The edit for this language: its narration lengths decide every scene's length (build_timeline.py). */
export const TL = ({ ja: timeline, en: timelineEn, "zh-Hant": timelineZh } as Record<string, TLine>)[VLANG];

const VIEW: Record<string, (p: { sc: Scene }) => ReactElement> = {
  hook: Hook,
  title: Title,
  usecases: UseCases,
  snap: SnapScene,
  map: MapScene,
  ladder: LadderScene,
  roots: RootsScene,
  daily: DailyScene,
  exam: ExamScene,
  trust: TrustScene,
  plans: PlansScene,
};

function Subtitle({ line }: { line: Line }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 5, line.dur + 3, line.dur + 10], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 40, opacity: o }}>
      <div style={{ maxWidth: 1560, padding: "12px 30px", borderRadius: 14, background: "rgba(4,9,20,0.78)", fontFamily: FONT, fontSize: 36, fontWeight: 700, color: C.text, textAlign: "center", lineHeight: 1.45 }}>{line.text}</div>
    </AbsoluteFill>
  );
}

/** Hex shutter between scenes: cells grow from the left edge, then shrink to reveal the next scene. */
function HexWipe({ at }: { at: number }) {
  const f = useCurrentFrame();
  const d = f - at;
  if (d < -14 || d > 14) return null;
  const R = 70;
  const w = Math.sqrt(3) * R;
  const cells = [];
  for (let row = -1; row < 10; row++) {
    for (let col = -1; col < 13; col++) {
      const x = col * w + (row % 2 ? w / 2 : 0);
      const y = row * 1.5 * R;
      const delay = (x / 1920) * 8;
      const grow = interpolate(d, [-14 + delay, -4 + delay], [0, 1], clamp);
      const shrink = interpolate(d, [delay - 2, 10 + delay * 0.5], [1, 0], clamp);
      const sc = Math.min(grow, shrink) * 1.08;
      if (sc <= 0.01) continue;
      cells.push(
        <polygon
          key={`${row}-${col}`}
          points={[0, 1, 2, 3, 4, 5].map((k) => `${x + R * sc * Math.cos((Math.PI / 3) * k + Math.PI / 6)},${y + R * sc * Math.sin((Math.PI / 3) * k + Math.PI / 6)}`).join(" ")}
          fill="#0b1830"
          stroke={C.cyan}
          strokeOpacity={0.35}
          strokeWidth={2}
        />,
      );
    }
  }
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
      {cells}
    </svg>
  );
}

export function Guide2() {
  const f = useCurrentFrame();
  const lines = TL.scenes.flatMap((s) => s.lines);
  // music ducks under the voice (smooth 0.3 s ramps)
  const duck = (frame: number) => {
    let near = 1;
    for (const l of lines) {
      const a = l.from - 8;
      const b = l.from + l.dur + 6;
      if (frame >= a && frame <= b) return 0.32;
      near = Math.min(near, Math.min(Math.abs(frame - a), Math.abs(frame - b)) / 9);
    }
    return 0.32 + (0.7 - 0.32) * Math.min(1, near);
  };
  return (
    <AbsoluteFill style={{ background: C.bg0 }}>
      {TL.scenes.map((sc) => {
        const V = VIEW[sc.id];
        return (
          <Sequence key={sc.id} from={sc.from} durationInFrames={sc.dur + 12} name={sc.id}>
            <V sc={sc} />
          </Sequence>
        );
      })}
      {TL.scenes.slice(1).map((sc) => (
        <HexWipe key={sc.id} at={sc.from + 6} />
      ))}
      {TL.scenes.slice(1).map((sc) => (
        <Sfx key={`w${sc.id}`} at={sc.from - 6} src="whoosh" volume={0.28} />
      ))}
      <Sfx at={TL.scenes[1].from - 66} src="riser" volume={0.25} />
      {lines.map((l) => (
        <Sequence key={l.id} from={l.from} durationInFrames={l.dur + 12} name={`voice ${l.id}`}>
          <Audio src={staticFile(lfile(`audio2/${l.id}.wav`))} volume={1} />
          <Subtitle line={l} />
        </Sequence>
      ))}
      <Audio src={staticFile(lfile("music.wav"))} volume={(fr) => duck(fr) * (f >= 0 ? 1 : 1)} />
    </AbsoluteFill>
  );
}
