import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { FONT, Screen, Sfx, clamp, ease } from "../v2/kit";
import { EndCard, P } from "./kit";
import durations from "./durations.json";
import narr from "../../../lens-narration.json";

/**
 * 視点レンズ absurd-comedy Shorts (1080×1920, ~50 s), one per Pass, all on the 「折り返す」 lens.
 * A deadpan announcer narrates an escalating brute-force disaster as if it were news; then everything freezes,
 * the lens folds the problem, one straight line solves it. The maths is real; only the situation is absurd.
 * No product name until the tag line, no price, no score promise. Captions stay above y 1440 and left of x 920.
 */
export type ZanyProps = { stage: "ca" | "cb" | "cc" };
const D = durations as Record<string, number>;
const TEXT = Object.fromEntries((narr as { lines: { id: string; text: string }[] }).lines.map((l) => [l.id, l.text]));
const s = (sec: number) => Math.round(sec * 30);
const EMOJI = '"Noto Color Emoji"';

type Cue = { id: string; text: string; from: number; dur: number };
function plan(seq: [string, number][]) {
  let t = 0;
  const cues: Record<string, Cue> = {};
  for (const [id, gap] of seq) {
    t += gap;
    cues[id] = { id, text: TEXT[id], from: s(t), dur: s(D[id] ?? 1) };
    t += D[id] ?? 1;
  }
  return { cues, end: s(t) };
}
const SEQ: Record<ZanyProps["stage"], [string, number][]> = {
  ca: [["z101", 0.4], ["z102", 0.5], ["z103", 0.3], ["z104", 0.3], ["z105", 0.3], ["z106", 0.3], ["z107", 0.3], ["z108", 0.9], ["z109", 1.0], ["z110", 0.4], ["z111", 0.7], ["z112", 0.6], ["zp1", 1.0], ["zp2", 0.4], ["zp3", 0.5], ["zp4", 0.5], ["zend", 0.8]],
  cb: [["z201", 0.4], ["z202", 0.4], ["z203", 0.3], ["z204", 0.3], ["z205", 0.3], ["z206", 0.3], ["z207", 0.3], ["z208", 1.0], ["z209", 0.5], ["z210", 0.5], ["z211", 0.6], ["zp1", 1.0], ["zp2", 0.4], ["zp3", 0.5], ["zp4", 0.5], ["zend", 0.8]],
  cc: [["z301", 0.4], ["z302", 0.4], ["z303", 0.3], ["z304", 0.3], ["z305", 0.3], ["z306", 0.3], ["z307", 0.4], ["z308", 0.9], ["z309", 1.0], ["z310", 0.5], ["z311", 0.6], ["zp1", 1.0], ["zp2", 0.4], ["zp3", 0.5], ["zp4", 0.5], ["zend", 0.8]],
};
const END_CARD = s(3.4);
export const zanyFrames = (p: ZanyProps) => plan(SEQ[p.stage]).end + s(1.2) + END_CARD;

// ---------------------------------------------------------------- tiny comedy kit

/** frames since `at` (negative before) */
const since = (f: number, at: number) => f - at;
function pop(f: number, at: number, damping = 9) {
  return f < at ? 0 : spring({ frame: f - at, fps: 30, config: { damping, stiffness: 180 } });
}
function E({ c, x, y, size = 160, at, anim = "pop", style }: { c: string; x: number; y: number; size?: number; at: number; anim?: "pop" | "bounce" | "float" | "spin" | "shake" | "drop"; style?: CSSProperties }) {
  const f = useCurrentFrame();
  if (f < at) return null;
  const t = since(f, at);
  const p = pop(f, at);
  let tf = `scale(${p})`;
  if (anim === "bounce") tf = `translateY(${-Math.abs(Math.sin(t / 5)) * 40}px) scale(${p})`;
  if (anim === "float") tf = `translateY(${-t * 1.6}px) rotate(${Math.sin(t / 8) * 6}deg) scale(${p})`;
  if (anim === "spin") tf = `rotate(${t * 18}deg) scale(${p})`;
  if (anim === "shake") tf = `translateX(${Math.sin(t * 1.7) * 14}px) rotate(${Math.sin(t) * 8}deg) scale(${p})`;
  if (anim === "drop") tf = `translateY(${Math.min(0, -900 + t * 70)}px) rotate(${Math.min(0, -40 + t * 4)}deg)`;
  return <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, fontSize: size * 0.82, lineHeight: `${size}px`, textAlign: "center", fontFamily: EMOJI, transform: tf, ...style }}>{c}</div>;
}
function Stamp({ text, at, x = 120, y = 260, color = P.red, size = 96, rot = -8 }: { text: string; at: number; x?: number; y?: number; color?: string; size?: number; rot?: number }) {
  const f = useCurrentFrame();
  if (f < at) return null;
  const p = interpolate(f, [at, at + 6], [2.2, 1], { ...clamp, easing: ease });
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `rotate(${rot}deg) scale(${p})`, transformOrigin: "0 0", border: `10px solid ${color}`, color, borderRadius: 18, padding: "4px 28px", fontFamily: FONT, fontWeight: 900, fontSize: size, background: "rgba(255,255,255,0.75)", opacity: interpolate(f, [at, at + 3], [0, 1], clamp) }}>{text}</div>
  );
}
function Caption({ cue, dark }: { cue: Cue; dark?: boolean }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [cue.from, cue.from + 4, cue.from + cue.dur + 4, cue.from + cue.dur + 10], [0, 1, 1, 0], clamp);
  if (o <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 50, width: 860, top: 1270, fontFamily: FONT, fontWeight: 900, fontSize: 52, lineHeight: 1.3, color: dark ? "#fff" : P.ink, opacity: o, textShadow: dark ? "0 4px 16px rgba(0,0,0,0.5)" : "0 0 18px #fff, 0 0 8px #fff" }}>{cue.text}</div>
  );
}
/** news-style lower ribbon so the deadpan reads as a broadcast */
function Ribbon({ text, until }: { text: string; until: number }) {
  const f = useCurrentFrame();
  if (f > until) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 90, height: 84, background: P.red, color: "#fff", fontFamily: FONT, fontWeight: 900, fontSize: 44, display: "flex", alignItems: "center", paddingLeft: 40, gap: 24 }}>
      <span style={{ background: "#fff", color: P.red, borderRadius: 8, padding: "0 14px" }}>速報</span>
      {text}
    </div>
  );
}
/** zany background: a new flat colour on every beat until the freeze, then calm paper */
const BG = ["#ffe066", "#8ce99a", "#74c0fc", "#ffa8a8", "#d0bfff", "#ffd8a8", "#99e9f2", "#fcc2d7"];
function Backdrop({ cues, freeze }: { cues: Cue[]; freeze: number }) {
  const f = useCurrentFrame();
  if (f >= freeze) {
    const g = interpolate(f, [freeze, freeze + 8], [0, 1], clamp);
    return <AbsoluteFill style={{ background: `rgba(253,252,248,${g})`, backgroundColor: g < 1 ? "#ccc" : P.paper }} />;
  }
  const i = Math.max(0, cues.filter((c) => c.from <= f).length - 1);
  return (
    <AbsoluteFill style={{ background: BG[i % BG.length] }}>
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(0,0,0,0.08) 3px, transparent 3px)", backgroundSize: "40px 40px", transform: `translateY(${(f * 2) % 40}px)` }} />
    </AbsoluteFill>
  );
}
function Shake({ on, children }: { on: boolean; children: ReactNode }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ transform: on ? `translate(${Math.sin(f * 2.1) * 8}px, ${Math.cos(f * 1.7) * 6}px)` : undefined }}>{children}</AbsoluteFill>;
}
function Lens({ at }: { at: number }) {
  const f = useCurrentFrame();
  const p = pop(f, at, 12);
  const o = interpolate(f, [at, at + 6, at + s(1.1), at + s(1.5)], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ display: "grid", placeItems: "center", opacity: o }}>
      <div style={{ width: 420, height: 420, borderRadius: "50%", border: `30px solid ${P.gold}`, boxShadow: `0 0 ${120 * p}px rgba(227,165,28,0.8)`, transform: `scale(${p})` }} />
    </AbsoluteFill>
  );
}
function draw(f: number, at: number, d = 18) {
  return interpolate(f, [at, at + d], [0, 1], { ...clamp, easing: ease });
}
const Tx = ({ x, y, children, size = 46, color = P.ink, anchor = "middle" }: { x: number; y: number; children: ReactNode; size?: number; color?: string; anchor?: "start" | "middle" | "end" }) => (
  <text x={x} y={y} textAnchor={anchor} fontFamily={FONT} fontWeight={900} fontSize={size} fill={color}>{children}</text>
);

// ---------------------------------------------------------------- ① 中学受験: the river

// map: river y = 0 line; A 300 m above, B 500 m above, 600 m apart. 1 m = 0.9 px. River at screen y 980.
const RX = (m: number) => 150 + m * 0.9, RY = (m: number) => 980 - m * 0.9;
const A1 = { x: 0, y: 300 }, B1 = { x: 600, y: 500 }, Bp1 = { x: 600, y: -500 }, P1 = { x: 225, y: 0 }; // P: 300/800 × 600 = 225
function RiverMap({ c, freeze }: { c: Record<string, Cue>; freeze: number }) {
  const f = useCurrentFrame();
  const calm = f >= freeze;
  const routes = Array.from({ length: 37 }, (_, i) => {
    const px = ((i * 53) % 600) + (i % 3) * 7;
    const wob = (i * 37) % 120 - 60;
    return `M${RX(A1.x)},${RY(A1.y)} Q${RX(px / 2 + wob)},${RY(150 + wob)} ${RX(px)},${RY(0)} T${RX(B1.x)},${RY(B1.y)}`;
  });
  const nRoutes = calm ? 0 : Math.floor(interpolate(f, [c.z102.from + 10, c.z103.from + 20], [0, 37], clamp));
  const shrink = calm ? 1 : interpolate(f, [c.z104.from, c.z104.from + 30, c.z105.from], [1, 0.55, 0.55], clamp) || 1;
  const riverShift = calm ? 0 : f >= c.z107.from ? Math.min(400, (f - c.z107.from) * 9) : 0;
  const flip = draw(f, c.z109.from + 8, 24);
  const line = draw(f, c.z110.from, 20);
  return (
    <AbsoluteFill style={{ transform: `scale(${f >= c.z104.from && !calm ? (f < c.z105.from ? shrink : 0.55) : 1})`, transformOrigin: "50% 45%" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <rect x={0} y={RY(0)} width={1080} height={90} fill="#4dabf7" transform={`translate(${riverShift} 0)`} />
        <Tx x={980 + riverShift * 0} y={RY(0) + 64} size={40} color="#fff" anchor="end">川</Tx>
        {!calm && routes.slice(0, nRoutes).map((d, i) => <path key={i} d={d} fill="none" stroke={["#e03131", "#2f9e44", "#1971c2", "#f08c00"][i % 4]} strokeWidth={6} opacity={0.75} />)}
        {calm && (
          <>
            <line x1={RX(B1.x)} y1={RY(B1.y)} x2={RX(Bp1.x)} y2={RY(B1.y + (Bp1.y - B1.y) * flip)} stroke={P.trap} strokeWidth={5} strokeDasharray="14 10" />
            <circle cx={RX(Bp1.x)} cy={RY(B1.y + (Bp1.y - B1.y) * flip)} r={18} fill={P.gold} opacity={flip} />
            {flip > 0.95 && <Tx x={RX(Bp1.x) + 70} y={RY(Bp1.y) + 16} size={52} color={P.goldInk}>B'</Tx>}
            <line x1={RX(A1.x)} y1={RY(A1.y)} x2={RX(A1.x + (Bp1.x - A1.x) * line)} y2={RY(A1.y + (Bp1.y - A1.y) * line)} stroke={P.gold} strokeWidth={12} strokeLinecap="round" />
            {line > 0.4 && <line x1={RX(P1.x)} y1={RY(0)} x2={RX(B1.x)} y2={RY(B1.y)} stroke={P.red} strokeWidth={12} strokeLinecap="round" opacity={Math.min(1, (line - 0.4) * 3)} />}
            {line > 0.4 && <circle cx={RX(P1.x)} cy={RY(0)} r={20} fill={P.red} />}
          </>
        )}
      </svg>
      <E c="🏠" x={RX(A1.x)} y={RY(A1.y) - 40} size={150} at={c.z101.from} />
      <E c="🏫" x={RX(B1.x)} y={RY(B1.y) - 40} size={150} at={c.z101.from + 6} />
      {calm && <div style={{ position: "absolute", left: RX(A1.x) - 30, top: RY(A1.y) + 30, fontFamily: FONT, fontWeight: 900, fontSize: 54, color: P.ink }}>A</div>}
      {calm && <div style={{ position: "absolute", left: RX(B1.x) + 70, top: RY(B1.y) - 70, fontFamily: FONT, fontWeight: 900, fontSize: 54, color: P.ink }}>B</div>}
    </AbsoluteFill>
  );
}
function RiverShort({ c, freeze }: { c: Record<string, Cue>; freeze: number }) {
  const f = useCurrentFrame();
  const calm = f >= freeze;
  return (
    <>
      <Shake on={!calm && f >= c.z106.from}>
        <RiverMap c={c} freeze={freeze} />
        {!calm && (
          <>
            {f < c.z104.from && <E c="🧒" x={300} y={760} size={170} at={c.z102.from} anim="bounce" />}
            <E c="🧒" x={740} y={740} size={150} at={c.z104.from} anim="float" />
            {f >= c.z104.from && <E c="🎈" x={740} y={600} size={190} at={c.z104.from} anim="float" />}
            <E c="👷" x={640} y={1150} size={150} at={c.z105.from} anim={f >= c.z106.from ? "shake" : "bounce"} />
            <E c="👷" x={780} y={1100} size={150} at={c.z105.from + 5} anim={f >= c.z106.from ? "shake" : "bounce"} />
            <E c="👷" x={920} y={1160} size={150} at={c.z105.from + 10} anim={f >= c.z106.from ? "shake" : "bounce"} />
            <E c="📐" x={500} y={420} size={140} at={c.z105.from + 14} anim="spin" />
            <E c="😭" x={780} y={880} size={260} at={c.z106.from + 4} anim="shake" />
            <E c="🧳" x={900} y={1020} size={170} at={c.z107.from + 6} anim="bounce" />
            <E c="🌊" x={700} y={1020} size={150} at={c.z107.from} anim="shake" />
          </>
        )}
        {!calm && (
          <>
            <Stamp text="1日目　37本" at={c.z103.from} x={100} y={220} />
            <Stamp text="2日目" at={c.z104.from} x={160} y={330} rot={6} />
            <Stamp text="3日目" at={c.z105.from} x={120} y={300} rot={-4} />
            <Stamp text="4日目" at={c.z106.from} x={180} y={330} rot={7} />
            <Stamp text="5日目" at={c.z107.from} x={130} y={290} rot={-9} />
          </>
        )}
      </Shake>
      {calm && f >= c.z111.from && (
        <div style={{ position: "absolute", left: 60, top: 260, fontFamily: FONT, fontWeight: 900, fontSize: 70, color: P.goldInk, opacity: draw(f, c.z111.from) }}>1000 m ＝ 歩いて12分半</div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- ② 高校受験: the committee

// coordinates: A(1,3), B(5,1), B'(5,−1), P(4,0); 1 unit = 140 px, origin at (150, 980)
const GX = (x: number) => 150 + x * 140, GY = (y: number) => 980 - y * 140;
const FORMULA = "√((p−1)²+9) + √((p−5)²+1)";
const DERIV = "(p−1)/√((p−1)²+9) + (p−5)/√((p−5)²+1) = 0 ⇔ (p−1)²((p−5)²+1) = (p−5)²((p−1)²+9) ⇔ ";
function Committee({ c, freeze }: { c: Record<string, Cue>; freeze: number }) {
  const f = useCurrentFrame();
  const calm = f >= freeze;
  if (calm) {
    const fl = draw(f, c.z208.from + s(1.6), 22);
    const ln = draw(f, c.z209.from, 22);
    return (
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <line x1={60} y1={GY(0)} x2={1040} y2={GY(0)} stroke={P.ink} strokeWidth={5} />
        <line x1={GX(0)} y1={GY(-2)} x2={GX(0)} y2={GY(4.2)} stroke={P.ink} strokeWidth={5} />
        <Tx x={1030} y={GY(0) - 18} size={40} anchor="end">x</Tx>
        <circle cx={GX(1)} cy={GY(3)} r={16} fill={P.ink} /><Tx x={GX(1)} y={GY(3) - 34} size={48}>A</Tx>
        <circle cx={GX(5)} cy={GY(1)} r={16} fill={P.ink} /><Tx x={GX(5) + 50} y={GY(1) - 10} size={48}>B</Tx>
        <line x1={GX(5)} y1={GY(1)} x2={GX(5)} y2={GY(1 - 2 * fl)} stroke={P.trap} strokeWidth={5} strokeDasharray="12 10" />
        <circle cx={GX(5)} cy={GY(1 - 2 * fl)} r={16} fill={P.gold} opacity={fl} />
        {fl > 0.95 && <Tx x={GX(5) + 60} y={GY(-1) + 16} size={48} color={P.goldInk}>B'</Tx>}
        <line x1={GX(1)} y1={GY(3)} x2={GX(1 + 4 * ln)} y2={GY(3 - 4 * ln)} stroke={P.gold} strokeWidth={11} strokeLinecap="round" />
        {ln > 0.8 && (
          <>
            <line x1={GX(4)} y1={GY(0)} x2={GX(5)} y2={GY(1)} stroke={P.red} strokeWidth={11} strokeLinecap="round" />
            <circle cx={GX(4)} cy={GY(0)} r={20} fill={P.red} />
            <Tx x={GX(4) - 10} y={GY(0) + 70} size={56} color={P.red}>P(4, 0)</Tx>
          </>
        )}
        {f >= c.z210.from && <Tx x={540} y={1180} size={72} color={P.goldInk}>最小値 ＝ 4√2</Tx>}
      </svg>
    );
  }
  const grow = f >= c.z203.from ? Math.floor((f - c.z203.from) * 1.6) : 0;
  const text = FORMULA + (grow ? "  ⇒  " + DERIV.repeat(8).slice(0, grow) : "");
  const zoom = f >= c.z205.from ? interpolate(f, [c.z205.from, c.z206.from + 20], [1, 0.42], clamp) : 1;
  return (
    <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "50% 40%" }}>
      {/* whiteboard, then everything */}
      <div style={{ position: "absolute", left: 80, top: 330, width: 920, height: 520, background: "#fff", border: `10px solid ${P.ink}`, borderRadius: 14 }} />
      <div style={{ position: "absolute", left: 110, top: 360, width: f >= c.z204.from ? 920 + (f - c.z204.from) * 30 : 860, fontFamily: FONT, fontWeight: 800, fontSize: 40, lineHeight: 1.5, color: P.ink, wordBreak: "break-all", opacity: f >= c.z202.from ? 1 : 0 }}>{text}</div>
      {f >= c.z205.from && (
        <div style={{ position: "absolute", left: -1400, top: -1600, width: 3900, height: 5200, fontFamily: FONT, fontWeight: 800, fontSize: 40, lineHeight: 1.5, color: "rgba(31,42,68,0.55)", wordBreak: "break-all", overflow: "hidden" }}>{DERIV.repeat(160).slice(0, (f - c.z205.from) * 220)}</div>
      )}
      <E c="🚨" x={540} y={240} size={150} at={c.z201.from} anim="shake" />
      <E c="🧑‍💼" x={190} y={1000} size={170} at={c.z201.from + 4} anim={f >= c.z204.from ? "shake" : "bounce"} />
      <E c="👩‍💼" x={420} y={1020} size={170} at={c.z201.from + 8} anim={f >= c.z204.from ? "shake" : "bounce"} />
      <E c="🧑‍💼" x={650} y={1000} size={170} at={c.z201.from + 12} anim={f >= c.z204.from ? "shake" : "bounce"} />
      <E c="👨‍💼" x={880} y={1020} size={170} at={c.z201.from + 16} anim={f >= c.z204.from ? "shake" : "bounce"} />
      <E c="🏢" x={-500} y={700} size={600} at={c.z206.from} />
      <E c="🏢" x={1600} y={700} size={600} at={c.z206.from + 6} />
      <E c="🛸" x={540} y={-300} size={700} at={c.z207.from} anim="bounce" />
      <E c="👽" x={540} y={150} size={300} at={c.z207.from + 14} anim="shake" />
    </AbsoluteFill>
  );
}
function CommitteeShort({ c, freeze }: { c: Record<string, Cue>; freeze: number }) {
  const f = useCurrentFrame();
  const calm = f >= freeze;
  return (
    <>
      <Shake on={!calm && f >= c.z204.from}>
        <Committee c={c} freeze={freeze} />
        {!calm && <Stamp text="緊急会議" at={c.z201.from + 6} x={300} y={200} rot={-5} size={84} />}
      </Shake>
      {calm && f < c.z209.from && <E c="🧑" x={880} y={440} size={170} at={c.z208.from + 4} anim="bounce" />}
      {calm && f < c.z209.from && <div style={{ position: "absolute", left: 800, top: 540, fontFamily: FONT, fontWeight: 900, fontSize: 40, color: P.ink }}>新人</div>}
      {f >= c.z211.from && (
        <>
          <E c="😶" x={240} y={430} size={180} at={c.z211.from} />
          <E c="😶" x={460} y={420} size={180} at={c.z211.from + 3} />
          <E c="😶" x={680} y={430} size={180} at={c.z211.from + 6} />
          <Stamp text="0.5秒" at={c.z211.from + 10} x={600} y={1430} rot={-6} size={80} />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------- ③ 大学受験: the search party

// A(4,3), line x + y = 2, foot / midpoint M(1.5, 0.5), A'(−1,−2); 1 unit = 120 px, origin at (440, 820)
const HX = (x: number) => 440 + x * 120, HY = (y: number) => 820 - y * 120;
function SearchShort({ c, freeze }: { c: Record<string, Cue>; freeze: number }) {
  const f = useCurrentFrame();
  const calm = f >= freeze;
  const perp = draw(f, c.z309.from, 24);
  const found = draw(f, c.z310.from, 12);
  const lineEnds = [[-2.8, 4.8], [4.6, -2.6]];
  const grid = (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <line x1={40} y1={HY(0)} x2={1040} y2={HY(0)} stroke={P.ink} strokeWidth={4} />
      <line x1={HX(0)} y1={HY(-3.4)} x2={HX(0)} y2={HY(4.6)} stroke={P.ink} strokeWidth={4} />
      <line x1={HX(lineEnds[0][0])} y1={HY(lineEnds[0][1])} x2={HX(lineEnds[1][0])} y2={HY(lineEnds[1][1])} stroke="#1971c2" strokeWidth={8} />
      <Tx x={HX(-2.4)} y={HY(4.6)} size={42} color="#1971c2" anchor="start">x＋y＝2</Tx>
      <circle cx={HX(4)} cy={HY(3)} r={16} fill={P.ink} />
      <Tx x={HX(4) + 20} y={HY(3) - 30} size={46}>A(4, 3)</Tx>
      {calm && (
        <>
          <line x1={HX(4)} y1={HY(3)} x2={HX(4 - 5 * perp)} y2={HY(3 - 5 * perp)} stroke={P.gold} strokeWidth={10} strokeLinecap="round" />
          {perp > 0.5 && <circle cx={HX(1.5)} cy={HY(0.5)} r={16} fill={P.gold} />}
          {perp > 0.5 && <Tx x={HX(1.5) + 120} y={HY(0.5) + 20} size={40} color={P.goldInk}>中点</Tx>}
          {perp > 0.5 && <rect x={HX(1.5) - 2} y={HY(0.5) - 34} width={32} height={32} fill="none" stroke={P.goldInk} strokeWidth={4} transform={`rotate(45 ${HX(1.5)} ${HY(0.5)})`} />}
          {found > 0 && <circle cx={HX(-1)} cy={HY(-2)} r={22 * found} fill={P.red} />}
          {found > 0.6 && <Tx x={HX(-1) + 50} y={HY(-2) + 80} size={56} color={P.red}>(−1, −2)</Tx>}
        </>
      )}
    </svg>
  );
  return (
    <>
      <Shake on={!calm && f >= c.z306.from}>
        {grid}
        {!calm && (
          <>
            <E c="🚓" x={-100 + Math.max(0, f - c.z302.from) * 14} y={1150} size={200} at={c.z302.from} />
            <E c="📄" x={200} y={400} size={130} at={c.z303.from} anim="spin" />
            <E c="📄" x={800} y={520} size={130} at={c.z303.from + 4} anim="spin" />
            <E c="📄" x={500} y={1100} size={130} at={c.z303.from + 8} anim="spin" />
            <E c="🛩️" x={260 + Math.sin((f - c.z304.from) / 6) * 200} y={300} size={170} at={c.z304.from} />
            <E c="🐕‍🦺" x={800} y={1120} size={200} at={c.z305.from} anim="bounce" />
            <E c="🌀" x={300} y={700} size={220} at={c.z306.from} anim="spin" />
            <E c="🌀" x={800} y={420} size={220} at={c.z306.from + 4} anim="spin" />
            <E c="🚁" x={250} y={260} size={200} at={c.z307.from} anim="shake" />
            <E c="🚁" x={830} y={300} size={200} at={c.z307.from + 4} anim="shake" style={{ transform: "scaleX(-1)" }} />
            <E c="❓" x={540} y={240} size={160} at={c.z307.from + 10} anim="bounce" />
          </>
        )}
        {!calm && <Stamp text="捜索隊　出動" at={c.z302.from + 4} x={120} y={210} rot={-6} size={80} />}
        {!calm && <Stamp text="連立方程式班" at={c.z303.from} x={60} y={940} rot={5} size={70} color="#1971c2" />}
        {!calm && <Stamp text="ドローン班" at={c.z304.from} x={560} y={350} rot={-4} size={70} color="#2f9e44" />}
        {!calm && <Stamp text="警察犬班" at={c.z305.from} x={500} y={1080} rot={6} size={70} color="#f08c00" />}
        {!calm && <Stamp text="全員　迷子" at={c.z306.from} x={200} y={560} rot={-8} size={96} />}
      </Shake>
      {calm && f >= c.z311.from && <E c="🐕‍🦺" x={HX(-1) - 10} y={HY(-2) - 110} size={180} at={c.z311.from + 4} anim="bounce" />}
    </>
  );
}

// ---------------------------------------------------------------- why the course solves it (real app)

const STEPS = ["講義", "手で動かす", "ひっかけ問題", "タイム計測"];
function Product({ c }: { c: Record<string, Cue> }) {
  const f = useCurrentFrame();
  const a = c.zp1.from, b = c.zp2.from, d3 = c.zp3.from, d4 = c.zp4.from;
  const mid = b + Math.round(c.zp2.dur * 0.55);
  const o = interpolate(f, [a, a + 10], [0, 1], clamp);
  const box = (at: number) => interpolate(f, [at, at + 10], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ background: P.paper, opacity: o }}>
      <div style={{ position: "absolute", left: 50, top: 150, fontFamily: FONT, fontWeight: 900, fontSize: 64, color: P.ink }}>
        <span style={{ display: "inline-block", width: 54, height: 54, borderRadius: "50%", border: `9px solid ${P.gold}`, boxShadow: "0 0 24px rgba(227,165,28,0.6)", verticalAlign: "-8px", marginRight: 18 }} />
        {f < mid ? <>視点レンズ「<span style={{ color: P.goldInk }}>折り返す</span>」</> : <>視点レンズ　<span style={{ color: P.goldInk }}>8つのレンズ</span></>}
      </div>
      <Screen clip="lens_discover_mirror" segs={[{ from: a, to: mid, a: 0.5, b: 21 }]} width={980} camera={false} sfx={false} style={{ left: 50, top: 290, opacity: f < mid ? 1 : 0 }} glow="rgba(227,165,28,0.25)" />
      {f >= mid - 2 && <Screen clip="lens_timed" segs={[{ from: mid, to: d4 + s(4), a: 0.5, b: 15 }]} width={980} camera={false} sfx={false} style={{ left: 50, top: 290 }} glow="rgba(227,165,28,0.25)" />}
      {f < d3 && (
        <div style={{ position: "absolute", left: 50, width: 980, top: 1080, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {STEPS.map((t, i) => {
            const v = box(b + s(1.0 + i * 0.75));
            return <div key={t} style={{ opacity: v, transform: `translateY(${(1 - v) * 20}px)`, background: P.goldSoft, border: `4px solid ${P.gold}`, borderRadius: 16, textAlign: "center", padding: "14px 0", fontFamily: FONT, fontWeight: 900, fontSize: 31, whiteSpace: "nowrap", color: P.ink }}><span style={{ color: P.goldInk }}>{i + 1}</span> {t}</div>;
          })}
        </div>
      )}
      {f >= d3 && f < d4 && <div style={{ position: "absolute", left: 50, width: 980, top: 1075, textAlign: "center", fontFamily: FONT, fontWeight: 900, fontSize: 70, color: P.ink, opacity: box(d3) }}>1日 15〜20分 × <span style={{ color: P.goldInk }}>4週間</span></div>}
      {f >= d4 && (
        <div style={{ position: "absolute", left: 50, width: 980, top: 1060, textAlign: "center", opacity: box(d4) }}>
          <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 60, color: P.ink }}>1つのレンズ <span style={{ color: P.red }}>3日間無料</span></span>
          <div style={{ marginTop: 8, display: "inline-block", background: P.ink, color: "#fff", borderRadius: 999, padding: "6px 40px", fontFamily: FONT, fontWeight: 900, fontSize: 48 }}>lens.domo-ai.com</div>
        </div>
      )}
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- the Short

export function ZanyShort({ stage }: ZanyProps) {
  const f = useCurrentFrame();
  const { cues, end } = plan(SEQ[stage]);
  const list = Object.values(cues);
  const freezeId = { ca: "z108", cb: "z208", cc: "z308" }[stage];
  const freeze = cues[freezeId].from;
  const tag = cues.zend;
  const ribbon = { ca: "最短ルート、依然として不明", cb: "AP＋PB 最小値をめぐり 緊急会議", cc: "対称点 いまだ見つからず 捜索続く" }[stage];
  const music = (fr: number) => (fr >= freeze && fr < freeze + s(1.2) ? 0 : fr >= freeze ? 0.14 : 0.2) * interpolate(fr, [end + s(1.2) + END_CARD - 30, end + s(1.2) + END_CARD], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: P.paper, overflow: "hidden" }}>
      <Backdrop cues={list} freeze={freeze} />
      {f < cues.zp1.from + 12 && stage === "ca" && <RiverShort c={cues} freeze={freeze} />}
      {f < cues.zp1.from + 12 && stage === "cb" && <CommitteeShort c={cues} freeze={freeze} />}
      {f < cues.zp1.from + 12 && stage === "cc" && <SearchShort c={cues} freeze={freeze} />}
      {f >= cues.zp1.from && <Product c={cues} />}
      <Ribbon text={ribbon} until={freeze - 1} />
      <Lens at={freeze + 6} />
      {f >= tag.from && (
        <AbsoluteFill style={{ background: P.navy, opacity: interpolate(f, [tag.from, tag.from + 10], [0, 1], clamp), display: "grid", placeItems: "center", textAlign: "center" }}>
          <div style={{ fontFamily: FONT, fontWeight: 900, color: "#fff", fontSize: 92, lineHeight: 1.35, marginTop: -200 }}>
            解き方より、<br />
            <span style={{ color: P.gold }}>見る場所。</span>
          </div>
        </AbsoluteFill>
      )}
      {list.filter((x) => x.id !== "zend").map((cue) => <Caption key={cue.id} cue={cue} dark={false} />)}
      {list.map((cue) => (
        <Sequence key={cue.id} from={cue.from} durationInFrames={cue.dur + 10}>
          <Audio src={staticFile(`lens/${cue.id}.wav`)} />
        </Sequence>
      ))}
      {list.filter((x) => x.from < freeze && x.id !== list[0].id).map((x) => <Sfx key={`p${x.id}`} at={x.from} src="pop" volume={0.35} />)}
      <Sfx at={freeze} src="hit" volume={0.5} />
      <Sfx at={freeze + 6} src="chime" volume={0.45} />
      <Sfx at={tag.from} src="whoosh" volume={0.3} />
      <Audio src={staticFile("lens/music_zany.wav")} volume={music} />
      <Sequence from={end + s(1.2)} durationInFrames={END_CARD}>
        <EndCard line="迷う時間を削る。" w={1080} scale={0.82} />
      </Sequence>
    </AbsoluteFill>
  );
}
