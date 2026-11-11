// WO-028 motion layer: the "depth and brightness of mathematics" around the card's figure. Every effect is
// a pure function of time (ms) and a seed, so each frame renders the same way on every machine.
// Colours come from the short_dark theme tokens only.
import { themed, tokens, type LensCard } from '@lens/scenes';
import type { CSSProperties, ReactNode } from 'react';

const C = themed(tokens, 'short_dark').tokens.color;
const [W, H] = tokens.layout.short.size_px;
const JA = `"${tokens.type.family_ja}", sans-serif`;
const NUM = `"${tokens.type.family_num}", "${tokens.type.family_ja}", sans-serif`;

/** Deterministic random numbers (mulberry32) from a string seed. */
export function seeded(seed: string): () => number {
  let a = [...seed].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
/** A decaying kick: 1 at `at`, falling to ~0 after `len` ms (0 before `at`). */
export const kick = (ms: number, at: number, len = 400) => (ms < at ? 0 : Math.exp(-((ms - at) / len) * 4));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);

const GLYPHS = ['π', '√', '∑', '∞', '△', '＝', '×', '÷', '∠', '∫', '≡', 'x', 'y', '%', '½'];

interface Glyph {
  ch: string;
  x: number;
  y: number;
  z: number;
  spin: number;
  hueSel: boolean;
}

const fieldCache = new Map<string, { glyphs: Glyph[]; dust: { x: number; y: number; r: number; p: number }[] }>();

function field(card: LensCard) {
  const hit = fieldCache.get(card.id);
  if (hit) return hit;
  const rnd = seeded(card.id);
  // The card's own numbers float with the symbols: this problem's mathematics, in the background.
  const nums = [...new Set(card.problem.text_ja.match(/\d+/g) ?? [])].slice(0, 6);
  const pool = [...GLYPHS, ...nums, ...nums];
  const glyphs = Array.from({ length: 34 }, (): Glyph => ({ ch: pool[Math.floor(rnd() * pool.length)]!, x: rnd() * W, y: rnd() * H, z: 0.25 + rnd() * 0.75, spin: (rnd() - 0.5) * 40, hueSel: rnd() < 0.3 }));
  const dust = Array.from({ length: 90 }, () => ({ x: rnd() * W, y: rnd() * H, r: 0.8 + rnd() * 2.2, p: rnd() * 6.28 }));
  const out = { glyphs, dust };
  fieldCache.set(card.id, out);
  return out;
}

/** Quarter arcs of the golden (Fibonacci) spiral, centred on (0, 0), scale `s` per unit. */
function goldenSpiral(s: number): string {
  const fib = [1, 1, 2, 3, 5, 8, 13, 21, 34];
  let x = 0;
  let y = 0;
  let d = 'M 0 0';
  const dirs = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ];
  fib.forEach((f, i) => {
    const [dx, dy] = dirs[i % 4]!;
    const r = f * s;
    const nx = x + dx * r;
    const ny = y + dy * r;
    d += ` A ${r} ${r} 0 0 1 ${nx.toFixed(1)} ${ny.toFixed(1)}`;
    x = nx;
    y = ny;
  });
  return d;
}

/**
 * The living background: a perspective grid that flows towards the viewer (depth), floating symbols and
 * the card's numbers on three parallax planes, a slowly turning golden spiral, star dust, and a breathing
 * glow in the lens colour. `energy` 0–1 sets how bright it is (dim in the trap, bright once the lens opens).
 */
export function MathField({ card, ms, hue, energy, grey = 0 }: { card: LensCard; ms: number; hue: string; energy: number; grey?: number }) {
  const { glyphs, dust } = field(card);
  const s = ms / 1000;
  const vpX = W / 2;
  const vpY = H * 0.46;
  // Floor lines: z cycles from far to near.
  const rows = Array.from({ length: 14 }, (_, i) => {
    const z = ((i / 14 + s * 0.09) % 1) + 0.0001;
    const y = vpY + (H - vpY) * Math.pow(z, 2.2);
    return { y, o: Math.pow(z, 1.5) };
  });
  const cols = Array.from({ length: 17 }, (_, i) => (i - 8) * 260);
  const breathe = 0.5 + 0.5 * Math.sin(s * 1.3);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', filter: grey > 0 ? `saturate(${1 - grey})` : undefined }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id="mf-glow" cx="50%" cy="44%" r="60%">
            <stop offset="0" stopColor={hue} stopOpacity={0.1 + 0.14 * energy * (0.7 + 0.3 * breathe)} />
            <stop offset="1" stopColor={hue} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="mf-vignette" cx="50%" cy="50%" r="75%">
            <stop offset="0.55" stopColor={C.paper.value} stopOpacity={0} />
            <stop offset="1" stopColor={C.paper.value} stopOpacity={0.95} />
          </radialGradient>
          <linearGradient id="mf-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={hue} stopOpacity={0} />
            <stop offset="1" stopColor={hue} stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#mf-glow)" />
        {/* the floor: depth */}
        <g stroke="url(#mf-floor)" strokeWidth={2} opacity={0.35 + 0.35 * energy}>
          {cols.map((dx, i) => (
            <line key={i} x1={vpX} y1={vpY} x2={vpX + dx * 3} y2={H} />
          ))}
          {rows.map((r, i) => (
            <line key={i} x1={0} y1={r.y} x2={W} y2={r.y} strokeOpacity={r.o} />
          ))}
        </g>
        {/* the golden spiral, turning slowly behind the figure */}
        <g transform={`translate(${W / 2} ${H * 0.44}) rotate(${s * 6}) translate(-60 -40)`} opacity={0.1 + 0.16 * energy}>
          <path d={goldenSpiral(15)} fill="none" stroke={hue} strokeWidth={3} />
          <path d={goldenSpiral(15)} fill="none" stroke={hue} strokeWidth={12} opacity={0.25} />
        </g>
        {/* star dust */}
        {dust.map((d, i) => (
          <circle key={i} cx={d.x} cy={(d.y - s * 12 * d.r + H * 4) % H} r={d.r} fill={C.ink.value} opacity={(0.15 + 0.35 * energy) * (0.5 + 0.5 * Math.sin(s * 2.2 + d.p))} />
        ))}
        {/* floating symbols on parallax planes: near ones are larger, faster and brighter */}
        {glyphs.map((g, i) => {
          const y = (((g.y - s * 40 * g.z) % H) + H) % H;
          const x = g.x + Math.sin(s * 0.5 + i) * 18 * g.z;
          return (
            <text
              key={i}
              x={x}
              y={y}
              fontFamily={NUM}
              fontWeight={700}
              fontSize={36 + 110 * g.z * g.z}
              fill={g.hueSel ? hue : C.ink_quiet.value}
              opacity={(0.03 + 0.1 * g.z) * (0.6 + 0.6 * energy)}
              transform={`rotate(${g.spin + s * g.spin * 0.2} ${x} ${y})`}
              textAnchor="middle"
            >
              {g.ch}
            </text>
          );
        })}
        <rect width={W} height={H} fill="url(#mf-vignette)" />
      </svg>
    </div>
  );
}

/** A light burst at (x, y) starting at `at`: flash, two shock rings and rays. */
export function Burst({ ms, at, hue, x, y, size = 1, rays = 14 }: { ms: number; at: number; hue: string; x: number; y: number; size?: number; rays?: number }) {
  const dt = ms - at;
  if (dt < 0 || dt > 1100) return null;
  const p = dt / 1100;
  const r1 = 60 + 620 * size * easeOut(dt / 700);
  const r2 = 40 + 420 * size * easeOut(Math.max(0, dt - 120) / 700);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen' }}>
      <circle cx={x} cy={y} r={r1} fill="none" stroke={hue} strokeWidth={10 * (1 - p)} opacity={1 - p} />
      <circle cx={x} cy={y} r={r2} fill="none" stroke={C.ink.value} strokeWidth={4 * (1 - p)} opacity={0.8 * (1 - p)} />
      <circle cx={x} cy={y} r={120 * size} fill={hue} opacity={0.55 * kick(ms, at, 260)} />
      {Array.from({ length: rays }, (_, i) => {
        const a = (i / rays) * Math.PI * 2 + 0.3;
        const r0 = 80 * size + 300 * size * easeOut(dt / 600);
        const r = r0 + 160 * size * (1 - p);
        return <line key={i} x1={x + Math.cos(a) * r0} y1={y + Math.sin(a) * r0} x2={x + Math.cos(a) * r} y2={y + Math.sin(a) * r} stroke={i % 2 ? hue : C.ink.value} strokeWidth={5 * (1 - p)} strokeLinecap="round" opacity={1 - p} />;
      })}
    </svg>
  );
}

/** Sparks flying out from (x, y) from `at`, falling a little, fading over 1.4 s. */
export function Sparks({ ms, at, hues, x, y, n = 36, seed }: { ms: number; at: number; hues: string[]; x: number; y: number; n?: number; seed: string }) {
  const dt = ms - at;
  if (dt < 0 || dt > 1400) return null;
  const rnd = seeded(seed);
  const t = dt / 1000;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {Array.from({ length: n }, (_, i) => {
        const a = rnd() * Math.PI * 2;
        const v = 500 + rnd() * 900;
        const px = x + Math.cos(a) * v * t * (1 - 0.35 * t);
        const py = y + Math.sin(a) * v * t * (1 - 0.35 * t) + 420 * t * t;
        const r = (3 + rnd() * 7) * (1 - dt / 1400);
        return <circle key={i} cx={px} cy={py} r={r} fill={hues[i % hues.length]} opacity={1 - dt / 1400} />;
      })}
    </svg>
  );
}

/** A colour wash opening as a circle from (x, y): the lens "iris". */
export function Iris({ ms, at, hue, x, y }: { ms: number; at: number; hue: string; x: number; y: number }) {
  const dt = ms - at;
  if (dt < 0 || dt > 1000) return null;
  const r = 2400 * easeOut(dt / 650);
  const o = dt < 250 ? 0.26 : 0.26 * (1 - (dt - 250) / 750);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <circle cx={x} cy={y} r={r} fill={hue} opacity={o} />
      <circle cx={x} cy={y} r={r} fill="none" stroke={C.ink.value} strokeWidth={14} opacity={o * 1.6} />
    </svg>
  );
}

/**
 * Text that writes itself in. One line (`block` false): each character drops in with a short blur and
 * overshoot. Running text (`block` true): characters stay inline so Japanese line breaking (kinsoku) still
 * works, and each one fades in out of a blur while the block rises.
 */
export function KineticText({ text, ms, at, stagger = 30, style, rise = 50, block = false }: { text: string; ms: number; at: number; stagger?: number; style?: CSSProperties; rise?: number; block?: boolean }) {
  const chars = Array.from(text);
  if (block) {
    const all = clamp((ms - at) / (380 + chars.length * stagger));
    return (
      <span style={{ display: 'block', transform: `translateY(${(1 - easeOut(all)) * rise}px)`, lineBreak: 'strict', ...style }}>
        {chars.map((ch, i) => {
          if (ch === '\n') return <br key={i} />;
          const p = clamp((ms - at - i * stagger) / 380);
          return (
            <span key={i} style={{ opacity: p, filter: p < 1 ? `blur(${(1 - p) * 6}px)` : undefined }}>
              {ch}
            </span>
          );
        })}
      </span>
    );
  }
  return (
    <span style={{ display: 'inline', whiteSpace: 'nowrap', ...style }}>
      {chars.map((ch, i) => {
        const p = clamp((ms - at - i * stagger) / 380);
        const over = p < 1 ? 1 + 0.25 * Math.sin(p * Math.PI) : 1;
        return (
          <span key={i} style={{ display: 'inline-block', opacity: p, transform: `translateY(${(1 - easeOut(p)) * rise}px) scale(${over})`, filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined, whiteSpace: 'pre' }}>
            {ch}
          </span>
        );
      })}
    </span>
  );
}

/** A light band sweeping across its parent every `period` ms (for the URL and the answer). */
export function Sheen({ ms, period = 1800 }: { ms: number; period?: number }) {
  const p = (ms % period) / period;
  return (
    <span
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        background: `linear-gradient(105deg, transparent ${p * 140 - 40}%, ${C.ink.value} ${p * 140 - 25}%, transparent ${p * 140 - 10}%)`,
        opacity: 0.35,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      }}
    />
  );
}

/** Camera: a punch-in on every beat change plus a slow push while a beat lasts. */
export function Camera({ children, punch, push, shake = 0, ms }: { children: ReactNode; punch: number; push: number; shake?: number; ms: number }) {
  const sx = shake * Math.sin(ms * 0.09) * 14;
  const sy = shake * Math.cos(ms * 0.11) * 10;
  return <div style={{ position: 'absolute', inset: 0, transform: `translate(${sx}px, ${sy}px) scale(${1 + 0.045 * punch + 0.03 * push})`, transformOrigin: '50% 42%' }}>{children}</div>;
}

export { JA as FX_JA, NUM as FX_NUM };
