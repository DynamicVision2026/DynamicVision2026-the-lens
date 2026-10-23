import type { ReactElement } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import narrEn from "../../../narration.en.json";
import narrZh from "../../../narration.zh-Hant.json";
import durations from "../durations2.json";
import durationsEn from "../durations2.en.json";
import durationsZh from "../durations2.zh-Hant.json";
import { IS_JA, VLANG, VOICE_CREDIT, lfile, tr, trk, trParts } from "../vlang";
import { Backdrop, C, FONT, Fade, Hex, Kicker, Rich, Screen, Sfx, Slam, clamp, ease, useIn, usePop } from "../v2/kit";

/**
 * つまずきマップ — 30-second vertical short (1080×1920) for YouTube Shorts / TikTok / Instagram Reels.
 * Narration k01–k06 (VOICEVOX No.7), subtitles burned in (most people watch muted), app clips from the guide.
 */
const FPS = 30;
const D = ({ ja: durations, en: durationsEn, "zh-Hant": durationsZh } as Record<string, Record<string, number>>)[VLANG];
const LEAD = 0.4;
const GAP = 0.35;
type L = { id: string; text: string; from: number; dur: number };
const TEXT: Record<string, string> = {
  k01: "テスト前、何から復習すればいい？",
  k02: "宿題もテストも、撮るだけ。",
  k03: "AIが問題ごとに単元を見分けて、\n○✕を記録。",
  k04: "つまずいた単元が、\n地図でひと目でわかる。",
  k05: "テスト前は、\n今夜やる問題だけを一覧に。",
  k06: "つまずきマップ。\n30枚まで無料でお試しできます。",
};
const NARR = ({ en: narrEn, "zh-Hant": narrZh } as Record<string, { lines: { id: string; text: string }[] }>)[VLANG];
if (!IS_JA) for (const l of NARR.lines) if (l.id in TEXT) TEXT[l.id] = l.text;
const LINES: L[] = [];
{
  let t = LEAD;
  for (const id of ["k01", "k02", "k03", "k04", "k05", "k06"]) {
    LINES.push({ id, text: TEXT[id], from: Math.round(t * FPS), dur: Math.round(D[id] * FPS) });
    t += D[id] + GAP + (id === "k01" ? 0.3 : 0);
  }
}
const at = (id: string) => (LINES.find((l) => l.id === id) as L).from;
const end = (id: string) => {
  const l = LINES.find((x) => x.id === id) as L;
  return l.from + l.dur;
};
export const SHORT_TOTAL = end("k06") + Math.round(2.6 * FPS);

// scenes: [start, end) in frames
const SC = {
  hook: [0, at("k02") - 2],
  snap: [at("k02") - 2, at("k04") - 2],
  map: [at("k04") - 2, at("k05") - 2],
  exam: [at("k05") - 2, at("k06") - 2],
  end: [at("k06") - 2, SHORT_TOTAL],
} as const;

function Subtitle({ line }: { line: L }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 4, line.dur + 2, line.dur + 8], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 250, opacity: o }}>
      <div style={{ maxWidth: 940, padding: "18px 30px", borderRadius: 20, background: "rgba(4,9,20,0.82)", fontFamily: FONT, fontSize: 50, fontWeight: 900, color: C.text, textAlign: "center", lineHeight: 1.4, whiteSpace: "pre-line" }}>{line.text}</div>
    </AbsoluteFill>
  );
}

function Hook() {
  const f = useCurrentFrame();
  const q = usePop(18, 10);
  const dur = SC.hook[1] - SC.hook[0];
  return (
    <Fade dur={dur + 6} edge={6}>
      <Backdrop w={1080} h={1920} tint={C.accent} />
      <div style={{ position: "absolute", left: 80, right: 80, top: 430, textAlign: "center" }}>
        <Kicker color={C.accent} style={{ justifyContent: "center" }}>{tr("テスト前のあなたへ")}</Kicker>
        <Slam parts={trParts(["テスト前、", "何から", "復習する？"])} start={2} size={VLANG === "en" ? 92 : 118} colors={[undefined, C.gold, undefined]} style={{ marginTop: 40 }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 960, display: "flex", justifyContent: "center", gap: 26 }}>
        {trParts(["プリント", "ドリル", "テスト"]).map((t, i) => {
          const p = usePop(20 + i * 6, 11);
          return (
            <div key={t} style={{ width: 250, height: 320, borderRadius: 22, background: "#f7f4ee", transform: `rotate(${(i - 1) * 7}deg) translateY(${(1 - p) * 300 + Math.sin((f + i * 20) / 14) * 8}px)`, opacity: Math.min(1, p), boxShadow: "0 30px 60px rgba(0,0,0,0.5)", padding: 26, fontFamily: FONT }}>
              <div style={{ fontSize: 34, fontWeight: 900, color: "#1e2d4a" }}>{t}</div>
              {[0, 1, 2, 3].map((k) => (
                <div key={k} style={{ marginTop: 22, height: 14, borderRadius: 7, background: k === 2 ? C.red : "#d5cec2", width: `${90 - k * 12}%` }} />
              ))}
              <div style={{ marginTop: 20, fontSize: 56, fontWeight: 900, color: C.red }}>✕</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1380, textAlign: "center", fontFamily: FONT, fontSize: 200, fontWeight: 900, color: C.gold, opacity: Math.min(1, q), transform: `scale(${0.6 + 0.4 * q}) rotate(${Math.sin(f / 8) * 4}deg)` }}>?</div>
      <Sfx at={2} src="whoosh" volume={0.4} />
      <Sfx at={20} src="pop" volume={0.3} />
    </Fade>
  );
}

function SnapScene() {
  const dur = SC.snap[1] - SC.snap[0];
  const k3 = at("k03") - SC.snap[0];
  return (
    <Fade dur={dur + 6} edge={6}>
      <Backdrop w={1080} h={1920} tint={C.accent} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 120, display: "flex", justifyContent: "center" }}>
        <Kicker color={C.accent}>{useCurrentFrame() < k3 ? tr("1  撮る") : tr("2  AIが記録")}</Kicker>
      </div>
      <Screen clip="snap_phone" width={560} segs={[{ from: 0, to: k3, a: 0.44, b: 4.8 }, { from: k3, to: dur + 6, a: 5.25, b: 13.42 }]} style={{ left: 247, top: 220, transform: `translateY(${(1 - useIn(0, 14)) * 140}px)` }} glow="rgba(255,138,92,0.3)" />
      <Sfx at={k3 - 6} src="shutter" volume={0.35} />
    </Fade>
  );
}

function MapScene() {
  const dur = SC.map[1] - SC.map[0];
  return (
    <Fade dur={dur + 6} edge={6}>
      <Backdrop w={1080} h={1920} tint={C.green} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 120, display: "flex", justifyContent: "center" }}>
        <Kicker color={C.green}>{tr("3  つまずきマップ")}</Kicker>
      </div>
      <Screen clip="daily_phone" width={560} segs={[{ from: 0, to: dur + 6, a: 0, b: 3.6 }]} style={{ left: 247, top: 220, transform: `scale(${0.96 + 0.04 * useIn(0, 20)})` }} glow="rgba(71,199,139,0.3)" />
    </Fade>
  );
}

function ExamScene() {
  const dur = SC.exam[1] - SC.exam[0];
  return (
    <Fade dur={dur + 6} edge={6}>
      <Backdrop w={1080} h={1920} tint={C.gold} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 120, display: "flex", justifyContent: "center" }}>
        <Kicker color={C.gold}>{tr("4  テスト前モード")}</Kicker>
      </div>
      <Screen clip="exam_ipad" width={1000} zmax={1.4} segs={[{ from: 0, to: dur + 6, a: 8.6, b: 13.8 }]} style={{ left: 24, top: 420, transform: `translateY(${(1 - useIn(0, 14)) * 120}px)` }} glow="rgba(246,196,83,0.3)" />
      <div style={{ position: "absolute", left: 0, right: 0, top: 1260, textAlign: "center" }}>
        <Slam parts={trParts(["今夜やることが、", "はっきり。"])} start={10} size={72} colors={[undefined, C.gold]} />
      </div>
    </Fade>
  );
}

function EndCard() {
  const f = useCurrentFrame();
  const logo = useIn(0, 18);
  const pill = usePop(22, 11);
  return (
    <AbsoluteFill>
      <Backdrop w={1080} h={1920} tint={C.cyan} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 440, display: "flex", justifyContent: "center", gap: 14 }}>
        {[C.grey, C.red, C.green, C.gold, C.purple].map((c, i) => (
          <div key={c} style={{ transform: `translateY(${Math.sin((f + i * 10) / 14) * 10}px)`, opacity: logo }}>
            <Hex color={c} size={84} />
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", fontFamily: FONT, opacity: logo }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: C.muted }}>{tr("毎日の復習も、テスト前も。")}</div>
        <div style={{ marginTop: 16, fontSize: 132, fontWeight: 900, color: C.text, letterSpacing: "0.04em", textShadow: `0 0 70px ${C.cyan}55`, transform: `scale(${0.94 + 0.06 * logo})` }}>{tr("つまずきマップ")}</div>
        <div style={{ marginTop: 18, fontSize: 46, fontWeight: 800, color: C.text }}>
          <Rich text={tr("撮るだけで、[何を復習すればいいか]がわかる。")} />
        </div>
        <div style={{ marginTop: 60, display: "inline-block", padding: "20px 64px", borderRadius: 999, background: C.gold, color: "#0b1830", fontSize: 70, fontWeight: 900, transform: `scale(${0.7 + 0.3 * pill})`, opacity: Math.min(1, pill) }}>domo-ai.com</div>
        <div style={{ marginTop: 26, fontSize: 40, fontWeight: 900, color: C.text, opacity: useIn(30, 14) }}>{tr("登録不要 ・ 30枚まで無料")}</div>
        <div style={{ marginTop: 12, fontSize: 32, fontWeight: 700, color: C.muted, opacity: useIn(36, 14) }}>{IS_JA ? "小1〜高3 の算数・数学" : trk("", "origin:short")}</div>
      </div>
      <div style={{ position: "absolute", right: 30, bottom: 30, fontFamily: FONT, fontSize: 22, color: "rgba(200,210,230,0.6)" }}>{VOICE_CREDIT}</div>
      <Sfx at={2} src="hit" volume={0.45} />
      <Sfx at={22} src="chime" volume={0.3} />
    </AbsoluteFill>
  );
}

export function Short() {
  const f = useCurrentFrame();
  // music ducks under the voice
  const speaking = LINES.some((l) => f >= l.from - 6 && f <= l.from + l.dur + 4);
  const fadeOut = interpolate(f, [SHORT_TOTAL - 40, SHORT_TOTAL], [1, 0], clamp);
  const scenes: [keyof typeof SC, () => ReactElement][] = [
    ["hook", Hook],
    ["snap", SnapScene],
    ["map", MapScene],
    ["exam", ExamScene],
    ["end", EndCard],
  ];
  return (
    <AbsoluteFill style={{ background: C.bg0 }}>
      {scenes.map(([k, View]) => (
        <Sequence key={k} from={SC[k][0]} durationInFrames={SC[k][1] - SC[k][0] + 6}>
          <View />
        </Sequence>
      ))}
      {LINES.map((l) => (
        <Sequence key={l.id} from={l.from} durationInFrames={l.dur + 10}>
          <Audio src={staticFile(lfile(`audio2/${l.id}.wav`))} />
          <Subtitle line={l} />
        </Sequence>
      ))}
      <Audio src={staticFile("short-music.wav")} volume={(speaking ? 0.3 : 0.7) * fadeOut} />
      <AbsoluteFill style={{ pointerEvents: "none", opacity: interpolate(f, [0, 8], [1, 0], { ...clamp, easing: ease }), background: C.bg0 }} />
    </AbsoluteFill>
  );
}
