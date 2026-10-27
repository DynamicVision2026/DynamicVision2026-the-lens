import type { ReactElement } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT, Screen, Sfx, clamp, ease } from "../v2/kit";
import { AgeBars, Clock, EndCard, FreezeFig, MirrorFig, P, PaperBg, Scribble, Sheet } from "./kit";
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
    text: "いま、お父さんは38才、子どもは8才です。お父さんの年れいが子どもの年れいの3倍になるのは何年後ですか。",
    trap: ["1年後 39・9 → ×", "2年後 40・10 → ×", "3年後 41・11 → ×", "4年後 42・12 → ×", "5年後 …"],
    trapNote: "表が、終わらない。",
    lens: "和差一定",
    clip: "lens_drill",
    fig: (at, d1, d2) => (
      <div style={{ transform: "scale(1.2)", transformOrigin: "0 0" }}>
        <AgeBars start={at} grow={at + s(d1 * 0.6)} done={at + s(d1 + 0.4 + d2 * 0.4)} w={420} note="差 30" />
      </div>
    ),
  },
  cb: {
    tag: "高校受験",
    head: "数学　入試演習",
    text: "2点A(−2, 3)、B(6, 5)。x軸上の点Pで AP＋PB が最短のとき、△ABPの面積は？",
    trap: ["P(p, 0) とおく", "√((p+2)²+9)＋√((p−6)²+25)", "これを最小に…？"],
    trapNote: "ルートが2つ。止まる。",
    lens: "折り返す → 囲む",
    clip: "lens_discover_mirror",
    fig: (at, d1, d2) => <MirrorFig start={at} reflect={at + 6} joinAt={at + s(d1 + 0.2)} enclose={at + s(d1 + 0.4 + d2 * 0.55)} size={700} />,
  },
  cc: {
    tag: "大学受験",
    head: "数学II　演習",
    text: "直線 (a＋1)x＋(a−1)y−2a＝0 が、aの値にかかわらず通る定点は？",
    trap: ["a＝0 → x−y＝0", "a＝1 → 2x−2＝0", "交点…？ 本当に全部？"],
    trapNote: "代入して、また確かめる。",
    lens: "止める",
    clip: "lens_master_freeze",
    fig: (at, d1, d2) => <FreezeFig start={at} spin={at + 2} lock={at + s(d1 + 0.4 + d2 * 0.5)} size={700} />,
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
        <Sequence key={n} from={s(n === "1" ? T.v1 : n === "2" ? T.v2 : T.v3)} durationInFrames={s(6)}>
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
const tx = (id: string) => TEXT[id] ?? "";
