// WO-028 alternative look "euclid": compass-and-straightedge geometry instead of a nebula. Thin white
// construction lines draw themselves behind every beat (a new construction per beat), hard whip-pan cuts,
// a full-screen heartbeat countdown for the thinking moment, a ✕ stamp on the habit, and polygon waves on
// the answer. Pure functions of time, token colours only (see fx.tsx for the default "nebula" look).
import { themed, tokens } from '@lens/scenes';
import type { ReactNode } from 'react';
import { kick, seeded } from './fx';

const C = themed(tokens, 'short_dark').tokens.color;
const [W, H] = tokens.layout.short.size_px;
const NUM = `"${tokens.type.family_num}", "${tokens.type.family_ja}", sans-serif`;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Fraction of a path drawn, for pathLength=1 dashes. */
const draw = (p: number) => ({ pathLength: 1, strokeDasharray: '1 1', strokeDashoffset: 1 - clamp(p) });

/**
 * A ruler-and-compass construction that draws itself over `life` ms from `at`: two circles through each
 * other's centres, their intersections, the equilateral triangle and hexagon they make, then the
 * circumcircle; slowly rotating. A new seed gives a new place, size and turn.
 */
function Construction({ ms, at, seed, hue, life = 6000 }: { ms: number; at: number; seed: string; hue: string; life?: number }) {
  const rnd = seeded(seed);
  const cx = W * (0.25 + rnd() * 0.5);
  const cy = H * (0.22 + rnd() * 0.56);
  const r = 220 + rnd() * 260;
  const turn = rnd() * 360;
  const t = ms - at;
  if (t < 0) return null;
  const p = (a: number, d: number) => easeInOut(clamp((t - a) / d));
  const fade = clamp(1 - (t - life) / 1200);
  if (fade <= 0) return null;
  const a1 = { x: -r / 2, y: 0 };
  const a2 = { x: r / 2, y: 0 };
  const h = (Math.sqrt(3) / 2) * r;
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
  }).join(' ');
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${turn + t * 0.004})`} opacity={fade} fill="none" strokeLinecap="round">
      <circle cx={a1.x} cy={a1.y} r={r} stroke={C.ink.value} strokeWidth={2} opacity={0.22} {...draw(p(0, 1400))} />
      <circle cx={a2.x} cy={a2.y} r={r} stroke={C.ink.value} strokeWidth={2} opacity={0.22} {...draw(p(500, 1400))} />
      <line x1={-r * 1.6} y1={0} x2={r * 1.6} y2={0} stroke={C.ink.value} strokeWidth={2} opacity={0.18} {...draw(p(900, 900))} />
      <line x1={0} y1={-h * 1.4} x2={0} y2={h * 1.4} stroke={hue} strokeWidth={2.5} opacity={0.35} {...draw(p(1600, 900))} />
      <polygon points={`${a1.x},0 ${a2.x},0 0,${-h}`} stroke={hue} strokeWidth={3} opacity={0.45} {...draw(p(2100, 1000))} />
      <polygon points={hex} stroke={C.ink.value} strokeWidth={2} opacity={0.16} transform={`translate(0 0) scale(0.5)`} {...draw(p(2800, 1300))} />
      <circle r={r * 1.15} stroke={hue} strokeWidth={1.5} opacity={0.25} strokeDasharray="6 14" />
      {[a1, a2, { x: 0, y: -h }, { x: 0, y: h }].map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r={7} fill={i < 2 ? C.ink.value : hue} stroke="none" opacity={0.6 * p(400 + i * 500, 300)} />
      ))}
    </g>
  );
}

/**
 * The background of the euclid look: near-black, a fine dot lattice, a scanning light line, and a fresh
 * construction for every beat (the previous one fades out under it).
 */
export function EuclidField({ ms, hue, beats, energy }: { ms: number; hue: string; beats: number[]; energy: number }) {
  const s = ms / 1000;
  const scan = ((s * 0.35) % 1) * H;
  const recent = beats.filter((b) => b <= ms).slice(-2);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <pattern id="eu-dots" width={54} height={54} patternUnits="userSpaceOnUse">
            <circle cx={27} cy={27} r={1.6} fill={C.ink.value} opacity={0.18} />
          </pattern>
          <linearGradient id="eu-scan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={hue} stopOpacity={0} />
            <stop offset="0.5" stopColor={hue} stopOpacity={0.22 * energy} />
            <stop offset="1" stopColor={hue} stopOpacity={0} />
          </linearGradient>
          <radialGradient id="eu-vig" cx="50%" cy="45%" r="75%">
            <stop offset="0.5" stopColor={C.paper.value} stopOpacity={0} />
            <stop offset="1" stopColor={C.paper.value} stopOpacity={1} />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#eu-dots)" />
        <rect y={scan - 120} width={W} height={240} fill="url(#eu-scan)" />
        {recent.map((b) => (
          <Construction key={b} ms={ms} at={b} seed={`euclid-${b}`} hue={hue} />
        ))}
        <rect width={W} height={H} fill="url(#eu-vig)" />
      </svg>
    </div>
  );
}

/** Hard cut with a whip pan: the new beat slides in from the right with a short blur and speed streaks. */
export function WhipPan({ ms, at, children, shake = 0 }: { ms: number; at: number; children: ReactNode; shake?: number }) {
  const p = easeOut((ms - at) / 380);
  const x = (1 - p) * W * 0.9;
  const sx = shake * Math.sin(ms * 0.09) * 16;
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translateX(${x + sx}px) scale(${1 + 0.06 * kick(ms, at, 500)})`, transformOrigin: '50% 45%', filter: p < 1 ? `blur(${(1 - p) * 10}px)` : undefined }}>
      {children}
    </div>
  );
}

export function Streaks({ ms, at, hue }: { ms: number; at: number; hue: string }) {
  const dt = ms - at;
  if (dt < 0 || dt > 420) return null;
  const rnd = seeded(`streak-${at}`);
  const o = 1 - dt / 420;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {Array.from({ length: 16 }, (_, i) => {
        const y = rnd() * H;
        const len = 300 + rnd() * 700;
        const x = W - (dt / 420) * (W + len) * (0.8 + rnd() * 0.6);
        return <line key={i} x1={x} y1={y} x2={x + len} y2={y} stroke={i % 3 ? C.ink.value : hue} strokeWidth={2 + rnd() * 4} opacity={0.5 * o} />;
      })}
    </svg>
  );
}

/** The thinking moment: a full-screen numeral that beats like a heart, with a radial clock sweep. */
export function BigCount({ ms, start, hue }: { ms: number; start: number; hue: string }) {
  const t = ms - start;
  if (t < 0 || t >= 3000) return null;
  const n = 3 - Math.floor(t / 1000);
  const local = t % 1000;
  const beat = 1 + 0.18 * kick(local, 0, 260) + 0.06 * kick(local, 260, 200);
  const sweep = t / 3000;
  const R = 330;
  const CY = H * 0.56;
  const large = sweep > 0.5 ? 1 : 0;
  const a = sweep * Math.PI * 2 - Math.PI / 2;
  const arc = `M ${W / 2} ${CY - R} A ${R} ${R} 0 ${large} 1 ${W / 2 + Math.cos(a) * R} ${CY + Math.sin(a) * R}`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <circle cx={W / 2} cy={CY} r={R} fill="none" stroke={C.ink.value} strokeWidth={3} opacity={0.12} />
      <path d={arc} fill="none" stroke={hue} strokeWidth={10} strokeLinecap="round" opacity={0.7} />
      {Array.from({ length: 60 }, (_, i) => {
        const aa = (i / 60) * Math.PI * 2;
        const on = i / 60 <= sweep;
        return <line key={i} x1={W / 2 + Math.cos(aa) * (R - 26)} y1={CY + Math.sin(aa) * (R - 26)} x2={W / 2 + Math.cos(aa) * (R - (i % 5 ? 10 : 0))} y2={CY + Math.sin(aa) * (R - (i % 5 ? 10 : 0))} stroke={on ? hue : C.ink.value} strokeWidth={i % 5 ? 3 : 6} opacity={on ? 0.8 : 0.15} />;
      })}
      <g transform={`translate(${W / 2} ${CY}) scale(${beat})`}>
        <text y={185} textAnchor="middle" fontFamily={NUM} fontWeight={900} fontSize={520} fill={hue} opacity={0.2}>
          {n}
        </text>
        <text y={185} textAnchor="middle" fontFamily={NUM} fontWeight={900} fontSize={520} fill="none" stroke={hue} strokeWidth={6} opacity={0.75}>
          {n}
        </text>
      </g>
    </svg>
  );
}

/** A rubber-stamp ✕ that slams down at `at` (the habit's route is a dead end). */
export function Stamp({ ms, at, x, y }: { ms: number; at: number; x: number; y: number }) {
  const dt = ms - at;
  if (dt < 0) return null;
  const p = easeOut(dt / 220);
  const s = 2.2 - 1.2 * p;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <g transform={`translate(${x} ${y}) rotate(-12) scale(${s})`} opacity={Math.min(1, dt / 120) * 0.92}>
        <circle r={150} fill="none" stroke={C.trap.flag.value} strokeWidth={14} />
        <path d="M -80 -80 L 80 80 M 80 -80 L -80 80" stroke={C.trap.flag.value} strokeWidth={30} strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Polygon waves from (x, y): triangle, square, pentagon, hexagon rings expanding and turning. */
export function PolyWave({ ms, at, x, y, hues }: { ms: number; at: number; x: number; y: number; hues: string[] }) {
  const dt = ms - at;
  if (dt < 0 || dt > 1600) return null;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen' }}>
      {[3, 4, 5, 6, 8].map((sides, k) => {
        const p = clamp((dt - k * 110) / 1100);
        if (p <= 0) return null;
        const r = 40 + 900 * easeOut(p);
        const pts = Array.from({ length: sides }, (_, i) => {
          const a = (i / sides) * Math.PI * 2 + p * 1.2 + k;
          return `${(x + Math.cos(a) * r).toFixed(1)},${(y + Math.sin(a) * r).toFixed(1)}`;
        }).join(' ');
        return <polygon key={k} points={pts} fill="none" stroke={hues[k % hues.length]} strokeWidth={8 * (1 - p)} opacity={1 - p} />;
      })}
    </svg>
  );
}
