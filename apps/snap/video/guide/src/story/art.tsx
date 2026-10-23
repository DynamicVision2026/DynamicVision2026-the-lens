import "@fontsource/klee-one/600.css";
import { tr } from "../vlang";
import type { CSSProperties, ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, FONT, clamp, ease } from "../v2/kit";

/** Illustration kit for the story film: a night kitchen table, drawn in SVG/CSS (no faces, hands only). */

export const HAND = '"Klee One", "Noto Sans CJK JP", sans-serif';
export const S = {
  wall0: "#0f1530",
  wall1: "#1f2850",
  table0: "#6b4a32",
  table1: "#4a3222",
  paper: "#fbf8f1",
  rule: "#c9d6ea",
  ink: "#2b3550",
  red: "#e0483c",
  warm: "rgba(255,196,120,",
  skin: "#f2c9a5",
  skin2: "#e3b08b",
};

const hash = (n: number) => {
  const x = Math.sin(n * 91.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------------------------------------------------------------- room

/** Night wall + window with moon, table surface from `tableY`, warm lamp glow around (gx, gy). */
export function NightRoom({ w, h, tableY, gx, gy, warmth = 1, children }: { w: number; h: number; tableY: number; gx: number; gy: number; warmth?: number; children?: ReactNode }) {
  const f = useCurrentFrame();
  const flick = 1 + Math.sin(f / 9) * 0.015 + Math.sin(f / 23) * 0.01;
  const ww = Math.min(w, h) * 0.3;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: `linear-gradient(180deg, ${S.wall0}, ${S.wall1} ${tableY}px)` }}>
      {/* window */}
      <div style={{ position: "absolute", left: w * 0.07, top: h * 0.08, width: ww, height: ww * 1.15, borderRadius: 10, background: "linear-gradient(180deg, #0a1028, #1b2a5a)", border: "10px solid #2a335a", boxShadow: "inset 0 0 40px rgba(0,0,0,0.6)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: ww * 0.55, top: ww * 0.18, width: ww * 0.22, height: ww * 0.22, borderRadius: "50%", background: "#fdf3cf", boxShadow: "0 0 50px rgba(253,243,207,0.6)" }} />
        <div style={{ position: "absolute", left: ww * 0.6, top: ww * 0.15, width: ww * 0.2, height: ww * 0.2, borderRadius: "50%", background: "#13204a" }} />
        {Array.from({ length: 14 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: hash(i) * ww, top: hash(i + 30) * ww, width: 3, height: 3, borderRadius: 2, background: "#fff", opacity: 0.4 + 0.5 * Math.abs(Math.sin(f / 20 + i)) }} />
        ))}
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 8, marginLeft: -4, background: "#2a335a" }} />
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 8, marginTop: -4, background: "#2a335a" }} />
      </div>
      {/* table */}
      <div style={{ position: "absolute", left: 0, right: 0, top: tableY, bottom: 0, background: `linear-gradient(180deg, ${S.table0}, ${S.table1})` }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 10, background: "rgba(255,255,255,0.08)" }} />
      </div>
      {children}
      {/* lamp glow + vignette */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse ${w * 0.55 * flick}px ${h * 0.5 * flick}px at ${gx}px ${gy}px, ${S.warm}${0.34 * warmth}) 0%, ${S.warm}${0.12 * warmth}) 45%, rgba(0,0,0,0) 75%)`, mixBlendMode: "screen" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse at ${gx}px ${gy}px, rgba(0,0,0,0) 35%, rgba(3,6,16,${0.75 - 0.25 * warmth}) 100%)` }} />
    </div>
  );
}

/** Desk lamp standing on the table; (x, y) = base centre. */
export function Lamp({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) {
  return (
    <svg style={{ position: "absolute", left: x - 160 * s, top: y - 420 * s, overflow: "visible", transform: flip ? "scaleX(-1)" : undefined }} width={320 * s} height={420 * s} viewBox="0 0 320 420">
      <ellipse cx="160" cy="410" rx="90" ry="14" fill="#1d2235" />
      <rect x="150" y="190" width="12" height="220" rx="6" fill="#2c3350" transform="rotate(-12 156 400)" />
      <rect x="60" y="120" width="12" height="150" rx="6" fill="#2c3350" transform="rotate(48 66 260)" />
      <path d="M10 150 L120 95 L150 165 L40 215 Z" fill="#e8a33c" />
      <ellipse cx="25" cy="183" rx="22" ry="38" fill="#fff4cf" transform="rotate(-26 25 183)" />
    </svg>
  );
}

/** Wall clock; `min` = minutes after midnight (may run fast for time-lapses). */
export function Clock({ x, y, r = 90, min }: { x: number; y: number; r?: number; min: number }) {
  const ha = ((min / 60) % 12) * 30;
  const ma = (min % 60) * 6;
  return (
    <svg style={{ position: "absolute", left: x - r, top: y - r, overflow: "visible" }} width={r * 2} height={r * 2} viewBox="-100 -100 200 200">
      <circle r="96" fill="#f6f1e6" stroke="#3a4266" strokeWidth="8" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1="0" y1="-80" x2="0" y2={i % 3 === 0 ? -64 : -72} stroke="#3a4266" strokeWidth={i % 3 === 0 ? 7 : 4} transform={`rotate(${i * 30})`} strokeLinecap="round" />
      ))}
      <line x1="0" y1="10" x2="0" y2="-46" stroke="#20263d" strokeWidth="9" strokeLinecap="round" transform={`rotate(${ha})`} />
      <line x1="0" y1="14" x2="0" y2="-70" stroke="#20263d" strokeWidth="5" strokeLinecap="round" transform={`rotate(${ma})`} />
      <circle r="7" fill={S.red} />
    </svg>
  );
}

export function Mug({ x, y, s = 1, color = "#e9eef7", steam = true }: { x: number; y: number; s?: number; color?: string; steam?: boolean }) {
  const f = useCurrentFrame();
  return (
    <svg style={{ position: "absolute", left: x - 60 * s, top: y - 150 * s, overflow: "visible" }} width={130 * s} height={150 * s} viewBox="0 0 130 150">
      {steam &&
        [0, 1].map((i) => (
          <path key={i} d={`M${40 + i * 26} 50 q -12 -16 0 -30 q 12 -14 0 -30`} stroke="rgba(255,255,255,0.35)" strokeWidth="5" fill="none" strokeLinecap="round" opacity={0.4 + 0.4 * Math.sin(f / 12 + i * 2)} transform={`translate(0 ${-((f / 2 + i * 9) % 12)})`} />
        ))}
      <path d="M90 78 q 32 4 26 28 q -6 20 -30 16" stroke={color} strokeWidth="11" fill="none" />
      <rect x="10" y="58" width="86" height="88" rx="14" fill={color} />
      <ellipse cx="53" cy="60" rx="43" ry="10" fill="#5a3b26" />
    </svg>
  );
}

export function Calendar({ x, y, s = 1, day, note }: { x: number; y: number; s?: number; day: string; note?: string }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 200 * s, transform: `scale(${s})`, transformOrigin: "0 0" }}>
      <div style={{ width: 200, borderRadius: 10, overflow: "hidden", background: "#fff", boxShadow: "0 12px 30px rgba(0,0,0,0.5)", fontFamily: FONT, textAlign: "center" }}>
        <div style={{ background: S.red, color: "#fff", fontSize: 26, fontWeight: 900, padding: "6px 0" }}>10月</div>
        <div style={{ fontSize: 92, fontWeight: 900, color: S.ink, lineHeight: 1.15 }}>{day}</div>
      </div>
      {note && (
        <div style={{ position: "absolute", left: 120, top: 120, padding: "8px 16px", background: "#fff27a", fontFamily: HAND, fontWeight: 600, fontSize: 30, color: S.red, transform: "rotate(8deg)", boxShadow: "0 8px 18px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>
          {note}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- notebook + pencil

/** Approximate rendered width of a string (full-width ≈ 1em, ASCII ≈ 0.56em). */
export const textW = (t: string, size: number) => [...t].reduce((a, ch) => a + (ch.charCodeAt(0) < 0x2000 ? 0.56 : 1) * size, 0);

export type Ink = { kind: "text"; text: string; x: number; y: number; size?: number; color?: string } | { kind: "path"; d: string; len: number; color?: string };

/** Hand holding a pencil, tip at (0,0). */
export function PencilHand({ x, y, s = 1, wobble = 0 }: { x: number; y: number; s?: number; wobble?: number }) {
  return (
    <svg style={{ position: "absolute", left: x, top: y, overflow: "visible", transform: `rotate(${wobble}deg)`, transformOrigin: "0 0" }} width={1} height={1}>
      <g transform={`scale(${s})`}>
        <g transform="rotate(-38)">
          <polygon points="0,0 -9,-30 9,-30" fill="#f3d1a2" />
          <polygon points="0,0 -3.5,-11 3.5,-11" fill="#33374a" />
          <rect x="-9" y="-250" width="18" height="220" fill="#f6c453" />
          <rect x="-9" y="-250" width="6" height="220" fill="#e3ad35" />
          <rect x="-10" y="-276" width="20" height="28" rx="3" fill="#f08b9a" />
        </g>
        {/* hand */}
        <g transform="translate(70 -95) rotate(-20)">
          <ellipse cx="40" cy="40" rx="78" ry="58" fill={S.skin} />
          <ellipse cx="-22" cy="52" rx="30" ry="18" fill={S.skin2} transform="rotate(-30 -22 52)" />
          <ellipse cx="-30" cy="22" rx="28" ry="15" fill={S.skin} transform="rotate(-10 -30 22)" />
          <rect x="70" y="0" width="160" height="96" rx="40" fill="#8aa0c8" />
        </g>
      </g>
    </svg>
  );
}

/**
 * Open notebook (w × h) at (x, y). `ink` items are written in order; `p` in [0,1] is overall writing progress.
 * Returns the notebook plus the pencil following the current stroke when `pencil` is set.
 */
export function Notebook({ x, y, w, h, ink, p, pencil = true, title, style }: { x: number; y: number; w: number; h: number; ink: Ink[]; p: number; pencil?: boolean; title?: string; style?: CSSProperties }) {
  const f = useCurrentFrame();
  const weights = ink.map((it) => (it.kind === "text" ? [...it.text].length : it.len / 40));
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  let tip: [number, number] | null = null;
  const items = ink.map((it, i) => {
    const a = acc / total;
    acc += weights[i];
    const b = acc / total;
    const q = interpolate(p, [a, b], [0, 1], clamp);
    if (it.kind === "text") {
      const size = it.size ?? 34;
      const tw = textW(it.text, size);
      if (q > 0 && q < 1) tip = [it.x + tw * q, it.y + size * 0.85];
      return (
        <div key={i} style={{ position: "absolute", left: it.x, top: it.y, fontFamily: HAND, fontWeight: 600, fontSize: size, color: it.color ?? S.ink, whiteSpace: "nowrap", clipPath: `inset(-20% ${(1 - q) * 100}% -20% 0)` }}>
          {it.text}
        </div>
      );
    }
    if (q > 0 && q < 1) tip = null; // set below from path midpoint estimate
    return (
      <svg key={i} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={w} height={h}>
        <path d={it.d} stroke={it.color ?? S.ink} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={it.len} strokeDashoffset={it.len * (1 - q)} />
      </svg>
    );
  });
  // pencil on a path stroke: walk the polyline points of a simple "M x y L x y ..." path
  for (let i = 0, acc2 = 0; i < ink.length; i++) {
    const it = ink[i];
    const a = acc2 / total;
    acc2 += weights[i];
    const b = acc2 / total;
    if (it.kind !== "path" || p <= a || p >= b) continue;
    const pts = (it.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    const segs: [number, number, number, number, number][] = [];
    let L = 0;
    for (let k = 2; k + 1 < pts.length; k += 2) {
      const l = Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]);
      segs.push([pts[k - 2], pts[k - 1], pts[k], pts[k + 1], l]);
      L += l;
    }
    let want = ((p - a) / (b - a)) * L;
    for (const [x0, y0, x1, y1, l] of segs) {
      if (want <= l) {
        tip = [x0 + ((x1 - x0) * want) / l, y0 + ((y1 - y0) * want) / l];
        break;
      }
      want -= l;
    }
  }
  const rules = Math.floor((h - 70) / 54);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, ...style }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 10, background: S.paper, boxShadow: "0 30px 70px rgba(0,0,0,0.55)", overflow: "hidden" }}>
        {Array.from({ length: rules }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: 30, right: 30, top: 70 + i * 54, height: 2, background: S.rule }} />
        ))}
        <div style={{ position: "absolute", left: w / 2 - 1, top: 0, bottom: 0, width: 2, background: "rgba(0,0,0,0.12)" }} />
        <div style={{ position: "absolute", left: w / 2 - 40, top: 0, bottom: 0, width: 80, background: "linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,0.08), rgba(0,0,0,0))" }} />
        {title && <div style={{ position: "absolute", left: 40, top: 18, fontFamily: HAND, fontWeight: 600, fontSize: 30, color: S.red }}>{title}</div>}
        {items}
      </div>
      {pencil && tip && <PencilHand x={(tip as [number, number])[0]} y={(tip as [number, number])[1]} s={Math.max(0.7, w / 1100)} wobble={Math.sin(f * 1.7) * 1.5} />}
    </div>
  );
}

// ---------------------------------------------------------------- notebook stack

const BOOK = ["#e9706a", "#5aa7e0", "#6cc79a", "#f2b84b", "#a48be8", "#ef8fb2", "#7fd3d6", "#f08a5d"];
const NUM = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";

/** A growing pile of まちがいノート; `n` may be fractional (the top one is dropping in). */
export function Stack({ x, y, n, bw = 380, bh = 52, sway = 0 }: { x: number; y: number; n: number; bw?: number; bh?: number; sway?: number }) {
  const f = useCurrentFrame();
  const whole = Math.floor(n);
  const frac = n - whole;
  const books = Array.from({ length: whole + (frac > 0 ? 1 : 0) }, (_, i) => i);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0 }}>
      {books.map((i) => {
        const drop = i === whole ? interpolate(frac, [0, 1], [-420, 0], { ...clamp, easing: ease }) : 0;
        const op = i === whole ? Math.min(1, frac * 3) : 1;
        const tilt = (hash(i + 3) - 0.5) * 6 + Math.sin(f / 10 + i / 2) * sway * (i / 6);
        const dx = (hash(i + 11) - 0.5) * 30 + Math.sin(f / 12) * sway * i * 1.4;
        return (
          <div key={i} style={{ position: "absolute", left: -bw / 2 + dx, top: -bh * (i + 1) + drop, width: bw, height: bh - 4, borderRadius: 6, background: BOOK[i % BOOK.length], transform: `rotate(${tilt}deg)`, opacity: op, boxShadow: "0 6px 12px rgba(0,0,0,0.35)", display: "flex", alignItems: "center", paddingLeft: 18, fontFamily: HAND, fontWeight: 600, fontSize: bh * 0.46, color: "rgba(255,255,255,0.95)" }}>
            <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: bw * 0.12, background: "rgba(255,255,255,0.85)", borderRadius: "0 6px 6px 0" }} />
            {tr("まちがいノート")} {NUM[i % NUM.length]}
          </div>
        );
      })}
    </div>
  );
}

/** A page fanning over (for flip-throughs): angle 0 = flat right, 180 = flat left. */
export function FlipPage({ x, y, w, h, angle }: { x: number; y: number; w: number; h: number; angle: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, transformOrigin: "0 50%", transform: `perspective(1600px) rotateY(${-angle}deg)`, background: S.paper, borderRadius: "0 10px 10px 0", boxShadow: "0 10px 30px rgba(0,0,0,0.3)", backfaceVisibility: "visible", overflow: "hidden" }}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: 30, right: 30 + (i % 3) * 60, top: 80 + i * 54, height: 14, borderRadius: 7, background: i % 4 === 1 ? "rgba(224,72,60,0.45)" : "rgba(43,53,80,0.25)" }} />
      ))}
    </div>
  );
}

/** Speaker chip for subtitles. */
export function Who({ v }: { v: string }) {
  if (v === "n") return null;
  const label = v === "m" ? "母" : "子";
  const col = v === "m" ? C.accent : C.cyan;
  return <span style={{ display: "inline-block", marginRight: 14, padding: "2px 14px", borderRadius: 999, background: col, color: "#0b1830", fontSize: "0.72em", verticalAlign: "0.12em" }}>{label}</span>;
}
