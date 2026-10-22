import { AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Stack } from "../story/art";
import { FONT, Sfx, clamp, ease } from "../v2/kit";
import { H, MapEndCard, SAFE_BOTTOM, W, s } from "./common";

/**
 * Short B — 「ママ、明日テスト」: a 22:14 parent–child chat, full frame, no narration, no music.
 * Series: pass another `script` (same component); timings are in seconds from the start.
 */
export type ChatItem = {
  t: number;
  who: "kid" | "mom";
  text?: string;
  img?: "notebooks" | "sheet" | "plan";
  /** typing dots before it (default: every reply except the first message) */
  typing?: boolean;
  sfx?: "pop" | "shutter" | "chime" | null;
};
export type ChatProps = {
  name: string;
  clock: string;
  battery: number;
  script: ChatItem[];
  /** chat shrinks and the map rises from here (s); end card starts at `endAt`, fade to black at `endAt + 3` */
  shrinkAt: number;
  endAt: number;
};

export const CHAT_DEFAULT: ChatProps = {
  name: "ゆうと",
  clock: "22:14",
  battery: 23,
  shrinkAt: 20.6,
  endAt: 23.0,
  script: [
    { t: 0.5, who: "kid", text: "ママ、明日テスト", typing: false },
    { t: 2.0, who: "mom", text: "どこやるの？" },
    { t: 3.4, who: "kid", text: "わかんない" },
    { t: 4.8, who: "mom", text: "どこ間違えたっけ" },
    { t: 6.4, who: "kid", text: "……", sfx: null },
    { t: 8.0, who: "mom", text: "まちがいノート見せて" },
    { t: 9.4, who: "kid", text: "どれ？" },
    { t: 9.8, who: "kid", img: "notebooks", typing: false },
    { t: 11.2, who: "mom", text: "……", sfx: null },
    { t: 12.6, who: "mom", img: "sheet", typing: false, sfx: "shutter" },
    { t: 14.6, who: "mom", img: "plan", typing: false, sfx: "chime" },
    { t: 17.0, who: "kid", text: "それだけ？" },
    { t: 18.4, who: "mom", text: "それだけ。" },
    { t: 19.8, who: "kid", text: "👍" },
  ],
};
export const chatFrames = (p: ChatProps) => s(p.endAt + 4);

const BG = "#d9e2ec";
const KID = "#ffffff";
const MOM = "#b9e6b0";
const INK = "#1d2533";
const TOP = 250; // messages are clipped above this (status bar + header)
const BOTTOM = 1400; // newest message's bottom edge (captions end above SAFE_BOTTOM)
const RIGHT = 890; // mother's bubbles end here (right column stays free)
const LEFT = 64;
const GAP = 24;
const FS = 44;

const IMG = {
  notebooks: { w: 420, h: 420 },
  sheet: { w: 540, h: Math.round((540 * 764) / 1400) },
  plan: { w: 500, h: Math.round((500 * 1900) / 1170) },
};
const textW = (t: string) => [...t].reduce((a, ch) => a + (ch.charCodeAt(0) < 0x2000 ? 0.6 : 1) * FS, 0);

type Row = { key: string; who: "kid" | "mom"; t: number; until?: number; h: number; w: number; item?: ChatItem; dots?: boolean };

function rows(script: ChatItem[]): Row[] {
  const out: Row[] = [];
  script.forEach((it, i) => {
    const typing = it.typing ?? i > 0;
    if (typing) out.push({ key: `d${i}`, who: it.who, t: it.t - 0.6, until: it.t, h: 96, w: 150, dots: true });
    if (it.img) out.push({ key: `m${i}`, who: it.who, t: it.t, h: IMG[it.img].h + 20, w: IMG[it.img].w + 20, item: it });
    else out.push({ key: `m${i}`, who: it.who, t: it.t, h: Math.round(FS * 1.4) + 52, w: Math.min(640, textW(it.text ?? "") + 64), item: it });
  });
  return out;
}

function Bubble({ row, at }: { row: Row; at: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - at, fps, config: { damping: 14, stiffness: 170, mass: 0.6 } });
  const mom = row.who === "mom";
  const it = row.item;
  const style = {
    position: "absolute" as const,
    left: mom ? RIGHT - row.w : LEFT,
    width: row.w,
    height: row.h,
    borderRadius: 34,
    borderBottomRightRadius: mom ? 10 : 34,
    borderBottomLeftRadius: mom ? 34 : 10,
    background: mom ? MOM : KID,
    boxShadow: "0 2px 6px rgba(20,30,50,0.12)",
    transform: `scale(${0.7 + 0.3 * Math.min(1, p)})`,
    transformOrigin: mom ? "100% 100%" : "0% 100%",
    opacity: Math.min(1, p * 1.6),
    overflow: "hidden" as const,
  };
  if (row.dots) {
    return (
      <div style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
        {[0, 1, 2].map((k) => (
          <div key={k} style={{ width: 16, height: 16, borderRadius: 8, background: "#8a94a6", opacity: 0.35 + 0.65 * Math.max(0, Math.sin((f - at) / 3.2 - k * 0.9)) }} />
        ))}
      </div>
    );
  }
  if (it?.img) {
    const d = IMG[it.img];
    return (
      <div style={{ ...style, padding: 10 }}>
        <div style={{ width: d.w, height: d.h, borderRadius: 26, overflow: "hidden", position: "relative", background: "#2a1d14" }}>
          {it.img === "notebooks" && (
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #2b2f4a 0 46%, #7a5538 46% 100%)" }}>
              <div style={{ position: "absolute", left: 0, top: 0, width: 420, height: 420, transform: "scale(0.82)", transformOrigin: "50% 100%" }}>
                <Stack x={210} y={400} n={7} bw={300} bh={44} />
              </div>
            </div>
          )}
          {it.img === "sheet" && <Img src={staticFile("sheet.jpg")} style={{ width: d.w, height: d.h, objectFit: "cover" }} />}
          {it.img === "plan" && <Img src={staticFile("shorts/plan.png")} style={{ width: d.w, height: d.h, objectFit: "cover" }} />}
        </div>
      </div>
    );
  }
  return (
    <div style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontSize: FS, fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>
      {it?.text}
    </div>
  );
}

function ChatScreen({ p }: { p: ChatProps }) {
  const f = useCurrentFrame();
  const rs = rows(p.script);
  // every row's height eases in when it appears (and typing dots ease out when their reply lands)
  const weight = (r: Row) => {
    const a = interpolate(f, [s(r.t), s(r.t) + 7], [0, 1], { ...clamp, easing: ease });
    const b = r.until !== undefined ? interpolate(f, [s(r.until), s(r.until) + 5], [1, 0], clamp) : 1;
    return a * b;
  };
  let y = BOTTOM;
  const placed: { r: Row; top: number }[] = [];
  for (let i = rs.length - 1; i >= 0; i--) {
    const r = rs[i];
    const w = weight(r);
    if (w <= 0) continue;
    y -= r.h * w;
    placed.push({ r, top: y });
    y -= GAP * w;
  }
  return (
    <AbsoluteFill style={{ background: BG, fontFamily: FONT }}>
      {/* messages */}
      <div style={{ position: "absolute", left: 0, top: TOP, width: W, height: SAFE_BOTTOM - TOP + 20, overflow: "hidden" }}>
        {placed.map(({ r, top }) => (
          <div key={r.key} style={{ position: "absolute", left: 0, top: top - TOP, width: W, height: r.h }}>
            <Bubble row={r} at={s(r.t)} />
          </div>
        ))}
      </div>
      {/* status bar + header */}
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: TOP, background: "#f6f8fb", boxShadow: "0 2px 0 rgba(20,30,50,0.06)" }}>
        <div style={{ position: "absolute", left: 60, top: 26, fontSize: 36, fontWeight: 700, color: INK }}>{p.clock}</div>
        <div style={{ position: "absolute", right: 60, top: 28, display: "flex", alignItems: "center", gap: 12, fontSize: 30, fontWeight: 700, color: INK }}>
          <span>{p.battery}%</span>
          <div style={{ width: 62, height: 30, borderRadius: 8, border: `3px solid ${INK}`, position: "relative", padding: 3 }}>
            <div style={{ width: `${p.battery}%`, height: "100%", borderRadius: 3, background: p.battery <= 20 ? "#e0483c" : INK }} />
            <div style={{ position: "absolute", right: -9, top: 8, width: 5, height: 10, borderRadius: 2, background: INK }} />
          </div>
        </div>
        <div style={{ position: "absolute", left: 40, top: 120, fontSize: 64, color: "#4a90e2", lineHeight: 1 }}>‹</div>
        <div style={{ position: "absolute", left: 110, top: 112, width: 92, height: 92, borderRadius: 46, background: "#c9d3df" }} />
        <div style={{ position: "absolute", left: 226, top: 132, fontSize: 46, fontWeight: 800, color: INK }}>{p.name}</div>
      </div>
      {/* input bar (no text) */}
      <div style={{ position: "absolute", left: 0, top: SAFE_BOTTOM + 30, width: W, height: H - SAFE_BOTTOM - 30, background: BG }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 140, background: "#f6f8fb" }} />
        <div style={{ position: "absolute", left: 50, top: 34, width: 70, height: 70, borderRadius: 35, background: "#c9d3df" }} />
        <div style={{ position: "absolute", left: 150, top: 30, width: 720, height: 80, borderRadius: 40, background: "#ffffff", border: "2px solid #dde3ea" }} />
      </div>
    </AbsoluteFill>
  );
}

export function Chat(p: ChatProps) {
  const f = useCurrentFrame();
  const sh = interpolate(f, [s(p.shrinkAt), s(p.endAt)], [0, 1], { ...clamp, easing: ease });
  const fadeIn = interpolate(f, [0, s(0.5)], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* the real map rises behind the shrinking chat */}
      <AbsoluteFill style={{ opacity: sh, transform: `translateY(${(1 - sh) * 260}px)` }}>
        <Img src={staticFile("shorts/map.png")} style={{ width: W, height: (W * 2532) / 1170, marginTop: -200 }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${1 - 0.4 * sh})`, transformOrigin: "50% 42%", borderRadius: 40 * sh, overflow: "hidden", boxShadow: sh > 0 ? `0 40px 120px rgba(0,0,0,${0.55 * sh})` : undefined }}>
        <ChatScreen p={p} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#000", opacity: fadeIn }} />
      {p.script.map((it, i) => {
        const fx = it.sfx === undefined ? "pop" : it.sfx;
        return fx ? <Sfx key={i} at={s(it.t)} src={fx} volume={fx === "chime" ? 0.35 : fx === "shutter" ? 0.5 : 0.45} /> : null;
      })}
      <Sequence from={s(p.endAt)} durationInFrames={s(4)}>
        <MapEndCard fadeAt={s(3)} />
      </Sequence>
    </AbsoluteFill>
  );
}

