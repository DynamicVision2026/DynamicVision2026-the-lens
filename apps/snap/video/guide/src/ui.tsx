import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export const C = {
  bg0: "#08101f",
  bg1: "#0f1f3a",
  navy: "#1d2b4a",
  line: "rgba(160,190,255,0.14)",
  text: "#f4f6fb",
  muted: "#9fb0cf",
  accent: "#ff8a5c",
  gold: "#f2c14e",
  red: "#ec6355",
  green: "#4cc38a",
  purple: "#a58cff",
  grey: "#8f9bb3",
  cyan: "#62d6ff",
};
export const FONT = '"Noto Sans CJK JP", "Noto Sans JP", sans-serif';

export const ease = Easing.bezier(0.22, 1, 0.36, 1);
/** 0→1 over `d` frames starting at `start` (eased). */
export function useIn(start = 0, d = 18) {
  const frame = useCurrentFrame();
  return interpolate(frame, [start, start + d], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
}
export function usePop(start = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - start, fps, config: { damping: 14, stiffness: 120, mass: 0.7 } });
}

/** Deep-space navy with a slow-drifting hex grid and two soft glows. */
export function Backdrop({ hue = 0 }: { hue?: number }) {
  const frame = useCurrentFrame();
  const drift = frame * 0.25;
  const hex = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="84" height="97" viewBox="0 0 84 97"><path d="M42 1 L83 25 L83 72 L42 96 L1 72 L1 25 Z" fill="none" stroke="rgba(150,185,255,0.10)" stroke-width="1.2"/></svg>`,
  );
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1200px 800px at 18% 12%, ${C.bg1}, ${C.bg0} 70%)`, filter: `hue-rotate(${hue}deg)` }}>
      <AbsoluteFill style={{ backgroundImage: `url("data:image/svg+xml,${hex}")`, backgroundPosition: `${drift}px ${drift * 0.6}px`, opacity: 0.9 }} />
      <div style={{ position: "absolute", width: 900, height: 900, left: 1150, top: -260, borderRadius: "50%", background: "radial-gradient(circle, rgba(98,214,255,0.16), transparent 65%)" }} />
      <div style={{ position: "absolute", width: 800, height: 800, left: -260, top: 520, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,138,92,0.12), transparent 65%)" }} />
    </AbsoluteFill>
  );
}

/** A video recording of the app inside a device bezel. */
export function Device(props: {
  kind: "phone" | "tablet" | "tablet-portrait";
  clip: string;
  width: number;
  rate?: number;
  startFrom?: number;
  style?: CSSProperties;
  glow?: string;
}) {
  const ratio = props.kind === "phone" ? 844 / 390 : props.kind === "tablet" ? 1024 / 1366 : 1180 / 820;
  const bezel = props.kind === "phone" ? 14 : 18;
  const radius = props.kind === "phone" ? 46 : 30;
  const w = props.width;
  const h = Math.round(w * ratio);
  return (
    <div
      style={{
        position: "absolute",
        width: w + bezel * 2,
        height: h + bezel * 2,
        padding: bezel,
        borderRadius: radius,
        background: "linear-gradient(145deg, #2a3550, #0d1424)",
        boxShadow: `0 40px 120px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(255,255,255,0.08), 0 0 90px ${props.glow ?? "rgba(98,214,255,0.18)"}`,
        ...props.style,
      }}
    >
      <div style={{ width: w, height: h, borderRadius: radius - bezel + 4, overflow: "hidden", background: "#000" }}>
        <OffthreadVideo src={staticFile(`clips/${props.clip}.mp4`)} playbackRate={props.rate ?? 1} startFrom={props.startFrom ?? 0} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    </div>
  );
}

export function Kicker({ children, color = C.cyan, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return (
    <div style={{ fontFamily: FONT, fontSize: 26, fontWeight: 800, letterSpacing: "0.22em", color, ...style }}>{children}</div>
  );
}

/** Big headline that slides up word-chunk by chunk. */
export function Headline({ parts, start = 0, size = 76, style, color = C.text }: { parts: string[]; start?: number; size?: number; style?: CSSProperties; color?: string }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ fontFamily: FONT, fontSize: size, fontWeight: 900, lineHeight: 1.25, color, letterSpacing: "0.02em", ...style }}>
      {parts.map((p, i) => {
        const t = interpolate(frame, [start + i * 6, start + i * 6 + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
        return (
          <span key={i} style={{ display: "inline-block", opacity: t, transform: `translateY(${(1 - t) * 40}px)` }}>
            {p}
          </span>
        );
      })}
    </div>
  );
}

export function Chip({ children, color, start = 0, style }: { children: ReactNode; color: string; start?: number; style?: CSSProperties }) {
  const p = usePop(start);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 24px",
        borderRadius: 999,
        background: "rgba(15,28,52,0.85)",
        border: `2px solid ${color}`,
        color: C.text,
        fontFamily: FONT,
        fontSize: 32,
        fontWeight: 800,
        transform: `scale(${0.6 + 0.4 * p})`,
        opacity: p,
        boxShadow: `0 0 30px ${color}40`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** A hex badge (the map's tile) in one ladder colour. */
export function Hex({ color, size = 90, label, glow = true }: { color: string; size?: number; label?: string; glow?: boolean }) {
  const h = size * 1.1547;
  return (
    <svg width={size} height={h} viewBox="0 0 100 115.47" style={{ overflow: "visible", filter: glow ? `drop-shadow(0 0 18px ${color}88)` : undefined }}>
      <path d="M50 0 L100 28.87 L100 86.6 L50 115.47 L0 86.6 L0 28.87 Z" fill={color} stroke="rgba(255,255,255,0.55)" strokeWidth="3" />
      <path d="M50 8 L93 33 L93 50 L50 25 L7 50 L7 33 Z" fill="rgba(255,255,255,0.22)" />
      {label && (
        <text x="50" y="68" textAnchor="middle" fontFamily={FONT} fontWeight="900" fontSize="30" fill="#0b1426">
          {label}
        </text>
      )}
    </svg>
  );
}

/** Fades a whole scene in and out at its edges. */
export function SceneFade({ dur, children }: { dur: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 14, dur - 14, dur], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}
