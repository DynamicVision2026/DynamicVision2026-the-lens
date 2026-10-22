import { useEffect, useState, type ReactElement } from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Backdrop, C, FONT, Fade, Hex, Kicker, Screen, Sfx, Slam, clamp, ease, useIn, usePop } from "../v2/kit";
import { Calendar, Clock, FlipPage, HAND, Lamp, Mug, NightRoom, Notebook, S, Stack, Who, type Ink } from "./art";
import { CREDITS, FPS, lay, type Line } from "./timeline";

/**
 * つまずきマップ — story film (~2 min, 1920×1080).
 * Every night a mother copies her child's wrong answers into notebooks; on test eve nobody can tell where the
 * child stumbles. Then: photo → AI unit + ○✕ → map → tonight's list. Voices: VOICEVOX (narrator, mother, child).
 */
const T = lay(
  ["t01", "t02", "t03", "t04", "t05", "t06", "t07", "t08", "t09", "t10", "t11", "t12", "t13", "t14", "t15", "t16", "t17", "t18", "t19", "t20"],
  1.4,
  0.35,
  { t02: 0.2, t04: 0.7, t06: 0.8, t10: 0.2, t11: 1.3, t12: 2.6, t16: 0.5, t18: 0.3, t19: 0.9 },
  3.2,
);
export const STORY_TOTAL = T.total;
const { at, end } = T;
const sec = (x: number) => Math.round(x * FPS);

const SC = {
  night: [0, at("t05") - 8],
  lapse: [at("t05") - 8, at("t07") - 8],
  eve: [at("t07") - 8, at("t12") - 4],
  turn: [at("t12") - 4, at("t13") - 6],
  snap: [at("t13") - 6, at("t15") - 6],
  map: [at("t15") - 6, at("t16") - 6],
  exam: [at("t16") - 6, at("t17") - 8],
  ending: [at("t17") - 8, at("t20") - 6],
  end: [at("t20") - 6, STORY_TOTAL],
} as const;
const W = 1920;
const H = 1080;
const TABLE = 520;

// ---------------------------------------------------------------- shared pieces

export const WORK_INK: Ink[] = [
  { kind: "text", text: "10/7  問3", x: 525, y: 80, size: 30, color: S.red },
  { kind: "text", text: "平行四辺形の面積を", x: 525, y: 132 },
  { kind: "text", text: "求めなさい。", x: 525, y: 186 },
  { kind: "path", d: "M560 330 L630 246 L880 246 L810 330 L560 330", len: 690 },
  { kind: "path", d: "M630 246 L630 330", len: 84, color: S.red },
  { kind: "text", text: "15cm", x: 650, y: 336, size: 26 },
  { kind: "text", text: "8cm", x: 580, y: 268, size: 24, color: S.red },
];
const OLD_INK: Ink[] = [
  { kind: "text", text: "10/6  問2", x: 40, y: 80, size: 30, color: S.red },
  { kind: "text", text: "1.2 × 0.4 を計算しなさい。", x: 40, y: 132 },
  { kind: "text", text: "10/6  問5", x: 40, y: 240, size: 30, color: S.red },
  { kind: "text", text: "3/4 ÷ 2/5 を計算しなさい。", x: 40, y: 292 },
];

/** The returned worksheet with ✕ on 問3 and 問7; `mark` in [0,1] circles them. */
function Worksheet({ x, y, s = 1, rot = -8, mark = 0 }: { x: number; y: number; s?: number; rot?: number; mark?: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 380, height: 500, transform: `rotate(${rot}deg) scale(${s})`, transformOrigin: "0 0", background: "#fff", borderRadius: 8, boxShadow: "0 24px 50px rgba(0,0,0,0.5)", padding: "26px 28px", fontFamily: FONT }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: S.ink }}>算数プリント　面積</div>
      {Array.from({ length: 8 }, (_, i) => {
        const bad = i === 2 || i === 6;
        return (
          <div key={i} style={{ position: "relative", display: "flex", alignItems: "center", marginTop: 16, gap: 12 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: S.ink, width: 46 }}>問{i + 1}</span>
            <div style={{ height: 10, borderRadius: 5, background: "#d8dee9", width: 170 - (i % 3) * 30 }} />
            <span style={{ marginLeft: "auto", fontFamily: HAND, fontSize: 34, fontWeight: 600, color: S.red }}>{bad ? "✕" : "○"}</span>
            {bad && <div style={{ position: "absolute", right: -12, top: -10, width: 56, height: 56, borderRadius: "50%", border: `4px solid ${C.gold}`, opacity: mark, transform: `scale(${0.6 + 0.4 * mark})` }} />}
          </div>
        );
      })}
    </div>
  );
}

function Subtitle({ line }: { line: Line }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 4, line.dur + 2, line.dur + 8], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 46, opacity: o }}>
      <div style={{ maxWidth: 1500, padding: "12px 30px", borderRadius: 16, background: "rgba(4,9,20,0.78)", fontFamily: FONT, fontSize: 40, fontWeight: 900, color: C.text, textAlign: "center", lineHeight: 1.4 }}>
        <Who v={line.v} />
        {line.text}
      </div>
    </AbsoluteFill>
  );
}

/** Load the handwriting font before the first frame is captured. */
function useHandFont() {
  const [h] = useState(() => delayRender("Klee One"));
  useEffect(() => {
    Promise.all([document.fonts.load(`600 40px "Klee One"`, "平行四辺形の面積を求めなさい問まちがいノート明日テスト夜時①②③"), document.fonts.ready]).finally(() => continueRender(h));
  }, [h]);
}

// ---------------------------------------------------------------- scenes

function Night() {
  const f = useCurrentFrame();
  const dur = SC.night[1] - SC.night[0];
  const p = interpolate(f, [at("t03"), end("t03") - 6], [0, 0.55], clamp) + interpolate(f, [at("t04") - 4, end("t04") + 10], [0, 0.45], clamp);
  const mark = interpolate(f, [at("t02") + sec(1.2), at("t02") + sec(1.6)], [0, 1], clamp);
  const cam = interpolate(f, [0, dur], [1.0, 1.08], clamp);
  return (
    <Fade dur={dur + 8} edge={14}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${cam})`, transformOrigin: "50% 55%" }}>
        <NightRoom w={W} h={H} tableY={TABLE} gx={960} gy={600}>
          <Clock x={1660} y={210} r={92} min={22 * 60 + f / 60} />
          <Lamp x={1560} y={640} s={1.05} />
          <Mug x={1330} y={820} s={0.9} />
          <Worksheet x={130} y={480} mark={mark} />
          <Notebook x={500} y={500} w={980} h={410} ink={[...OLD_INK, ...WORK_INK]} p={OLDP + p * (1 - OLDP)} title="まちがい直しノート" style={{ transform: "perspective(1800px) rotateX(28deg)", transformOrigin: "50% 100%" }} />
        </NightRoom>
      </div>
      <Sequence from={0} durationInFrames={dur} layout="none">
        {Array.from({ length: Math.floor(dur / 30) }, (_, i) => (
          <Sfx key={i} at={i * 30} src="tick" volume={0.08} />
        ))}
      </Sequence>
      <Sfx at={at("t03") + 4} src="pencil" volume={0.4} />
      <Sfx at={at("t03") + 4 + sec(2.4)} src="pencil" volume={0.35} />
      <Sfx at={at("t04")} src="pencil" volume={0.35} />
    </Fade>
  );
}
/** share of the notebook ink that is already written before tonight (yesterday's problems). */
const OLDP = (() => {
  const w = (it: Ink) => (it.kind === "text" ? [...it.text].length : it.len / 40);
  const a = OLD_INK.reduce((s, it) => s + w(it), 0);
  const b = WORK_INK.reduce((s, it) => s + w(it), 0);
  return a / (a + b) + 0.0001;
})();

function Lapse() {
  const f = useCurrentFrame();
  const g = f + SC.lapse[0];
  const dur = SC.lapse[1] - SC.lapse[0];
  const spin = interpolate(g, [at("t05"), end("t06")], [0, 60 * 30], clamp);
  const n = interpolate(g, [at("t06") - 4, end("t06") + 10], [1, 6], clamp);
  const day = 7 + Math.floor(interpolate(g, [at("t05"), end("t06")], [0, 12.99], clamp));
  const flipA = ((f * 9) % 180);
  return (
    <Fade dur={dur + 8} edge={10}>
      <NightRoom w={W} h={H} tableY={TABLE} gx={960} gy={600}>
        <Clock x={1660} y={210} r={92} min={22 * 60 + spin} />
        <Calendar x={1180} y={150} s={0.9} day={String(day)} />
        <Lamp x={1560} y={640} s={1.05} />
        {[0, 1, 2].map((i) => (g > at("t05") + sec(1.5 + i * 1.6) ? <Mug key={i} x={1250 + i * 70} y={840 - i * 6} s={0.8} steam={i === 2} /> : null))}
        <Stack x={330} y={880} n={n} />
        <div style={{ position: "absolute", left: 640, top: 520, width: 560, height: 380, transform: "perspective(1800px) rotateX(28deg)", transformOrigin: "50% 100%" }}>
          <div style={{ position: "absolute", inset: 0, background: S.paper, borderRadius: 10, boxShadow: "0 30px 70px rgba(0,0,0,0.55)" }} />
          <FlipPage x={280} y={0} w={280} h={380} angle={flipA} />
        </div>
        {/* 1冊, 2冊, 3冊 tags */}
        {[1, 2, 3].map((k) => {
          const t0 = at("t06") + sec(0.9 + (k - 1) * 0.8);
          const q = interpolate(g, [t0, t0 + 8], [0, 1], { ...clamp, easing: ease });
          return (
            <div key={k} style={{ position: "absolute", left: 470 + (k - 1) * 40, top: 560 - k * 100, fontFamily: HAND, fontWeight: 600, fontSize: 76, color: "#fff27a", opacity: q, transform: `scale(${0.6 + 0.4 * q}) rotate(${-6 + k * 3}deg)`, textShadow: "0 6px 20px rgba(0,0,0,0.5)" }}>
              {k}冊
            </div>
          );
        })}
      </NightRoom>
      <div style={{ position: "absolute", left: 120, top: 90 }}>
        <Kicker color={C.gold}>毎晩 1時間</Kicker>
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <Sfx key={i} at={sec(0.4 + i * 1.3)} src="flip" volume={0.3} />
      ))}
      <Sfx at={at("t06") - SC.lapse[0] + sec(0.9)} src="mug" volume={0.4} />
      <Sfx at={at("t06") - SC.lapse[0] + sec(1.7)} src="mug" volume={0.4} />
      <Sfx at={at("t06") - SC.lapse[0] + sec(2.5)} src="mug" volume={0.4} />
    </Fade>
  );
}

function Eve() {
  const f = useCurrentFrame();
  const g = f + SC.eve[0];
  const dur = SC.eve[1] - SC.eve[0];
  const frantic = g >= at("t09") - 4 && g <= end("t10");
  const flipA = frantic ? (f * 22) % 180 : 0;
  const dim = interpolate(g, [at("t11") - 6, at("t11") + 10], [0, 0.62], clamp);
  const shake = frantic ? Math.sin(f * 2.3) * 3 : 0;
  return (
    <Fade dur={dur + 4} edge={10}>
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${shake}px)` }}>
        <NightRoom w={W} h={H} tableY={TABLE} gx={960} gy={600} warmth={0.8}>
          <Clock x={1660} y={210} r={92} min={23 * 60 + 20 + f / 30} />
          <Calendar x={1180} y={150} s={0.9} day="20" note="明日テスト！" />
          <Lamp x={1560} y={640} s={1.05} />
          <Stack x={330} y={880} n={12} sway={frantic ? 3 : 1} />
          <Stack x={1420} y={930} n={5} bw={320} bh={46} />
          <div style={{ position: "absolute", left: 640, top: 520, width: 560, height: 380, transform: "perspective(1800px) rotateX(28deg)", transformOrigin: "50% 100%" }}>
            <div style={{ position: "absolute", inset: 0, background: S.paper, borderRadius: 10, boxShadow: "0 30px 70px rgba(0,0,0,0.55)" }} />
            {[0, 1, 2].map((k) => (
              <FlipPage key={k} x={280} y={0} w={280} h={380} angle={frantic ? (flipA + k * 60) % 180 : 0} />
            ))}
          </div>
          {/* question marks */}
          {["？", "？", "？"].map((q, i) => {
            const t0 = at(i === 0 ? "t08" : i === 1 ? "t09" : "t10") + 6;
            const a = interpolate(g, [t0, t0 + 10], [0, 1], { ...clamp, easing: ease });
            return (
              <div key={i} style={{ position: "absolute", left: 700 + i * 230, top: 330 - (i % 2) * 80 + Math.sin((f + i * 20) / 10) * 10, fontFamily: FONT, fontWeight: 900, fontSize: 130, color: C.gold, opacity: a * (1 - dim), transform: `scale(${0.5 + 0.5 * a}) rotate(${(i - 1) * 12}deg)` }}>
                {q}
              </div>
            );
          })}
        </NightRoom>
      </div>
      <AbsoluteFill style={{ background: `rgba(2,4,12,${dim})` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 360, textAlign: "center", opacity: dim > 0.3 ? 1 : 0 }}>
        <Slam parts={["あんなに書き写したのに、", "つまずきが見えない。"]} start={at("t11") - SC.eve[0] + 8} size={86} colors={[undefined, C.gold]} />
      </div>
      <Sfx at={at("t09") - SC.eve[0] - 4} src="flipthrough" volume={0.5} />
      <Sfx at={at("t09") - SC.eve[0] + sec(1.6)} src="flipthrough" volume={0.45} />
      <Sfx at={at("t11") - SC.eve[0] + 8} src="hit" volume={0.35} />
    </Fade>
  );
}

function Turn() {
  const f = useCurrentFrame();
  const g = f + SC.turn[0];
  const dur = SC.turn[1] - SC.turn[0];
  const off = interpolate(f, [sec(0.6), sec(1.0)], [1, 0], clamp); // lamp clicks off
  const title = at("t12") + Math.round(D12 * FPS) + 6;
  const tq = interpolate(g, [title, title + 18], [0, 1], { ...clamp, easing: ease });
  const sheets = Array.from({ length: 16 }, (_, i) => i);
  return (
    <Fade dur={dur + 6} edge={8}>
      <AbsoluteFill style={{ background: "#03050c" }} />
      <div style={{ opacity: off }}>
        <NightRoom w={W} h={H} tableY={TABLE} gx={960} gy={600} warmth={0.8}>
          <Lamp x={1560} y={640} s={1.05} />
          <Stack x={330} y={880} n={12} />
        </NightRoom>
      </div>
      <div style={{ opacity: 1 - off }}>
        <Backdrop tint={C.cyan} />
      </div>
      {/* pages fly up and turn into map hexes */}
      {sheets.map((i) => {
        const t0 = sec(1.2) + i * 3;
        const q = interpolate(f, [t0, t0 + 40], [0, 1], { ...clamp, easing: ease });
        const x = 200 + ((i * 377) % 1500);
        const y = 1100 - q * (700 + (i % 4) * 90);
        const morph = interpolate(f, [t0 + 26, t0 + 40], [0, 1], clamp);
        const col = [C.grey, C.red, C.green, C.gold, C.purple][i % 5];
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, opacity: q > 0 ? 1 - tq * 0.85 : 0, transform: `rotate(${(1 - morph) * (i % 2 ? 30 : -30) * (1 - q)}deg)` }}>
            {morph < 1 && <div style={{ position: "absolute", width: 120, height: 160, background: S.paper, borderRadius: 6, opacity: 1 - morph, boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }} />}
            <div style={{ opacity: morph }}>
              <Hex color={col} size={110} />
            </div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: 380, textAlign: "center", fontFamily: FONT, opacity: tq, transform: `scale(${0.92 + 0.08 * tq})` }}>
        <div style={{ fontSize: 44, fontWeight: 800, color: C.muted }}>書き写さなくていい。</div>
        <div style={{ marginTop: 14, fontSize: 170, fontWeight: 900, color: C.text, letterSpacing: "0.06em", textShadow: `0 0 80px ${C.cyan}66` }}>つまずきマップ</div>
      </div>
      <Sfx at={sec(0.6)} src="tap" volume={0.4} />
      <Sfx at={sec(0.8)} src="air" volume={0.5} />
      <Sfx at={title - SC.turn[0]} src="hit" volume={0.5} />
      <Sfx at={title - SC.turn[0] + 10} src="chime" volume={0.3} />
    </Fade>
  );
}
const D12 = (T.lines.find((l) => l.id === "t12") as Line).dur / FPS;

function Step({ n, title, sub, color }: { n: string; title: string; sub?: string; color: string }) {
  return (
    <div style={{ position: "absolute", left: 110, top: 300, width: 900 }}>
      <Kicker color={color}>{n}</Kicker>
      <Slam parts={[title]} start={6} size={72} style={{ marginTop: 26 }} />
      {sub && <div style={{ marginTop: 26, fontFamily: FONT, fontSize: 36, fontWeight: 800, color: C.muted, opacity: useIn(16, 16) }}>{sub}</div>}
    </div>
  );
}

function Snap() {
  const f = useCurrentFrame();
  const dur = SC.snap[1] - SC.snap[0];
  const k = at("t14") - SC.snap[0];
  return (
    <Fade dur={dur + 6} edge={8}>
      <Backdrop tint={C.accent} />
      {f < k ? <Step n="1  撮る" title="返ってきたプリントを、撮るだけ。" sub="宿題・ドリル・テスト、1枚まるごと" color={C.accent} /> : <Sequence from={k} layout="none"><Step n="2  AIが記録" title="単元と○✕を、自動で記録。" sub="保存する前に、確認・修正もできます" color={C.accent} /></Sequence>}
      <Screen clip="snap_phone" width={430} segs={[{ from: 0, to: k, a: 0.44, b: 4.8 }, { from: k, to: dur + 6, a: 5.25, b: 13.42 }]} style={{ left: 1240, top: 100, transform: `translateY(${(1 - useIn(0, 18)) * 120}px)` }} glow="rgba(255,138,92,0.3)" />
      <Sfx at={k - 6} src="shutter" volume={0.35} />
    </Fade>
  );
}

function MapS() {
  const dur = SC.map[1] - SC.map[0];
  return (
    <Fade dur={dur + 6} edge={8}>
      <Backdrop tint={C.green} />
      <Step n="3  つまずきマップ" title="つまずいた単元が、ひと目で。" sub="小1〜高3、算数・数学の110単元" color={C.green} />
      <Screen clip="map_ipad" segs={[{ from: 0, to: dur + 6, a: 1.2, b: 10.5 }]} width={980} camera={false} sfx={false} style={{ left: 860, top: 170, transform: `scale(${0.96 + 0.04 * useIn(0, 24)})` }} glow="rgba(71,199,139,0.3)" />
    </Fade>
  );
}

function Exam() {
  const dur = SC.exam[1] - SC.exam[0];
  return (
    <Fade dur={dur + 6} edge={8}>
      <Backdrop tint={C.gold} />
      <Step n="4  テスト前" title="今夜やる問題だけ、一覧に。" sub="日にちと範囲を選ぶだけ" color={C.gold} />
      <Screen clip="exam_ipad" segs={[{ from: 0, to: dur + 6, a: 0.9, b: 13.8 }]} width={1000} style={{ left: 840, top: 170 }} glow="rgba(246,196,83,0.3)" />
    </Fade>
  );
}

function Ending() {
  const f = useCurrentFrame();
  const g = f + SC.ending[0];
  const dur = SC.ending[1] - SC.ending[0];
  const ticks = [0, 1, 2].map((i) => interpolate(g, [at("t19") + sec(1.5 + i * 1.4), at("t19") + sec(1.8 + i * 1.4)], [0, 1], clamp));
  const rows = ["① 平行四辺形の面積", "② 小数のかけ算", "③ 分数のわり算"];
  return (
    <Fade dur={dur + 6} edge={14}>
      <NightRoom w={W} h={H} tableY={TABLE} gx={900} gy={620} warmth={1.5}>
        <Clock x={1660} y={210} r={92} min={22 * 60 + f / 60} />
        <Lamp x={1560} y={640} s={1.05} />
        <Mug x={1280} y={820} s={0.95} />
        <Mug x={1400} y={840} s={0.7} color="#ffd9a0" />
        <Worksheet x={120} y={520} rot={-12} s={0.9} />
        {/* checklist card */}
        <div style={{ position: "absolute", left: 560, top: 520, width: 640, padding: "28px 36px", borderRadius: 18, background: "#fff", boxShadow: "0 30px 70px rgba(0,0,0,0.5)", fontFamily: FONT, transform: `translateY(${(1 - useIn(6, 20)) * 60}px) rotate(-1.5deg)` }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: S.ink }}>今夜やること　<span style={{ color: C.accent }}>3問</span></div>
          {rows.map((r, i) => (
            <div key={r} style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 18, fontSize: 30, fontWeight: 800, color: S.ink }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, border: `4px solid ${C.green}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.green, fontSize: 32, fontWeight: 900 }}>{ticks[i] > 0.5 ? "✓" : ""}</div>
              <span style={{ opacity: 1 - ticks[i] * 0.4, textDecoration: ticks[i] > 0.5 ? "line-through" : "none" }}>{r}</span>
            </div>
          ))}
        </div>
      </NightRoom>
      {ticks.map((_, i) => (
        <Sfx key={i} at={at("t19") - SC.ending[0] + sec(1.6 + i * 1.4)} src="pop" volume={0.35} />
      ))}
      <Sfx at={sec(0.6)} src="mug" volume={0.35} />
    </Fade>
  );
}

function EndCard() {
  const f = useCurrentFrame();
  const logo = useIn(0, 18);
  const pill = usePop(20, 11);
  return (
    <AbsoluteFill>
      <Backdrop tint={C.cyan} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 130, display: "flex", justifyContent: "center", gap: 18 }}>
        {[C.grey, C.red, C.green, C.gold, C.purple].map((c, i) => (
          <div key={c} style={{ transform: `translateY(${Math.sin((f + i * 10) / 16) * 9}px)`, opacity: logo }}>
            <Hex color={c} size={72} />
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 270, textAlign: "center", fontFamily: FONT, opacity: logo }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: C.muted }}>書き写さなくていい、毎日の復習。</div>
        <div style={{ marginTop: 18, fontSize: 160, fontWeight: 900, color: C.text, letterSpacing: "0.06em", textShadow: `0 0 70px ${C.cyan}55` }}>つまずきマップ</div>
        <div style={{ marginTop: 18, fontSize: 52, fontWeight: 800, color: C.text }}>
          撮るだけで、<span style={{ color: C.gold }}>何を復習すればいいか</span>がわかる。
        </div>
        <div style={{ marginTop: 50, display: "inline-block", padding: "16px 44px", borderRadius: 999, background: C.gold, color: "#0b1830", fontSize: 50, fontWeight: 900, transform: `scale(${0.7 + 0.3 * pill})`, opacity: Math.min(1, pill) }}>tsumazuki.domo-ai.com</div>
        <div style={{ marginTop: 18, fontSize: 32, fontWeight: 800, color: C.muted }}>登録不要 ・ 30枚まで無料でお試し ・ 小1〜高3</div>
      </div>
      <div style={{ position: "absolute", right: 36, bottom: 22, fontFamily: FONT, fontSize: 18, color: "rgba(200,210,230,0.6)" }}>{CREDITS}</div>
      <Sfx at={2} src="hit" volume={0.4} />
      <Sfx at={20} src="chime" volume={0.3} />
    </AbsoluteFill>
  );
}

export function Story() {
  useHandFont();
  const f = useCurrentFrame();
  const speaking = T.lines.some((l) => f >= l.from - 6 && f <= l.from + l.dur + 4);
  const fadeOut = interpolate(f, [STORY_TOTAL - 50, STORY_TOTAL], [1, 0], clamp);
  const scenes: [keyof typeof SC, () => ReactElement][] = [
    ["night", Night],
    ["lapse", Lapse],
    ["eve", Eve],
    ["turn", Turn],
    ["snap", Snap],
    ["map", MapS],
    ["exam", Exam],
    ["ending", Ending],
    ["end", EndCard],
  ];
  return (
    <AbsoluteFill style={{ background: C.bg0 }}>
      {scenes.map(([k, View]) => (
        <Sequence key={k} from={SC[k][0]} durationInFrames={SC[k][1] - SC[k][0] + 8}>
          <View />
        </Sequence>
      ))}
      {T.lines.map((l) => (
        <Sequence key={l.id} from={l.from} durationInFrames={l.dur + 10}>
          <Audio src={staticFile(`audio-story/${l.id}.wav`)} />
          {l.id !== "t20" && <Subtitle line={l} />}
        </Sequence>
      ))}
      <Audio src={staticFile("story-music.wav")} volume={(speaking ? 0.22 : 0.55) * fadeOut} />
      <AbsoluteFill style={{ pointerEvents: "none", opacity: interpolate(f, [0, 20], [1, 0], { ...clamp, easing: ease }), background: "#000" }} />
    </AbsoluteFill>
  );
}
