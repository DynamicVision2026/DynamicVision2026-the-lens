import type { ReactNode } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT, Screen, Sfx, clamp, ease, usePop } from "../v2/kit";
import { Chip, EndCard, P, PaperBg } from "./kit";
import { Subtitle } from "./LensGuide";
import durations from "./durations.json";
import narr from "../../../lens-narration.json";

/**
 * 視点レンズ style test (Nov 2026): two parent-facing YouTube videos (16:9, ~75 s) in the "teach one insight,
 * let the viewer think first, sell only at the end" style. Each is posted with its own tracked link
 * (lens.domo-ai.com/?src=yt_a / yt_b) so the landing page's analytics compare them.
 *   A「どこを見るか」 — calm aha: 姉1200円・妹400円 → the gap 800 never changes → 400円.
 *   B「大人も引っかかる」 — 60 km/h out, 40 km/h back: 50 is wrong, 48 via the 面積図.
 */
const D = durations as Record<string, number>;
const TEXT = Object.fromEntries((narr as { lines: { id: string; text: string }[] }).lines.map((l) => [l.id, l.text]));
const s = (sec: number) => Math.round(sec * 30);

type Cue = { id: string; text: string; from: number; dur: number };
/** [line id, seconds of silence before it]; returns frame cues plus the frame where the last line ends. */
function plan(seq: [string, number][]) {
  let t = 0;
  const cues: Record<string, Cue> = {};
  for (const [id, gap] of seq) {
    t += gap;
    cues[id] = { id, text: TEXT[id], from: s(t), dur: s(D[id]) };
    t += D[id];
  }
  return { cues, end: s(t) };
}

const END_HOLD = s(1.8);
const END_CARD = s(4.5);

const A = plan([["ta01", 1.2], ["ta02", 5.4], ["ta03", 0.4], ["ta04", 1.0], ["ta05", 0.3], ["ta06", 1.4], ["ta07", 0.6], ["ta08", 1.4], ["ta09", 1.0], ["ta10", 1.0]]);
const B = plan([["tb01", 1.0], ["tb02", 0.4], ["tb03", 3.6], ["tb04", 0.5], ["tb05", 1.2], ["tb06", 0.6], ["tb07", 0.8], ["tb08", 1.6], ["tb09", 0.8], ["tb10", 0.8], ["ta10", 1.0]]);
export const TEST_A_FRAMES = A.end + END_HOLD + END_CARD;
export const TEST_B_FRAMES = B.end + END_HOLD + END_CARD;

// ---------------------------------------------------------------- shared pieces

function Scene({ from, to, children }: { from: number; to: number; children: ReactNode }) {
  const f = useCurrentFrame();
  if (f < from - 2 || f > to + 12) return null;
  const o = interpolate(f, [from, from + 12, to, to + 12], [0, 1, 1, 0], clamp);
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}
const Kick = ({ children, color = P.muted }: { children: ReactNode; color?: string }) => (
  <div style={{ fontFamily: FONT, fontSize: 34, fontWeight: 900, color, letterSpacing: "0.2em" }}>{children}</div>
);
const T = ({ children, size = 60, color = P.ink, style }: { children: ReactNode; size?: number; color?: string; style?: React.CSSProperties }) => (
  <div style={{ fontFamily: FONT, fontSize: size, fontWeight: 900, color, lineHeight: 1.35, ...style }}>{children}</div>
);
function appear(f: number, at: number, d = 14) {
  return interpolate(f, [at, at + d], [0, 1], { ...clamp, easing: ease });
}

/** A quiet "think" ring that empties over `sec` seconds. */
function ThinkRing({ at, sec, label = "考えてみてください", count = false }: { at: number; sec: number; label?: string; count?: boolean }) {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + s(sec)], [0, 1], clamp);
  const o = interpolate(f, [at - 6, at + 8, at + s(sec), at + s(sec) + 10], [0, 1, 1, 0], clamp);
  const n = Math.max(1, Math.ceil(sec - (f - at) / 30));
  const R = 70, C = 2 * Math.PI * R;
  return (
    <div style={{ position: "absolute", right: 90, top: 120, width: 300, textAlign: "center", opacity: o }}>
      <svg width={180} height={180} viewBox="0 0 180 180">
        <circle cx={90} cy={90} r={R} fill="none" stroke={P.line} strokeWidth={10} />
        <circle cx={90} cy={90} r={R} fill="none" stroke={P.gold} strokeWidth={10} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * p} transform="rotate(-90 90 90)" />
        {count && <text x={90} y={112} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={70} fill={P.ink}>{n}</text>}
      </svg>
      <div style={{ fontFamily: FONT, fontSize: 28, fontWeight: 800, color: P.muted, marginTop: 6 }}>{label}</div>
    </div>
  );
}

function Cta({ from }: { from: number }) {
  const f = useCurrentFrame();
  const a = appear(f, from), b = usePop(from + 18, 12), c = appear(f, from + s(1.6));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 230, textAlign: "center" }}>
      <div style={{ opacity: a }}>
        <div style={{ width: 120, height: 120, margin: "0 auto", borderRadius: "50%", border: `12px solid ${P.gold}`, boxShadow: "0 0 50px rgba(227,165,28,0.55)", background: P.goldSoft }} />
        <T size={84} style={{ marginTop: 26 }}>1つのレンズを、<span style={{ color: P.goldInk }}>3日間 無料</span>で。</T>
      </div>
      <div style={{ marginTop: 34, display: "inline-block", background: P.ink, color: "#fff", fontFamily: FONT, fontWeight: 900, fontSize: 56, borderRadius: 999, padding: "12px 56px", transform: `scale(${0.8 + 0.2 * Math.min(1, b)})`, opacity: Math.min(1, b) }}>lens.domo-ai.com</div>
      <div style={{ marginTop: 40, opacity: c, fontFamily: FONT, fontSize: 34, fontWeight: 700, color: P.muted }}>点数は約束しません。時間は、測ってお見せします。</div>
    </div>
  );
}

function Voices({ cues, dark = () => false }: { cues: Record<string, Cue>; dark?: (id: string) => boolean }) {
  return (
    <>
      {Object.values(cues).map((l) => (
        <Sequence key={l.id} from={l.from} durationInFrames={l.dur + 12} name={`voice ${l.id}`}>
          <Audio src={staticFile(`lens/${l.id}.wav`)} />
          <Subtitle line={l} dark={dark(l.id)} />
        </Sequence>
      ))}
    </>
  );
}
function Music({ cues, total }: { cues: Record<string, Cue>; total: number }) {
  const ls = Object.values(cues);
  const vol = (fr: number) => {
    const talk = ls.some((l) => fr >= l.from - 8 && fr <= l.from + l.dur + 6);
    const fade = interpolate(fr, [0, 30, total - 40, total], [0, 1, 1, 0], clamp);
    return (talk ? 0.1 : 0.22) * fade;
  };
  return <Audio src={staticFile("lens/music_test.wav")} volume={vol} />;
}

// ---------------------------------------------------------------- A「どこを見るか」

const PX = 0.5; // px per yen
const BX = 300; // bars start
function BarsA({ c }: { c: Record<string, Cue> }) {
  const f = useCurrentFrame();
  const t5 = c.ta05.from, t6 = c.ta06.from, t7 = c.ta07.from;
  // the gift: wanders 0 → 600 while the gap is pointed out, then settles at 400
  const wander = f < t5 ? 0 : 300 - 300 * Math.cos(((f - t5) / 30) * 1.25);
  const settle = interpolate(f, [t6 - 10, t6 + 20], [0, 1], { ...clamp, easing: ease });
  const g = wander * (1 - settle) + 400 * settle;
  const ane = 1200 + g, imo = 400 + g;
  const gapO = appear(f, t5 + 10);
  const split = appear(f, t6 + s(1.2));
  const res = appear(f, t7);
  const row = (y: number, name: string, base: number, col: string) => (
    <>
      <div style={{ position: "absolute", left: BX - 110, top: y + 8, fontFamily: FONT, fontSize: 50, fontWeight: 900, color: P.ink }}>{name}</div>
      <div style={{ position: "absolute", left: BX, top: y, width: base * PX, height: 80, background: col, borderRadius: "10px 0 0 10px" }} />
      <div style={{ position: "absolute", left: BX + base * PX, top: y, width: g * PX, height: 80, background: "#7cc49a", borderRadius: "0 10px 10px 0" }} />
    </>
  );
  return (
    <>
      <div style={{ position: "absolute", left: BX, top: 70 }}>
        <Kick color={P.goldInk}>ここだけ、見てください</Kick>
      </div>
      {row(250, "姉", 1200, P.pencil)}
      {row(450, "妹", 400, "#e58a7f")}
      <div style={{ position: "absolute", left: BX + 1200 * PX + g * PX + 24, top: 262, fontFamily: FONT, fontSize: 44, fontWeight: 900, color: P.ink }}>{Math.round(ane)}円</div>
      <div style={{ position: "absolute", left: BX + 400 * PX + g * PX + 24, top: 462, fontFamily: FONT, fontSize: 44, fontWeight: 900, color: P.ink }}>{Math.round(imo)}円</div>
      <div style={{ position: "absolute", left: BX + 860, top: 66, fontFamily: FONT, fontSize: 36, fontWeight: 800, color: "#3f8f62", opacity: appear(f, t5) }}>■ もらった分（同じ金額）</div>
      {/* the gap: from the end of 妹 to the end of 姉, drawn on 姉's row */}
      <div style={{ position: "absolute", left: BX + imo * PX, top: 236, width: 800 * PX, height: 108, border: `6px solid ${P.gold}`, borderRadius: 12, background: "rgba(227,165,28,0.18)", opacity: gapO, boxShadow: "0 0 30px rgba(227,165,28,0.45)" }} />
      <div style={{ position: "absolute", left: BX + imo * PX, width: 800 * PX, top: 166, textAlign: "center", fontFamily: FONT, fontSize: 42, fontWeight: 900, color: P.goldInk, whiteSpace: "nowrap", opacity: gapO * (1 - split) }}>差 800円（ずっと同じ）</div>
      {/* 姉 = 妹 × 2: the first block is 妹's length, the gap is the second */}
      <div style={{ position: "absolute", left: BX, top: 236, width: imo * PX, height: 108, border: `6px dashed ${P.ink}`, borderRadius: 12, opacity: split }} />
      <div style={{ position: "absolute", left: BX, width: imo * PX, top: 166, textAlign: "center", fontFamily: FONT, fontSize: 40, fontWeight: 900, color: P.ink, whiteSpace: "nowrap", opacity: split }}>妹 1人分</div>
      <div style={{ position: "absolute", left: BX + imo * PX, width: 800 * PX, top: 166, textAlign: "center", fontFamily: FONT, fontSize: 40, fontWeight: 900, color: P.goldInk, whiteSpace: "nowrap", opacity: split }}>差 800円 ＝ 妹 1人分</div>
      <div style={{ position: "absolute", left: BX, top: 640, opacity: res }}>
        <T size={64}>妹 ＝ <span style={{ color: P.goldInk }}>800円</span>　→　もらったのは <span style={{ color: P.red }}>400円</span></T>
        <div style={{ marginTop: 12, fontFamily: FONT, fontSize: 34, fontWeight: 700, color: P.muted }}>たしかめ：姉 1600円 ＝ 妹 800円 × 2</div>
      </div>
    </>
  );
}

function RoutesA({ c }: { c: Record<string, Cue> }) {
  const f = useCurrentFrame();
  const t2 = c.ta02.from, t3 = c.ta03.from;
  const eq = ["もらった金額を x 円とすると", "1200 ＋ x ＝ 2 ×（400 ＋ x）", "1200 ＋ x ＝ 800 ＋ 2x", "x ＝ 400"];
  const rows = [["100円", "1300", "500", "×"], ["200円", "1400", "600", "×"], ["300円", "1500", "700", "×"], ["400円", "1600", "800", "○"]];
  const dim = interpolate(f, [t3 + 10, t3 + 30], [1, 0.45], clamp);
  const badge = usePop(t3 + 14, 12);
  const panel = (left: number, title: string, body: ReactNode) => (
    <div style={{ position: "absolute", left, top: 150, width: 760, height: 620, background: P.sheet, border: `2px solid ${P.line}`, borderRadius: 18, padding: "34px 40px", boxShadow: "0 10px 30px rgba(31,42,68,0.08)", opacity: dim }}>
      <Kick>{title}</Kick>
      <div style={{ marginTop: 24 }}>{body}</div>
    </div>
  );
  return (
    <>
      {panel(150, "大人のやり方", eq.map((e, i) => (
        <div key={i} style={{ fontFamily: FONT, fontSize: i ? 46 : 34, fontWeight: i ? 800 : 700, color: i ? P.ink : P.muted, marginTop: i ? 26 : 0, opacity: appear(f, t2 + s(0.3 + i * 0.9)) }}>{e}</div>
      )))}
      {panel(1010, "子どものやり方", (
        <div style={{ fontFamily: FONT, fontSize: 40, fontWeight: 800, color: P.pencil }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 0.5fr", color: P.muted, fontSize: 30 }}><span>もらう</span><span>姉</span><span>妹</span><span /></div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 0.5fr", marginTop: 22, opacity: appear(f, t2 + s(1.6 + i * 0.8)) }}>
              {r.map((x, j) => <span key={j} style={{ color: j === 3 ? (x === "○" ? "#3f8f62" : P.red) : undefined }}>{x}</span>)}
            </div>
          ))}
        </div>
      ))}
      <div style={{ position: "absolute", left: 0, right: 0, top: 820, textAlign: "center", opacity: Math.min(1, badge), transform: `scale(${0.8 + 0.2 * Math.min(1, badge)})` }}>
        <span style={{ display: "inline-block", background: P.red, color: "#fff", fontFamily: FONT, fontWeight: 900, fontSize: 44, borderRadius: 999, padding: "8px 40px" }}>どちらも、時間がかかる</span>
      </div>
    </>
  );
}

const LENSES = ["和差一定", "面積図", "てんびん", "折り返す", "囲む", "等積変形", "展開", "止める"];
function LensIntro({ from, clip, mark }: { from: number; clip: string; mark: string }) {
  const f = useCurrentFrame();
  return (
    <>
      <div style={{ position: "absolute", left: 130, top: 170, width: 660 }}>
        <div style={{ opacity: appear(f, from) }}>
          <div style={{ width: 110, height: 110, borderRadius: "50%", border: `12px solid ${P.gold}`, boxShadow: "0 0 40px rgba(227,165,28,0.55)", background: P.goldSoft }} />
          <T size={96} style={{ marginTop: 22 }}>視点レンズ</T>
          <div style={{ marginTop: 8, fontFamily: FONT, fontSize: 38, fontWeight: 800, color: P.muted }}>「見る場所」を、8つの型で練習する。</div>
        </div>
        <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {LENSES.map((n, i) => (
            <div key={n} style={{ opacity: appear(f, from + s(0.6 + i * 0.15)) }}>
              <Chip on={n === mark} style={{ fontSize: 30, padding: "10px 0", width: "100%", textAlign: "center" }}>{n}</Chip>
            </div>
          ))}
        </div>
      </div>
      <Screen clip={clip} segs={[{ from, to: from + s(14), a: 0.3, b: 13 }]} width={960} camera={false} sfx={false} style={{ left: 840, top: 150 }} glow="rgba(227,165,28,0.28)" />
    </>
  );
}

export function TestA() {
  const f = useCurrentFrame();
  const c = A.cues;
  const pauseAt = c.ta01.from + c.ta01.dur + s(0.3);
  return (
    <AbsoluteFill style={{ background: P.paper }}>
      <PaperBg />
      <Scene from={0} to={c.ta02.from - 6}>
        <div style={{ position: "absolute", left: 130, top: 190, width: 1380, background: P.sheet, borderRadius: 20, padding: "50px 60px", boxShadow: "0 14px 40px rgba(31,42,68,0.1)", border: `2px solid ${P.line}` }}>
          <Kick>小学5年生の算数</Kick>
          <T size={54} style={{ marginTop: 26 }}>
            姉は <span style={{ color: P.pencil }}>1200円</span>、妹は <span style={{ color: "#c8574b" }}>400円</span> 持っています。<br />
            2人が同じ金額ずつおこづかいをもらうと、<br />
            姉の金額は、ちょうど妹の <span style={{ color: P.red }}>2倍</span> になりました。<br />
            <span style={{ display: "inline-block", marginTop: 18 }}>いくらずつ、もらったでしょう？</span>
          </T>
        </div>
        <ThinkRing at={pauseAt} sec={5} />
      </Scene>
      <Scene from={c.ta02.from} to={c.ta04.from - 6}>
        <RoutesA c={c} />
      </Scene>
      <Scene from={c.ta04.from} to={c.ta08.from - 6}>
        <BarsA c={c} />
      </Scene>
      <Scene from={c.ta08.from} to={c.ta09.from - 6}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 260, textAlign: "center" }}>
          <div style={{ opacity: appear(f, c.ta08.from) }}><Kick>計算は、1行</Kick></div>
          <T size={72} style={{ marginTop: 26, opacity: appear(f, c.ta08.from + 6) }}>1200 − 400 ＝ 800　→　800 − 400 ＝ 400</T>
          <T size={64} color={P.goldInk} style={{ marginTop: 60, opacity: appear(f, c.ta08.from + s(2.2)) }}>違いは、計算力ではなく、どこを見るか。</T>
        </div>
      </Scene>
      <Scene from={c.ta09.from} to={c.ta10.from - 6}>
        <LensIntro from={c.ta09.from} clip="lens_master_constant" mark="和差一定" />
      </Scene>
      <Scene from={c.ta10.from} to={A.end + END_HOLD}>
        <Cta from={c.ta10.from} />
      </Scene>
      <Sequence from={A.end + END_HOLD} durationInFrames={END_CARD}>
        <EndCard line="見る場所を、変える。" />
      </Sequence>
      <Sfx at={c.ta04.from} src="chime" volume={0.25} />
      <Sfx at={c.ta07.from} src="pop" volume={0.25} />
      <Voices cues={c} />
      <Music cues={c} total={TEST_A_FRAMES} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- B「大人も引っかかる」

const OX = 380, BASE = 830, HX = 230, VY = 6.2; // origin, px per hour, px per km/h
function AreaB({ c }: { c: Record<string, Cue> }) {
  const f = useCurrentFrame();
  const t5 = c.tb05.from, t6 = c.tb06.from, t7 = c.tb07.from;
  const road = appear(f, t5);
  const r1 = appear(f, t5 + s(2.0), 18), r2 = appear(f, t5 + s(3.6), 18);
  const hi = appear(f, t6) * (1 - appear(f, t7));
  const lv = interpolate(f, [t7 + s(0.6), t7 + s(2.4)], [0, 1], { ...clamp, easing: ease });
  const h1 = 60 * (1 - lv) + 48 * lv, h2 = 40 * (1 - lv) + 48 * lv;
  const lab = appear(f, t7 + s(2.6));
  const box = (x0: number, w: number, h: number, col: string, o: number) => (
    <div style={{ position: "absolute", left: OX + x0 * HX, top: BASE - h * VY * o, width: w * HX, height: h * VY * o, background: col, border: `4px solid ${P.ink}`, boxSizing: "border-box", opacity: Math.min(1, o * 1.5) }} />
  );
  return (
    <>
      {/* the road */}
      <div style={{ position: "absolute", left: 300, right: 300, top: 110, opacity: road }}>
        <div style={{ position: "relative", height: 120 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 56, height: 8, background: P.ink, borderRadius: 4 }} />
          <div style={{ position: "absolute", left: -20, top: 40, width: 40, height: 40, borderRadius: "50%", background: P.ink }} />
          <div style={{ position: "absolute", right: -20, top: 40, width: 40, height: 40, borderRadius: "50%", background: P.ink }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: -6, textAlign: "center", fontFamily: FONT, fontSize: 40, fontWeight: 900, color: P.ink }}>片道 120 km</div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 80, display: "flex", justifyContent: "space-around", fontFamily: FONT, fontSize: 36, fontWeight: 800 }}>
            <span style={{ color: P.pencil, opacity: r1 }}>行き 60 km/h → 2時間</span>
            <span style={{ color: "#c8574b", opacity: r2 }}>帰り 40 km/h → 3時間</span>
          </div>
        </div>
      </div>
      {/* axes */}
      <div style={{ position: "absolute", left: OX, top: BASE, width: 5 * HX + 40, height: 4, background: P.ink, opacity: r1 }} />
      <div style={{ position: "absolute", left: OX, top: BASE - 64 * VY, width: 4, height: 64 * VY, background: P.ink, opacity: r1 }} />
      <div style={{ position: "absolute", left: OX - 30, top: BASE - 66 * VY - 52, fontFamily: FONT, fontSize: 30, fontWeight: 800, color: P.muted, opacity: r1 }}>速さ</div>
      <div style={{ position: "absolute", left: OX + 5 * HX + 50, top: BASE - 22, fontFamily: FONT, fontSize: 30, fontWeight: 800, color: P.muted, opacity: r1 }}>時間</div>
      {[0, 2, 5].map((h) => (
        <div key={h} style={{ position: "absolute", left: OX + h * HX - 80, width: 160, textAlign: "center", top: BASE + 12, fontFamily: FONT, fontSize: 32, fontWeight: 800, color: P.ink, opacity: r1 }}>{h}時間</div>
      ))}
      {box(0, 2, h1, "rgba(77,93,138,0.75)", r1)}
      {box(2, 3, h2, "rgba(229,138,127,0.8)", r2)}
      {lv < 0.5 && (
        <>
          <div style={{ position: "absolute", left: OX, width: 2 * HX, top: BASE - h1 * VY / 2 - 26, textAlign: "center", fontFamily: FONT, fontSize: 40, fontWeight: 900, color: "#fff", opacity: r1 * (1 - lv * 2) }}>60×2＝120</div>
          <div style={{ position: "absolute", left: OX + 2 * HX, width: 3 * HX, top: BASE - h2 * VY / 2 - 26, textAlign: "center", fontFamily: FONT, fontSize: 40, fontWeight: 900, color: "#fff", opacity: r2 * (1 - lv * 2) }}>40×3＝120</div>
        </>
      )}
      {/* the long, slow trip */}
      <div style={{ position: "absolute", left: OX + 2 * HX - 6, top: BASE - 40 * VY - 6, width: 3 * HX + 12, height: 40 * VY + 12, border: `8px solid ${P.gold}`, borderRadius: 10, boxShadow: "0 0 30px rgba(227,165,28,0.5)", opacity: hi }} />
      <div style={{ position: "absolute", left: OX + 2 * HX, width: 3 * HX, top: BASE - 40 * VY - 70, textAlign: "center", fontFamily: FONT, fontSize: 38, fontWeight: 900, color: P.goldInk, opacity: hi }}>長い時間、遅く走る</div>
      {/* levelled: 48, with 50 dashed for comparison */}
      <div style={{ position: "absolute", left: OX, top: BASE - 50 * VY, width: 5 * HX, borderTop: `5px dashed ${P.red}`, opacity: lab }} />
      <div style={{ position: "absolute", left: OX + 5 * HX + 16, top: BASE - 50 * VY - 30, fontFamily: FONT, fontSize: 34, fontWeight: 900, color: P.red, opacity: lab }}>50 ではない</div>
      <div style={{ position: "absolute", left: OX + 5 * HX + 16, top: BASE - 48 * VY + 6, fontFamily: FONT, fontSize: 40, fontWeight: 900, color: P.goldInk, opacity: lab }}>48</div>
      <div style={{ position: "absolute", left: OX, width: 5 * HX, top: BASE - 50 * VY - 84, textAlign: "center", fontFamily: FONT, fontSize: 46, fontWeight: 900, color: P.ink, opacity: lab }}>240 km ÷ 5時間 ＝ 時速48 km</div>
    </>
  );
}

export function TestB() {
  const f = useCurrentFrame();
  const c = B.cues;
  const cd = c.tb02.from + c.tb02.dur + s(0.2);
  const wrong = appear(f, c.tb03.from);
  const cross = appear(f, c.tb04.from, 10);
  const right = usePop(c.tb04.from + 16, 11);
  return (
    <AbsoluteFill style={{ background: P.paper }}>
      <PaperBg />
      <Scene from={0} to={c.tb03.from - 6}>
        <div style={{ position: "absolute", left: 160, top: 200, width: 1250, opacity: appear(f, 0) }}>
          <Kick>大人のみなさんへ、1問</Kick>
          <T size={72} style={{ marginTop: 30 }}>
            行きは <span style={{ color: P.pencil }}>時速60km</span>、<br />
            帰りは <span style={{ color: "#c8574b" }}>時速40km</span>。<br />
            往復の平均の速さは？
          </T>
        </div>
        <ThinkRing at={cd} sec={3} label="3秒で" count />
      </Scene>
      <Scene from={c.tb03.from} to={c.tb05.from - 6}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 250, textAlign: "center" }}>
          <div style={{ display: "inline-block", position: "relative", opacity: wrong }}>
            <T size={180} color={P.trap}>時速50km？</T>
            <div style={{ position: "absolute", left: -10, right: -10, top: "52%", height: 14, background: P.red, borderRadius: 7, transform: `scaleX(${cross})`, transformOrigin: "0 50%" }} />
          </div>
          <div style={{ marginTop: 30, opacity: Math.min(1, right), transform: `scale(${0.7 + 0.3 * Math.min(1, right)})` }}>
            <T size={120} color={P.goldInk}>正解は 時速48km</T>
          </div>
        </div>
      </Scene>
      <Scene from={c.tb05.from} to={c.tb08.from - 6}>
        <AreaB c={c} />
      </Scene>
      <Scene from={c.tb08.from} to={c.tb09.from - 6}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 290, textAlign: "center" }}>
          <T size={104} style={{ opacity: appear(f, c.tb08.from) }}>大人でも、引っかかる。</T>
          <T size={56} color={P.muted} style={{ marginTop: 40, opacity: appear(f, c.tb08.from + s(2.0)) }}>だから、子どもが問題の前で止まるのは、不思議ではない。</T>
        </div>
      </Scene>
      <Scene from={c.tb09.from} to={c.tb10.from - 6}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 230, textAlign: "center" }}>
          <T size={80} style={{ opacity: appear(f, c.tb09.from) }}>解き方の暗記より、<span style={{ color: P.goldInk }}>図にして見る。</span></T>
          <div style={{ marginTop: 60, opacity: appear(f, c.tb09.from + s(3.6)) }}>
            <div style={{ display: "inline-block", width: 110, height: 110, borderRadius: "50%", border: `12px solid ${P.gold}`, boxShadow: "0 0 40px rgba(227,165,28,0.55)", background: P.goldSoft, verticalAlign: "middle" }} />
            <span style={{ fontFamily: FONT, fontSize: 84, fontWeight: 900, color: P.ink, marginLeft: 30, verticalAlign: "middle" }}>面積図のレンズ</span>
          </div>
        </div>
      </Scene>
      <Scene from={c.tb10.from} to={c.ta10.from - 6}>
        <LensIntro from={c.tb10.from} clip="lens_drill" mark="面積図" />
      </Scene>
      <Scene from={c.ta10.from} to={B.end + END_HOLD}>
        <Cta from={c.ta10.from} />
      </Scene>
      <Sequence from={B.end + END_HOLD} durationInFrames={END_CARD}>
        <EndCard line="見る場所を、変える。" />
      </Sequence>
      {[0, 1, 2].map((i) => <Sfx key={i} at={cd + s(i)} src="tick" volume={0.3} />)}
      <Sfx at={c.tb04.from + 16} src="chime" volume={0.3} />
      <Voices cues={c} />
      <Music cues={c} total={TEST_B_FRAMES} />
    </AbsoluteFill>
  );
}
