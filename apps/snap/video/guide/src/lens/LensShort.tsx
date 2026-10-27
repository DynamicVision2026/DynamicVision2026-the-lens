import type { ReactElement } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT, Screen, Sfx, clamp, ease } from "../v2/kit";
import { AreaFig, Clock, EndCard, P, PaperBg, Scribble, Sheet, SlideFig, UnfoldFig } from "./kit";
import durations from "./durations.json";

/**
 * 視点レンズ Shorts (1080×1920, ~30 s), one per stage. The pain first (the sheet, the clock, the stuck pencil),
 * then the habit route, then the lens, one strength, and the end card. No product name before the end card.
 * Captions end above y 1440 and stay left of x 920 (YouTube's overlay).
 */
export type LensShortProps = { stage: "ca" | "cb" | "cc" };
const D = durations as Record<string, number>;
const s = (sec: number) => Math.round(sec * 30);

type Stage = {
  tag: string;
  head: string;
  text: string;
  trap: string[];
  trapNote: string;
  lens: string;
  clip: string;
  fig: (at: number, d1: number, d2: number) => ReactElement;
};

const STAGES: Record<LensShortProps["stage"], Stage> = {
  ca: {
    tag: "中学受験",
    head: "算数　入試演習",
    text: "自動車と自転車が合わせて18台あり、タイヤの数は合わせて52本です。自動車は何台ありますか。",
    trap: ["1台 → 4＋17×2＝38 ×", "2台 → 8＋16×2＝40 ×", "3台 → 12＋15×2＝42 ×", "4台 → 16＋14×2＝44 ×", "5台 …"],
    trapNote: "表が、終わらない。",
    lens: "面積図",
    clip: "lens_drill",
    fig: (at, d1, d2) => <AreaFig start={at} step={at + 6} done={at + s(d1 + 0.4 + d2 * 0.3)} w={920} />,
  },
  cb: {
    tag: "高校受験",
    head: "数学　入試演習",
    text: "直方体ABCD-EFGHで、AB＝4cm、BC＝8cm、AE＝9cm。Aから辺BF上の点Pを通ってGまで、表面に糸をかけます。糸がいちばん短いとき、BPは何cm？",
    trap: ["BP＝x とおく", "AP＝√(16＋x²)", "PG＝√(64＋(9−x)²)", "足して最小…？"],
    trapNote: "ルートが2つ。止まる。",
    lens: "展開",
    clip: "lens_3d_unfold",
    fig: (at, d1, d2) => <UnfoldFig start={at} open={at + 8} join={at + s(d1 + 0.4)} w={820} />,
  },
  cc: {
    tag: "大学受験",
    head: "数学　入試演習",
    text: "放物線 y＝x² 上に A(−1, 1)、B(3, 9)。点Pが放物線上をAからBまで動くとき、△ABPの面積が最大になるPのx座標は？",
    trap: ["P(t, t²) とおく", "面積＝½|(3+1)(t²−1)−(9−1)(t+1)|", "tの2次式… 微分？"],
    trapNote: "式が、長くなる。",
    lens: "等積変形",
    clip: "lens_timed",
    fig: (at, d1, d2) => <SlideFig start={at} slide={at + 6} lock={at + s(d1 + 0.4 + d2 * 0.4)} size={700} />,
  },
};

export function lensShortTimes(stage: LensShortProps["stage"]) {
  const k = stage;
  const d1 = D[`${k}1`], d2 = D[`${k}2`], d3 = D[`${k}3`];
  const trap = 4.0;
  const lens = 10.5;
  const v1 = lens + 0.6;
  const v2 = v1 + d1 + 0.4;
  const strength = v2 + d2 + 1.2;
  const v3 = strength + 0.4;
  const end = v3 + d3 + 1.4;
  return { d1, d2, d3, trap, lens, v1, v2, strength, v3, end, total: end + 3.2 };
}
export const lensShortFrames = (p: LensShortProps) => s(lensShortTimes(p.stage).total);

function Caption({ text, from, to, color = P.ink, size = 64, top = 1250 }: { text: string; from: number; to: number; color?: string; size?: number; top?: number }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [from, from + 6, to - 5, to], [0, 1, 1, 0], clamp);
  if (o <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 60, width: 800, top, fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.3, color, whiteSpace: "pre-line", opacity: o, transform: `translateY(${(1 - o) * 14}px)` }}>
      {text}
    </div>
  );
}

export function LensShort({ stage }: LensShortProps) {
  const f = useCurrentFrame();
  const st = STAGES[stage];
  const T = lensShortTimes(stage);
  const sheetOut = interpolate(f, [s(T.lens) - 10, s(T.lens) + 6], [1, 0], { ...clamp, easing: ease });
  const shake = f > s(1.6) && f < s(T.trap) ? Math.sin(f / 2) * 2 : 0;
  const trapO = interpolate(f, [s(T.trap) - 4, s(T.trap) + 8, s(T.lens) - 8, s(T.lens) + 2], [0, 1, 1, 0], clamp);
  const lensO = interpolate(f, [s(T.lens) - 2, s(T.lens) + 10, s(T.strength) - 6, s(T.strength) + 4], [0, 1, 1, 0], clamp);
  const strO = interpolate(f, [s(T.strength) - 2, s(T.strength) + 10, s(T.end) - 6, s(T.end)], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: P.paper }}>
      <PaperBg cell={44} />
      {/* the sheet (hook) */}
      <div style={{ position: "absolute", inset: 0, opacity: interpolate(f, [s(T.trap) - 6, s(T.trap) + 4], [1, 0], clamp) * (sheetOut > 0 ? 1 : 0) }}>
        <Sheet head={st.head} text={st.text} size={44} style={{ left: 70, top: 200, width: 800, transform: `rotate(-1.5deg) translateX(${shake}px)` }}>
          <div style={{ marginTop: 34, height: 220, border: `3px dashed ${P.line}`, borderRadius: 8 }} />
        </Sheet>
        <div style={{ position: "absolute", left: 560, top: 860, width: 300, height: 30, background: "linear-gradient(90deg, #f2c14e 82%, #e9a5a0 82%)", borderRadius: 4, transform: `rotate(-32deg) translateY(${Math.sin(f / 6) * 3}px)` }} />
      </div>
      <div style={{ position: "absolute", left: 60, top: 80, fontFamily: FONT, fontWeight: 900, fontSize: 34, color: "#fff", background: P.ink, borderRadius: 999, padding: "6px 24px", opacity: f < s(T.end) ? 1 : 0 }}>{st.tag}</div>
      {f < s(T.lens) + 6 && <Clock from={0} startSec={179} rate={9} size={200} style={{ right: 60, top: 60 }} />}
      {/* the habit route */}
      <div style={{ position: "absolute", left: 70, top: 300, width: 860, opacity: trapO }}>
        <div style={{ fontFamily: FONT, fontSize: 48, fontWeight: 900, color: P.trap }}>くせで やると…</div>
        <Scribble lines={st.trap} start={s(T.trap) + 6} every={22} size={50} cross={s(T.lens) - 22} style={{ top: 90, left: 0 }} />
      </div>
      {/* the lens */}
      <div style={{ position: "absolute", left: 60, top: 230, width: 960, opacity: lensO }}>
        <div style={{ fontFamily: FONT, fontSize: 50, fontWeight: 900, color: P.goldInk }}>
          <span style={{ display: "inline-block", width: 44, height: 44, borderRadius: "50%", border: `7px solid ${P.gold}`, boxShadow: "0 0 24px rgba(227,165,28,0.7)", verticalAlign: "-6px", marginRight: 16 }} />
          {st.lens}で 見ると
        </div>
        <div style={{ marginTop: 50 }}>{f >= s(T.lens) - 2 && st.fig(s(T.lens) + 8, T.d1, T.d2)}</div>
      </div>
      {/* one strength + the real app */}
      {f >= s(T.strength) - 4 && f < s(T.end) && (
        <div style={{ opacity: strO }}>
          <Screen clip={st.clip} segs={[{ from: s(T.strength), to: s(T.end) + 6, a: 0.5, b: 10 }]} width={840} camera={false} sfx={false} style={{ left: 104, top: 230 }} glow="rgba(227,165,28,0.3)" />
        </div>
      )}
      {/* captions */}
      <Caption text="問題は、読めた。" from={s(0.3)} to={s(T.trap) - 2} />
      <Caption text={"でも、手が\n動かない。"} from={s(1.6)} to={s(T.trap) - 2} color={P.red} top={1340} />
      <Caption text={st.trapNote} from={s(T.trap) + 10} to={s(T.lens) - 2} color={P.red} />
      <Caption text={tx(`${stage}1`)} from={s(T.v1)} to={s(T.v2) - 1} size={60} />
      <Caption text={tx(`${stage}2`)} from={s(T.v2)} to={s(T.strength) - 2} size={60} color={P.goldInk} />
      <Caption text={tx(`${stage}3`)} from={s(T.v3)} to={s(T.end) - 2} size={60} top={1260} />
      {/* sound */}
      {Array.from({ length: Math.ceil(T.lens) }).map((_, i) => <Sfx key={i} at={s(i) + 4} src="tick" volume={0.2} />)}
      <Sfx at={s(T.lens)} src="chime" volume={0.35} />
      {(["1", "2", "3"] as const).map((n) => (
        <Sequence key={n} from={s(n === "1" ? T.v1 : n === "2" ? T.v2 : T.v3)} durationInFrames={s(9)}>
          <Audio src={staticFile(`lens/${stage}${n}.wav`)} />
        </Sequence>
      ))}
      <Sequence from={s(T.end)} durationInFrames={s(3.2)}>
        <EndCard line="迷う時間を削る。" w={1080} scale={0.82} />
      </Sequence>
    </AbsoluteFill>
  );
}

import narr from "../../../lens-narration.json";
const TEXT = Object.fromEntries((narr as { lines: { id: string; text: string }[] }).lines.map((l) => [l.id, l.text]));
// caption line breaks (the narration file holds the plain text)
const CAP: Record<string, string> = {
  ca1: "全部、自転車だとしたら、\n36本。",
  ca2: "足りない16本は、\n自動車の分。\n16÷2で、8台。",
  ca3: "解き方より先に、\n見る場所を選ぶ。",
  cb3: "立体は、\n3Dで回して確かめる。",
  cb2: "AとGを、まっすぐ結ぶ。\nBPは、3cm。",
  cc2: "高さが最大なのは、\nABと平行な接線。xは、1。",
};
const tx = (id: string) => CAP[id] ?? TEXT[id] ?? "";
