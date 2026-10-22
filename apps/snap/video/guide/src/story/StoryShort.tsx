import { useEffect, useState, type ReactElement } from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Backdrop, C, FONT, Fade, Hex, Kicker, Screen, Sfx, Slam, clamp, ease, useIn, usePop } from "../v2/kit";
import { Calendar, Clock, FlipPage, Lamp, Mug, NightRoom, Notebook, S, Stack, Who } from "./art";
import { WORK_INK } from "./Story";
import { CREDITS, FPS, lay, type Line } from "./timeline";

/** つまずきマップ — 25-second vertical story cut (1080×1920) for Shorts / TikTok / Reels. */
const BR: Record<string, string> = {
  h01: "毎晩、まちがえた問題を\nノートに書き写していませんか？",
  h03: "書き写さなくて大丈夫。\nプリントを撮るだけ。",
  h04: "つまずいた単元も、\n今夜やる問題も、ひと目で。",
};
const T = lay(["h01", "h02", "h03", "h04", "h05"], 0.5, 0.3, { h01: 0.2, h02: 0.4 }, 2.4);
export const STORY_SHORT_TOTAL = T.total;
const { at } = T;
const sec = (x: number) => Math.round(x * FPS);
const W = 1080;
const H = 1920;
const TABLE = 880;

const SC = {
  night: [0, at("h02") - 6],
  eve: [at("h02") - 6, at("h03") - 4],
  snap: [at("h03") - 4, at("h04") - 4],
  map: [at("h04") - 4, at("h04") + sec(2.2)],
  exam: [at("h04") + sec(2.2), at("h05") - 4],
  end: [at("h05") - 4, STORY_SHORT_TOTAL],
} as const;

function useHandFont() {
  const [h] = useState(() => delayRender("Klee One"));
  useEffect(() => {
    Promise.all([document.fonts.load(`600 40px "Klee One"`, "平行四辺形の面積を求めなさい問まちがいノート明日テスト①②③④⑤⑥⑦⑧⑨⑩"), document.fonts.ready]).finally(() => continueRender(h));
  }, [h]);
}

function Subtitle({ line }: { line: Line }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 4, line.dur + 2, line.dur + 8], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 250, opacity: o }}>
      <div style={{ maxWidth: 960, padding: "18px 30px", borderRadius: 20, background: "rgba(4,9,20,0.82)", fontFamily: FONT, fontSize: 50, fontWeight: 900, color: C.text, textAlign: "center", lineHeight: 1.4, whiteSpace: "pre-line" }}>
        <Who v={line.v} />
        {BR[line.id] ?? line.text}
      </div>
    </AbsoluteFill>
  );
}

function Night() {
  const f = useCurrentFrame();
  const dur = SC.night[1] - SC.night[0];
  const p = interpolate(f, [sec(0.6), dur], [0, 1], clamp);
  const n = interpolate(f, [sec(1.2), dur], [1, 9], clamp);
  return (
    <Fade dur={dur + 6} edge={8}>
      <NightRoom w={W} h={H} tableY={TABLE} gx={540} gy={1000}>
        <Clock x={860} y={330} r={100} min={22 * 60 + f * 6} />
        <Lamp x={900} y={1000} s={1} />
        <Stack x={300} y={960} n={n} bw={340} bh={50} />
        <Mug x={900} y={1160} s={0.85} />
        <Notebook x={60} y={980} w={960} h={420} ink={WORK_INK} p={p} title="まちがい直しノート" style={{ transform: "perspective(1800px) rotateX(26deg)", transformOrigin: "50% 100%" }} />
      </NightRoom>
      <div style={{ position: "absolute", left: 0, right: 0, top: 120, display: "flex", justifyContent: "center" }}>
        <Kicker color={C.gold}>毎晩 1時間</Kicker>
      </div>
      <Sfx at={sec(0.6)} src="pencil" volume={0.4} />
      <Sfx at={sec(3)} src="pencil" volume={0.35} />
    </Fade>
  );
}

function Eve() {
  const f = useCurrentFrame();
  const dur = SC.eve[1] - SC.eve[0];
  return (
    <Fade dur={dur + 6} edge={6}>
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${Math.sin(f * 2.3) * 3}px)` }}>
        <NightRoom w={W} h={H} tableY={TABLE} gx={540} gy={1000} warmth={0.8}>
          <Calendar x={640} y={230} s={1.1} day="20" note="明日テスト！" />
          <Lamp x={900} y={1000} s={1} />
          <Stack x={260} y={960} n={12} bw={340} bh={50} sway={3} />
          <div style={{ position: "absolute", left: 260, top: 990, width: 560, height: 380, transform: "perspective(1800px) rotateX(26deg)", transformOrigin: "50% 100%" }}>
            <div style={{ position: "absolute", inset: 0, background: S.paper, borderRadius: 10, boxShadow: "0 30px 70px rgba(0,0,0,0.55)" }} />
            {[0, 1, 2].map((k) => (
              <FlipPage key={k} x={280} y={0} w={280} h={380} angle={(f * 22 + k * 60) % 180} />
            ))}
          </div>
          {[0, 1].map((i) => {
            const a = useIn(6 + i * 10, 10);
            return (
              <div key={i} style={{ position: "absolute", left: 470 + i * 190, top: 640 - i * 150 + Math.sin((f + i * 20) / 10) * 10, fontFamily: FONT, fontWeight: 900, fontSize: 170, color: C.gold, opacity: a, transform: `scale(${0.5 + 0.5 * a}) rotate(${(i - 0.5) * 20}deg)` }}>
                ？
              </div>
            );
          })}
        </NightRoom>
      </div>
      <Sfx at={0} src="flipthrough" volume={0.5} />
    </Fade>
  );
}

function SnapS() {
  const dur = SC.snap[1] - SC.snap[0];
  return (
    <Fade dur={dur + 6} edge={6}>
      <Backdrop w={W} h={H} tint={C.accent} />
      <div style={{ position: "absolute", left: 60, right: 60, top: 150, textAlign: "center" }}>
        <Slam parts={["書き写さなくて、", "大丈夫。"]} start={4} size={88} colors={[undefined, C.gold]} />
      </div>
      <Screen clip="snap_phone" width={520} segs={[{ from: 0, to: dur + 6, a: 5.25, b: 12.5 }]} style={{ left: 267, top: 470, transform: `translateY(${(1 - useIn(0, 14)) * 140}px)` }} glow="rgba(255,138,92,0.3)" />
      <Sfx at={sec(1.2)} src="shutter" volume={0.35} />
    </Fade>
  );
}

function MapS() {
  const dur = SC.map[1] - SC.map[0];
  return (
    <Fade dur={dur + 6} edge={6}>
      <Backdrop w={W} h={H} tint={C.green} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 170, display: "flex", justifyContent: "center" }}>
        <Kicker color={C.green}>つまずいた単元が、地図に</Kicker>
      </div>
      <Screen clip="daily_phone" width={520} segs={[{ from: 0, to: dur + 6, a: 0, b: 3.2 }]} style={{ left: 267, top: 260 }} glow="rgba(71,199,139,0.3)" />
    </Fade>
  );
}

function ExamS() {
  const dur = SC.exam[1] - SC.exam[0];
  return (
    <Fade dur={dur + 6} edge={6}>
      <Backdrop w={W} h={H} tint={C.gold} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 170, display: "flex", justifyContent: "center" }}>
        <Kicker color={C.gold}>テスト前は、今夜やる問題だけ</Kicker>
      </div>
      <Screen clip="exam_ipad" width={1000} zmax={1.4} segs={[{ from: 0, to: dur + 6, a: 11.2, b: 13.8 }]} style={{ left: 24, top: 460 }} glow="rgba(246,196,83,0.3)" />
    </Fade>
  );
}

function EndCard() {
  const f = useCurrentFrame();
  const logo = useIn(0, 18);
  const pill = usePop(18, 11);
  return (
    <AbsoluteFill>
      <Backdrop w={W} h={H} tint={C.cyan} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 420, display: "flex", justifyContent: "center", gap: 14 }}>
        {[C.grey, C.red, C.green, C.gold, C.purple].map((c, i) => (
          <div key={c} style={{ transform: `translateY(${Math.sin((f + i * 10) / 14) * 10}px)`, opacity: logo }}>
            <Hex color={c} size={84} />
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 620, textAlign: "center", fontFamily: FONT, opacity: logo }}>
        <div style={{ fontSize: 46, fontWeight: 800, color: C.muted }}>書き写さなくていい、毎日の復習。</div>
        <div style={{ marginTop: 16, fontSize: 132, fontWeight: 900, color: C.text, letterSpacing: "0.04em", textShadow: `0 0 70px ${C.cyan}55` }}>つまずきマップ</div>
        <div style={{ marginTop: 60, display: "inline-block", padding: "20px 64px", borderRadius: 999, background: C.gold, color: "#0b1830", fontSize: 70, fontWeight: 900, transform: `scale(${0.7 + 0.3 * pill})`, opacity: Math.min(1, pill) }}>domo-ai.com</div>
        <div style={{ marginTop: 26, fontSize: 40, fontWeight: 900, color: C.text }}>登録不要 ・ 30枚まで無料</div>
        <div style={{ marginTop: 12, fontSize: 32, fontWeight: 700, color: C.muted }}>小1〜高3 の算数・数学</div>
      </div>
      <div style={{ position: "absolute", left: 30, right: 30, bottom: 30, textAlign: "center", fontFamily: FONT, fontSize: 20, color: "rgba(200,210,230,0.6)" }}>{CREDITS}</div>
      <Sfx at={2} src="hit" volume={0.45} />
      <Sfx at={20} src="chime" volume={0.3} />
    </AbsoluteFill>
  );
}

export function StoryShort() {
  useHandFont();
  const f = useCurrentFrame();
  const speaking = T.lines.some((l) => f >= l.from - 6 && f <= l.from + l.dur + 4);
  const fadeOut = interpolate(f, [STORY_SHORT_TOTAL - 36, STORY_SHORT_TOTAL], [1, 0], clamp);
  const scenes: [keyof typeof SC, () => ReactElement][] = [
    ["night", Night],
    ["eve", Eve],
    ["snap", SnapS],
    ["map", MapS],
    ["exam", ExamS],
    ["end", EndCard],
  ];
  return (
    <AbsoluteFill style={{ background: C.bg0 }}>
      {scenes.map(([k, View]) => (
        <Sequence key={k} from={SC[k][0]} durationInFrames={SC[k][1] - SC[k][0] + 6}>
          <View />
        </Sequence>
      ))}
      {T.lines.map((l) => (
        <Sequence key={l.id} from={l.from} durationInFrames={l.dur + 10}>
          <Audio src={staticFile(`audio-story/${l.id}.wav`)} />
          {l.id !== "h05" && <Subtitle line={l} />}
        </Sequence>
      ))}
      <Audio src={staticFile("story-short-music.wav")} volume={(speaking ? 0.25 : 0.6) * fadeOut} />
      <AbsoluteFill style={{ pointerEvents: "none", opacity: interpolate(f, [0, 8], [1, 0], { ...clamp, easing: ease }), background: "#000" }} />
    </AbsoluteFill>
  );
}
