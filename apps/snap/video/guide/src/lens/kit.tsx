import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { HAND } from "../story/art";
import { FONT, clamp, ease, usePop } from "../v2/kit";

/**
 * 視点レンズ promo look (approved Oct 26): a real exam sheet on graph paper, red for the clock and being stuck,
 * gold for the lens moment, the student's attempts in handwriting, navy only for the end card.
 */
export const P = {
  paper: "#fdfcf8",
  sheet: "#ffffff",
  grid: "rgba(120,150,190,0.16)",
  ink: "#1f2a44",
  muted: "#5d6680",
  pencil: "#4d5d8a",
  trap: "#8a90a3",
  red: "#d8372b",
  gold: "#e3a51c",
  goldInk: "#a8730a",
  goldSoft: "#fff4d6",
  navy: "#1f2a44",
  line: "#d9d5ca",
};
export { HAND };

export function PaperBg({ cell = 36 }: { cell?: number }) {
  return (
    <AbsoluteFill style={{ background: P.paper }}>
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${P.grid} 1.5px, transparent 1.5px), linear-gradient(90deg, ${P.grid} 1.5px, transparent 1.5px)`, backgroundSize: `${cell}px ${cell}px` }} />
      <AbsoluteFill style={{ background: "radial-gradient(1400px 1000px at 50% 45%, transparent 60%, rgba(31,42,68,0.10))" }} />
    </AbsoluteFill>
  );
}

/** Exam sheet: header line + the problem text. */
export function Sheet({ head, text, style, size = 40, children }: { head: string; text: string; style?: CSSProperties; size?: number; children?: ReactNode }) {
  return (
    <div style={{ position: "absolute", background: P.sheet, borderRadius: 10, boxShadow: "0 24px 60px rgba(31,42,68,0.16)", padding: "34px 40px", fontFamily: FONT, color: P.ink, ...style }}>
      <div style={{ fontSize: size * 0.8, fontWeight: 900, borderBottom: `4px solid ${P.ink}`, paddingBottom: 10 }}>{head}</div>
      <div style={{ fontSize: size, fontWeight: 700, lineHeight: 1.6, marginTop: 22 }}>{text}</div>
      {children}
    </div>
  );
}

/** Red countdown clock: starts at `startSec`, runs `rate`× real time from frame `from`; the ring drains. */
export function Clock({ from = 0, startSec = 180, rate = 1, size = 150, style }: { from?: number; startSec?: number; rate?: number; size?: number; style?: CSSProperties }) {
  const f = useCurrentFrame();
  const left = Math.max(0, startSec - (Math.max(0, f - from) / 30) * rate);
  const m = Math.floor(left / 60);
  const s = Math.floor(left % 60);
  const k = left / startSec;
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const pulse = 1 + 0.035 * Math.max(0, Math.sin((f / 30) * Math.PI * 2)) ** 8;
  return (
    <div style={{ position: "absolute", width: size, height: size, transform: `scale(${pulse})`, ...style }}>
      <svg width={size} height={size} style={{ position: "absolute", inset: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r + 4} fill={P.sheet} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(216,55,43,0.18)" strokeWidth={10} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={P.red} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${c * k} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: FONT, fontWeight: 900, fontSize: size * 0.27, color: P.red, fontVariantNumeric: "tabular-nums" }}>
        {m}:{String(s).padStart(2, "0")}
      </div>
    </div>
  );
}

/** Handwritten attempt lines appearing one by one (grey = the habit route); `cross` strikes them in red. */
export function Scribble({ lines, start, every = 18, size = 38, cross, style }: { lines: string[]; start: number; every?: number; size?: number; cross?: number; style?: CSSProperties }) {
  const f = useCurrentFrame();
  const x = cross === undefined ? 0 : interpolate(f, [cross, cross + 10], [0, 1], { ...clamp, easing: ease });
  return (
    <div style={{ position: "absolute", fontFamily: HAND, fontWeight: 600, fontSize: size, color: P.trap, lineHeight: 1.55, ...style }}>
      {lines.map((l, i) => {
        const q = interpolate(f, [start + i * every, start + i * every + every * 0.8], [0, 1], clamp);
        return (
          <div key={i} style={{ whiteSpace: "nowrap", clipPath: `inset(-20% ${(1 - q) * 100}% -20% 0)` }}>
            {l}
          </div>
        );
      })}
      {x > 0 && (
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
          <line x1="0" y1="100%" x2={`${x * 100}%`} y2={`${100 - x * 100}%`} stroke={P.red} strokeWidth={8} strokeLinecap="round" opacity={0.75} />
        </svg>
      )}
    </div>
  );
}

/** The gold lens: a ring that pops in with a glow around what to look at. */
export function LensRing({ at, size = 360, style, children }: { at: number; size?: number; style?: CSSProperties; children?: ReactNode }) {
  const f = useCurrentFrame();
  const p = usePop(at, 11);
  if (f < at) return null;
  const glow = 0.55 + 0.25 * Math.sin((f - at) / 9);
  return (
    <div style={{ position: "absolute", width: size, height: size, borderRadius: "50%", border: `${size * 0.035}px solid ${P.gold}`, boxShadow: `0 0 0 ${size * 0.03}px rgba(227,165,28,0.18), 0 0 ${size * 0.25}px rgba(227,165,28,${glow})`, background: "rgba(255,248,225,0.94)", display: "grid", placeItems: "center", textAlign: "center", transform: `scale(${Math.min(1.06, p)})`, opacity: Math.min(1, p * 1.5), fontFamily: FONT, color: P.ink, ...style }}>
      <div>{children}</div>
    </div>
  );
}

/** A label chip (lens names, steps). */
export function Chip({ children, on, style }: { children: ReactNode; on?: boolean; style?: CSSProperties }) {
  return (
    <span style={{ display: "inline-block", fontFamily: FONT, fontWeight: 900, border: `4px solid ${on ? P.gold : P.ink}`, background: on ? P.goldSoft : P.sheet, color: P.ink, borderRadius: 999, padding: "6px 26px", whiteSpace: "nowrap", ...style }}>
      {children}
    </span>
  );
}

/** Navy end card: ring, 視点レンズ, a line, domo-ai.com. */
export function EndCard({ line, w = 1920, scale = 1 }: { line: string; w?: number; scale?: number }) {
  const f = useCurrentFrame();
  const a = interpolate(f, [0, 14], [0, 1], { ...clamp, easing: ease });
  const b = usePop(16, 12);
  return (
    <AbsoluteFill style={{ background: P.navy, display: "grid", placeItems: "center", textAlign: "center", fontFamily: FONT, color: "#fff" }}>
      <div style={{ opacity: a, transform: `translateY(${(1 - a) * 20}px)`, width: w * 0.86 }}>
        <div style={{ width: 150 * scale, height: 150 * scale, margin: "0 auto", borderRadius: "50%", border: `${12 * scale}px solid ${P.gold}`, boxShadow: `0 0 ${60 * scale}px rgba(227,165,28,0.65)` }} />
        <div style={{ marginTop: 34 * scale, fontSize: 120 * scale, fontWeight: 900, letterSpacing: "0.06em" }}>視点レンズ</div>
        <div style={{ marginTop: 18 * scale, fontSize: 42 * scale, fontWeight: 700, color: "#cfd6ea" }}>{line}</div>
        <div style={{ marginTop: 50 * scale, display: "inline-block", background: P.gold, color: P.navy, fontWeight: 900, fontSize: 70 * scale, borderRadius: 999, padding: `${12 * scale}px ${60 * scale}px`, transform: `scale(${0.75 + 0.25 * Math.min(1, b)})`, opacity: Math.min(1, b) }}>domo-ai.com</div>
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------- the three example figures

/** 中学受験 和差一定: father and child age bars grow together; the gap (30) stays the same; 45 = 3 × 15. */
export function AgeBars({ start, grow, done, w = 900, note = "差 30\nずっと同じ" }: { start: number; grow: number; done: number; w?: number; note?: string }) {
  const f = useCurrentFrame();
  const k = interpolate(f, [grow, grow + 60], [0, 7], { ...clamp, easing: ease });
  const unit = w / 50;
  const bar = (age: number, color: string, label: string, y: number) => (
    <div style={{ position: "absolute", left: 0, top: y, display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ width: 150, fontFamily: FONT, fontWeight: 900, fontSize: 34, color: P.ink }}>{label}</div>
      <div style={{ width: age * unit, height: 60, background: color, borderRadius: 8 }} />
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 40, color: P.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{Math.round(age)}才</div>
    </div>
  );
  const vis = interpolate(f, [start, start + 12], [0, 1], clamp);
  const gap = interpolate(f, [start + 20, start + 34], [0, 1], clamp);
  const fin = interpolate(f, [done, done + 14], [0, 1], clamp);
  return (
    <div style={{ position: "relative", width: w + 260, height: 300, opacity: vis }}>
      {bar(38 + k, P.pencil, "お父さん", 20)}
      {bar(8 + k, P.gold, "子ども", 130)}
      <div style={{ position: "absolute", left: 168 + (8 + k) * unit, top: 96, width: 30 * unit, borderTop: `5px solid ${P.red}`, opacity: gap }}>
        <div style={{ position: "absolute", right: 0, top: 12, textAlign: "right", fontFamily: FONT, fontWeight: 900, fontSize: 30, lineHeight: 1.15, color: P.red, whiteSpace: "pre" }}>{note}</div>
      </div>
      <div style={{ position: "absolute", left: 0, top: 230, fontFamily: FONT, fontWeight: 900, fontSize: 40, color: P.goldInk, opacity: fin }}>45 ＝ 15 × 3 → 7年後</div>
    </div>
  );
}

/** 高校受験 折り返す→囲む: A(−2,3), B(6,5); B′(6,−5); line A–B′ meets the x-axis at P(1,0); enclose △ABP → 15 cm². */
export function MirrorFig({ start, reflect, joinAt, enclose, size = 620 }: { start: number; reflect: number; joinAt: number; enclose: number; size?: number }) {
  const f = useCurrentFrame();
  const X0 = -3, X1 = 7, Y0 = -6, Y1 = 6;
  const sx = size / (X1 - X0);
  const H = (Y1 - Y0) * sx;
  const px = (x: number) => (x - X0) * sx;
  const py = (y: number) => (Y1 - y) * sx;
  const v = interpolate(f, [start, start + 12], [0, 1], clamp);
  const r = interpolate(f, [reflect, reflect + 24], [0, 1], { ...clamp, easing: ease });
  const j = interpolate(f, [joinAt, joinAt + 24], [0, 1], { ...clamp, easing: ease });
  const e = interpolate(f, [enclose, enclose + 18], [0, 1], { ...clamp, easing: ease });
  const A = [-2, 3], B = [6, 5], Bp = [6, -5], Pp = [1, 0];
  const by = L(5, -5, r);
  const dot = (x: number, y: number, c: string, label: string, dx = 14, dy = -14, o = 1) => (
    <g opacity={o}>
      <circle cx={px(x)} cy={py(y)} r={11} fill={c} />
      <text x={px(x) + dx} y={py(y) + dy} fontFamily={FONT} fontWeight={900} fontSize={34} fill={P.ink}>{label}</text>
    </g>
  );
  const grid = [];
  for (let x = X0; x <= X1; x++) grid.push(<line key={`x${x}`} x1={px(x)} y1={0} x2={px(x)} y2={H} stroke={P.grid} strokeWidth={2} />);
  for (let y = Y0; y <= Y1; y++) grid.push(<line key={`y${y}`} x1={0} y1={py(y)} x2={size} y2={py(y)} stroke={P.grid} strokeWidth={2} />);
  return (
    <svg width={size} height={H} style={{ overflow: "visible", opacity: v }}>
      {grid}
      <line x1={0} y1={py(0)} x2={size} y2={py(0)} stroke={P.ink} strokeWidth={4} />
      <line x1={px(0)} y1={0} x2={px(0)} y2={H} stroke={P.ink} strokeWidth={4} />
      <text x={size - 30} y={py(0) - 12} fontFamily={FONT} fontWeight={900} fontSize={30} fill={P.ink}>x</text>
      {e > 0 && (
        <g opacity={e}>
          <rect x={px(-2)} y={py(5)} width={8 * sx} height={5 * sx} fill="none" stroke={P.gold} strokeWidth={6} strokeDasharray="14 10" />
          <polygon points={`${px(A[0])},${py(A[1])} ${px(B[0])},${py(B[1])} ${px(Pp[0])},${py(Pp[1])}`} fill="rgba(227,165,28,0.35)" stroke={P.gold} strokeWidth={5} />
          <text x={px(1.4)} y={py(3.2)} fontFamily={FONT} fontWeight={900} fontSize={54} fill={P.goldInk}>15</text>
        </g>
      )}
      {r > 0 && <line x1={px(6)} y1={py(5)} x2={px(6)} y2={py(by)} stroke={P.gold} strokeWidth={4} strokeDasharray="10 8" />}
      {j > 0 && <line x1={px(A[0])} y1={py(A[1])} x2={px(L(A[0], Bp[0], j))} y2={py(L(A[1], Bp[1], j))} stroke={P.gold} strokeWidth={7} strokeLinecap="round" />}
      {j > 0.95 && <line x1={px(Pp[0])} y1={py(Pp[1])} x2={px(B[0])} y2={py(B[1])} stroke={P.gold} strokeWidth={7} strokeLinecap="round" />}
      {dot(A[0], A[1], P.ink, "A")}
      {dot(B[0], B[1], P.ink, "B")}
      {r > 0 && dot(6, by, P.gold, "B′", 14, 40, Math.min(1, r * 2))}
      {j > 0.9 && dot(Pp[0], Pp[1], P.red, "P", 10, 44)}
    </svg>
  );
}

/** 大学受験 止める: lines (a+1)x + (a−1)y = 2a for many a all pass through (1, 1). */
export function FreezeFig({ start, spin, lock, size = 620 }: { start: number; spin: number; lock: number; size?: number }) {
  const f = useCurrentFrame();
  const X0 = -3, X1 = 5, Y0 = -3, Y1 = 5;
  const sx = size / (X1 - X0);
  const px = (x: number) => (x - X0) * sx;
  const py = (y: number) => (Y1 - y) * sx;
  const v = interpolate(f, [start, start + 12], [0, 1], clamp);
  const lk = interpolate(f, [lock, lock + 16], [0, 1], { ...clamp, easing: ease });
  const seg = (a: number) => {
    // (a+1)x + (a−1)y = 2a ; draw across the box
    if (Math.abs(a - 1) < 1e-6) return [[1, Y0], [1, Y1]];
    const y = (x: number) => (2 * a - (a + 1) * x) / (a - 1);
    return [[X0, y(X0)], [X1, y(X1)]];
  };
  const t = Math.max(0, f - spin) / 30;
  const as = [-3, -1.5, 0, 0.5, 2, 4];
  const live = Math.tan(Math.atan(-2) + t * 0.8) || 0;
  const grid = [];
  for (let x = X0; x <= X1; x++) grid.push(<line key={`x${x}`} x1={px(x)} y1={0} x2={px(x)} y2={size} stroke={P.grid} strokeWidth={2} />);
  for (let y = Y0; y <= Y1; y++) grid.push(<line key={`y${y}`} x1={0} y1={py(y)} x2={size} y2={py(y)} stroke={P.grid} strokeWidth={2} />);
  return (
    <svg width={size} height={size} style={{ overflow: "hidden", opacity: v }}>
      {grid}
      <line x1={0} y1={py(0)} x2={size} y2={py(0)} stroke={P.ink} strokeWidth={4} />
      <line x1={px(0)} y1={0} x2={px(0)} y2={size} stroke={P.ink} strokeWidth={4} />
      {as.map((a, i) => {
        const [p, q] = seg(a);
        const o = interpolate(f, [spin + i * 8, spin + i * 8 + 10], [0, 0.55], clamp);
        return <line key={i} x1={px(p[0])} y1={py(p[1])} x2={px(q[0])} y2={py(q[1])} stroke={lk > 0 ? P.gold : P.trap} strokeWidth={4} opacity={o} />;
      })}
      {f >= spin && (() => {
        const [p, q] = seg(live);
        return <line x1={px(p[0])} y1={py(p[1])} x2={px(q[0])} y2={py(q[1])} stroke={P.pencil} strokeWidth={6} />;
      })()}
      {lk > 0 && (
        <g opacity={lk}>
          <circle cx={px(1)} cy={py(1)} r={20 + 6 * Math.sin(f / 6)} fill="rgba(227,165,28,0.35)" />
          <circle cx={px(1)} cy={py(1)} r={12} fill={P.red} />
          <text x={px(1) + 22} y={py(1) - 18} fontFamily={FONT} fontWeight={900} fontSize={40} fill={P.ink}>(1, 1)</text>
        </g>
      )}
    </svg>
  );
}

const L = (a: number, b: number, k: number) => a + (b - a) * k;
