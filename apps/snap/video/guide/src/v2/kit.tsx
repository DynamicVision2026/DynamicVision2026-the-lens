import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Audio, Easing, Freeze, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import daily from "../clips2/daily_phone.json";
import exam from "../clips2/exam_ipad.json";
import map from "../clips2/map_ipad.json";
import plan from "../clips2/plan_phone.json";
import portrait from "../clips2/portrait_ipad.json";
import roots from "../clips2/roots_ipad.json";
import sheet from "../clips2/sheet_ipad.json";
import snap from "../clips2/snap_phone.json";
import dailyEn from "../clips2/en/daily_phone.json";
import examEn from "../clips2/en/exam_ipad.json";
import mapEn from "../clips2/en/map_ipad.json";
import planEn from "../clips2/en/plan_phone.json";
import portraitEn from "../clips2/en/portrait_ipad.json";
import rootsEn from "../clips2/en/roots_ipad.json";
import sheetEn from "../clips2/en/sheet_ipad.json";
import snapEn from "../clips2/en/snap_phone.json";
import dailyZh from "../clips2/zh-Hant/daily_phone.json";
import examZh from "../clips2/zh-Hant/exam_ipad.json";
import mapZh from "../clips2/zh-Hant/map_ipad.json";
import planZh from "../clips2/zh-Hant/plan_phone.json";
import portraitZh from "../clips2/zh-Hant/portrait_ipad.json";
import rootsZh from "../clips2/zh-Hant/roots_ipad.json";
import sheetZh from "../clips2/zh-Hant/sheet_ipad.json";
import snapZh from "../clips2/zh-Hant/snap_phone.json";
import lens_master_constant from "../clips2/lens_master_constant.json";
import lens_discover_mirror from "../clips2/lens_discover_mirror.json";
import lens_3d_unfold from "../clips2/lens_3d_unfold.json";
import lens_practice from "../clips2/lens_practice.json";
import lens_timed from "../clips2/lens_timed.json";
import lens_drill from "../clips2/lens_drill.json";
import lens_report from "../clips2/lens_report.json";
import lens_pass from "../clips2/lens_pass.json";
import lens_check from "../clips2/lens_check.json";
import lens_master_freeze from "../clips2/lens_master_freeze.json";
import { VLANG, lfile } from "../vlang";

export const FPS = 30;
export const C = {
  bg0: "#060c19",
  bg1: "#0d1d38",
  text: "#f4f7fd",
  muted: "#98abcc",
  line: "rgba(150,185,255,0.16)",
  accent: "#ff8a5c",
  gold: "#f6c453",
  red: "#ef6152",
  green: "#47c78b",
  purple: "#a98dff",
  grey: "#8e9ab3",
  cyan: "#5fd8ff",
  navy: "#16264a",
};
export const FONT = VLANG === "zh-Hant" ? '"Noto Sans CJK TC", "Noto Sans CJK JP", sans-serif' : '"Noto Sans CJK JP", "Noto Sans JP", sans-serif';
export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export function useIn(start = 0, d = 18) {
  const f = useCurrentFrame();
  return interpolate(f, [start, start + d], [0, 1], { ...clamp, easing: ease });
}
export function usePop(start = 0, damping = 13) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - start, fps, config: { damping, stiffness: 140, mass: 0.7 } });
}
export function Sfx({ at, src, volume = 0.6 }: { at: number; src: string; volume?: number }) {
  if (at < 0) return null;
  return (
    <Sequence from={Math.round(at)} durationInFrames={90} layout="none">
      <Audio src={staticFile(`sfx/${src}.wav`)} volume={volume} />
    </Sequence>
  );
}

// ---------------------------------------------------------------- backdrop

const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

/** Deep navy, a drifting hex field with cells that light up, a slow light sweep and a vignette. */
/** w/h: the frame size (default 1920×1080; the vertical short passes 1080×1920). */
export function Backdrop({ tint = C.cyan, glints = true, w: W = 1920, h: H = 1080 }: { tint?: string; glints?: boolean; w?: number; h?: number }) {
  const f = useCurrentFrame();
  const R = 46;
  const w = Math.sqrt(3) * R;
  const cells = [];
  const dx = (f * 0.35) % w;
  const dy = (f * 0.2) % (1.5 * R * 2);
  const rows = H === 1080 ? 16 : Math.ceil(H / (1.5 * R)) + 2;
  const cols = W === 1920 ? 24 : Math.ceil(W / w) + 2;
  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const x = col * w + (row % 2 ? w / 2 : 0) - dx;
      const y = row * 1.5 * R - dy;
      const id = row * 31 + col;
      const phase = (f + hash(id) * 600) % 240;
      const on = glints && hash(id + 7) > 0.86 ? Math.max(0, Math.sin((phase / 240) * Math.PI)) ** 3 : 0;
      cells.push(
        <polygon
          key={id}
          points={[0, 1, 2, 3, 4, 5].map((k) => `${x + R * Math.cos((Math.PI / 3) * k + Math.PI / 6)},${y + R * Math.sin((Math.PI / 3) * k + Math.PI / 6)}`).join(" ")}
          fill={on > 0.01 ? tint : "none"}
          fillOpacity={on * 0.16}
          stroke="rgba(150,185,255,0.09)"
          strokeWidth={1.2}
        />,
      );
    }
  }
  const sweep = ((f * 6) % 3200) - 800;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1300px 900px at 30% 20%, ${C.bg1}, ${C.bg0} 72%)` }}>
      <svg width={W} height={H} style={{ position: "absolute" }}>
        {cells}
      </svg>
      <div style={{ position: "absolute", left: sweep, top: -300, width: 260, height: H + 620, transform: "rotate(18deg)", background: "linear-gradient(90deg, transparent, rgba(120,200,255,0.06), transparent)" }} />
      <div style={{ position: "absolute", width: 1000, height: 1000, left: 1100, top: -320, borderRadius: "50%", background: `radial-gradient(circle, ${tint}22, transparent 65%)` }} />
      <AbsoluteFill style={{ background: "radial-gradient(1400px 900px at 50% 50%, transparent 55%, rgba(0,0,0,0.55))" }} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- recorded app + automatic camera

type Ev = { t: number; kind: string; x?: number; y?: number; w?: number; h?: number };
type ClipMeta = { w: number; h: number; dur: number; events: Ev[] };
const CLIPS_JA = {
  snap_phone: snap,
  map_ipad: map,
  sheet_ipad: sheet,
  roots_ipad: roots,
  exam_ipad: exam,
  daily_phone: daily,
  portrait_ipad: portrait,
  plan_phone: plan,
  // 視点レンズ course recordings (Japanese only)
  lens_master_constant,
  lens_discover_mirror,
  lens_3d_unfold,
  lens_practice,
  lens_timed,
  lens_drill,
  lens_report,
  lens_pass,
  lens_check,
  lens_master_freeze,
} as Record<string, ClipMeta>;
const CLIPS_BY_LANG = {
  ja: CLIPS_JA,
  en: { snap_phone: snapEn, map_ipad: mapEn, sheet_ipad: sheetEn, roots_ipad: rootsEn, exam_ipad: examEn, daily_phone: dailyEn, portrait_ipad: portraitEn, plan_phone: planEn },
  "zh-Hant": { snap_phone: snapZh, map_ipad: mapZh, sheet_ipad: sheetZh, roots_ipad: rootsZh, exam_ipad: examZh, daily_phone: dailyZh, portrait_ipad: portraitZh, plan_phone: planZh },
} as Record<string, Record<string, ClipMeta>>;
/** This language's recordings (same script and actions as the Japanese ones, in the app's language). */
export const CLIPS: Record<string, ClipMeta> = { ...CLIPS_JA, ...CLIPS_BY_LANG[VLANG] };

/**
 * Edits are written in Japanese-recording seconds; another language's recording has the same actions a little
 * earlier or later, so a time maps piecewise-linearly between the matching actions (start, each event, end).
 */
export function clipTime(clip: string, t: number): number {
  const a = CLIPS_JA[clip];
  const b = CLIPS[clip];
  if (a === b || a.events.length !== b.events.length) return t;
  const xs = [0, ...a.events.map((e) => e.t), a.dur];
  const ys = [0, ...b.events.map((e) => e.t), b.dur];
  for (let i = 1; i < xs.length; i++) {
    if (t <= xs[i] || i === xs.length - 1) {
      const span = Math.max(0.001, xs[i] - xs[i - 1]);
      return Math.min(b.dur, Math.max(0, ys[i - 1] + ((t - xs[i - 1]) / span) * (ys[i] - ys[i - 1])));
    }
  }
  return t;
}

function rawCam(m: ClipMeta, tau: number, zmax: number) {
  const W = m.w;
  const H = m.h;
  const evs = m.events.filter((e) => e.x !== undefined);
  let cur: Ev | null = null;
  let next: Ev | null = null;
  for (let i = 0; i < evs.length; i++) {
    if (evs[i].t - 0.45 <= tau) {
      cur = evs[i];
      next = evs[i + 1] ?? null;
    }
  }
  if (!cur) return { cx: W / 2, cy: H / 2, z: 1 };
  const bx = (cur.x as number) + (cur.w as number) / 2;
  const by = (cur.y as number) + (cur.h as number) / 2;
  let z = Math.min(W / ((cur.w as number) * 1.35), H / ((cur.h as number) * 1.6), zmax);
  if (cur.kind === "tap") z = Math.min(z, zmax * 0.92);
  z = Math.max(1, z);
  const hold = next ? next.t - cur.t : 99;
  if (hold > 3 && tau > cur.t + 2.3) return { cx: W / 2, cy: H / 2, z: 1 };
  return { cx: bx, cy: by, z };
}

/** Screen-Studio-like camera: zooms toward each logged action and eases between them (double box filter). */
export function camAt(m: ClipMeta, tau: number, zmax: number) {
  const one = (t: number) => {
    let cx = 0;
    let cy = 0;
    let z = 0;
    for (let k = 0; k <= 10; k++) {
      const c = rawCam(m, t - k * 0.055, zmax);
      cx += c.cx;
      cy += c.cy;
      z += c.z;
    }
    return { cx: cx / 11, cy: cy / 11, z: z / 11 };
  };
  let cx = 0;
  let cy = 0;
  let z = 0;
  for (let k = 0; k <= 8; k++) {
    const c = one(tau - k * 0.045);
    cx += c.cx;
    cy += c.cy;
    z += c.z;
  }
  cx /= 9;
  cy /= 9;
  z /= 9;
  const hw = m.w / (2 * z);
  const hh = m.h / (2 * z);
  return { cx: Math.min(Math.max(cx, hw), m.w - hw), cy: Math.min(Math.max(cy, hh), m.h - hh), z };
}

export type Seg = { from: number; to: number; a: number; b: number };

/**
 * A recorded app clip in a device bezel, edited as segments [a, b] (clip seconds) laid on scene frames
 * [from, to]; the camera follows the logged actions; taps get a ripple and a click.
 */
export function Screen(props: {
  clip: string;
  segs: Seg[];
  width: number;
  camera?: boolean;
  zmax?: number;
  style?: CSSProperties;
  glow?: string;
  sfx?: boolean;
}) {
  const f = useCurrentFrame();
  const m = CLIPS[props.clip];
  const phone = m.w < 600;
  const bezel = phone ? 13 : 16;
  const radius = phone ? 48 : 30;
  const dw = props.width;
  const d = dw / m.w;
  const dh = Math.round(m.h * d);
  const segs = props.segs.map((x) => ({ ...x, a: clipTime(props.clip, x.a), b: clipTime(props.clip, x.b) }));
  const seg = segs.find((s) => f >= s.from && f < s.to) ?? segs[segs.length - 1];
  const len = Math.max(1, seg.to - seg.from);
  const rate = Math.min(1.7, Math.max(0.55, (seg.b - seg.a) / (len / FPS)));
  const local = Math.min(f, seg.to - 1) - seg.from;
  const tau = Math.min(seg.b, seg.a + (local / FPS) * rate);
  const cam = props.camera === false ? { cx: m.w / 2, cy: m.h / 2, z: 1 } : camAt(m, tau, props.zmax ?? (phone ? 1.75 : 1.55));
  const tx = dw / 2 - cam.cx * d * cam.z;
  const ty = dh / 2 - cam.cy * d * cam.z;
  const playFrames = ((seg.b - seg.a) * FPS) / rate;
  const video = (
    <OffthreadVideo src={staticFile(lfile(`clips2/${props.clip}.mp4`))} startFrom={Math.round(seg.a * FPS)} playbackRate={rate} muted style={{ width: dw, height: dh, display: "block" }} />
  );
  return (
    <div
      style={{
        position: "absolute",
        width: dw + bezel * 2,
        height: dh + bezel * 2,
        padding: bezel,
        borderRadius: radius,
        background: "linear-gradient(150deg, #34405e, #0b1222 60%)",
        boxShadow: `0 50px 140px rgba(0,0,0,0.6), 0 0 0 1.5px rgba(255,255,255,0.1), 0 0 110px ${props.glow ?? "rgba(95,216,255,0.2)"}`,
        ...props.style,
      }}
    >
      <div style={{ width: dw, height: dh, borderRadius: radius - bezel + 4, overflow: "hidden", background: "#000", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: dw, height: dh, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${cam.z})` }}>
          <Sequence key={seg.from} from={seg.from} durationInFrames={len} layout="none">
            {local >= playFrames - 1 ? <Freeze frame={Math.max(0, Math.floor(playFrames) - 2)}>{video}</Freeze> : video}
          </Sequence>
          {m.events
            .filter((e) => e.kind === "tap" && e.x !== undefined && e.t >= seg.a && e.t <= seg.b)
            .map((e, i) => {
              const at = seg.from + ((e.t - seg.a) / rate) * FPS;
              const p = (f - at) / 16;
              if (p < -0.1 || p > 1) return null;
              const r = 12 + 46 * Math.max(0, p);
              return (
                <div key={i}>
                  <div style={{ position: "absolute", left: ((e.x as number) + (e.w as number) / 2) * d - r, top: ((e.y as number) + (e.h as number) / 2) * d - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `${4 / cam.z}px solid ${C.cyan}`, opacity: 1 - Math.max(0, p) }} />
                  <div style={{ position: "absolute", left: ((e.x as number) + (e.w as number) / 2) * d - 13, top: ((e.y as number) + (e.h as number) / 2) * d - 13, width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.85)", boxShadow: `0 0 20px ${C.cyan}`, opacity: p < 0.4 ? 1 : 1 - (p - 0.4) / 0.6 }} />
                </div>
              );
            })}
        </div>
      </div>
      {props.sfx !== false &&
        m.events
          .filter((e) => e.kind === "tap" && e.t >= seg.a && e.t <= seg.b)
          .map((e, i) => <Sfx key={i} at={seg.from + ((e.t - seg.a) / rate) * FPS} src="tap" volume={0.45} />)}
    </div>
  );
}

// ---------------------------------------------------------------- type & shapes

export function Kicker({ children, color = C.cyan, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: FONT, fontSize: 24, fontWeight: 800, letterSpacing: "0.28em", color, ...style }}>
      <span style={{ width: 34, height: 3, background: color, borderRadius: 2 }} />
      {children}
    </div>
  );
}

/** Words slam in one by one (scale + blur + rise). */
export function Slam({ parts, start = 0, size = 80, style, colors = [] }: { parts: string[]; start?: number; size?: number; style?: CSSProperties; colors?: (string | undefined)[] }) {
  const f = useCurrentFrame();
  return (
    <div style={{ fontFamily: FONT, fontSize: size, fontWeight: 900, lineHeight: 1.22, color: C.text, ...style }}>
      {parts.map((p, i) => {
        const t = interpolate(f, [start + i * 5, start + i * 5 + 14], [0, 1], { ...clamp, easing: ease });
        return (
          <span key={i} style={{ display: "inline-block", color: colors[i] ?? C.text, opacity: t, filter: `blur(${(1 - t) * 10}px)`, transform: `translateY(${(1 - t) * 34}px) scale(${1.25 - 0.25 * t})` }}>
            {p.replace(/ $/, "\u00a0")}
          </span>
        );
      })}
    </div>
  );
}

export function Hex({ color, size = 90, label, glow = true, style }: { color: string; size?: number; label?: string; glow?: boolean; style?: CSSProperties }) {
  return (
    <svg width={size} height={size * 1.1547} viewBox="0 0 100 115.47" style={{ overflow: "visible", filter: glow ? `drop-shadow(0 0 16px ${color}99)` : undefined, ...style }}>
      <path d="M50 0 L100 28.87 L100 86.6 L50 115.47 L0 86.6 L0 28.87 Z" fill={color} stroke="rgba(255,255,255,0.6)" strokeWidth="3" />
      <path d="M50 8 L93 33 L93 50 L50 25 L7 50 L7 33 Z" fill="rgba(255,255,255,0.24)" />
      {label && (
        <text x="50" y="70" textAnchor="middle" fontFamily={FONT} fontWeight="900" fontSize="34" fill="#0b1426">
          {label}
        </text>
      )}
    </svg>
  );
}

export function Callout({ at, children, color = C.cyan, style }: { at: number; children: ReactNode; color?: string; style?: CSSProperties }) {
  const p = usePop(at, 12);
  return (
    <div
      style={{
        position: "absolute",
        padding: "16px 26px",
        borderRadius: 18,
        background: "rgba(10,22,44,0.92)",
        border: `2px solid ${color}`,
        boxShadow: `0 0 40px ${color}44, 0 20px 50px rgba(0,0,0,0.4)`,
        fontFamily: FONT,
        fontSize: 34,
        fontWeight: 800,
        color: C.text,
        opacity: Math.min(1, p),
        transform: `scale(${0.7 + 0.3 * p}) translateY(${(1 - p) * 20}px)`,
        transformOrigin: "left center",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Fade({ dur, children, edge = 12 }: { dur: number; children: ReactNode; edge?: number }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, edge, dur - edge, dur], [0, 1, 1, 0], clamp);
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}

/** A line with [highlighted] words (the translations move the highlight with the words). */
export function Rich({ text, color = C.gold }: { text: string; color?: string }) {
  return (
    <>
      {text.split(/(\[[^\]]*\])/).map((t, i) =>
        t.startsWith("[") ? (
          <span key={i} style={{ color }}>
            {t.slice(1, -1)}
          </span>
        ) : (
          t
        ),
      )}
    </>
  );
}
