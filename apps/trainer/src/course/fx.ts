// Feel (WO-012 §3): springs with overshoot, chimes, haptics where they exist, and the aha burst.
// STUB(architect #46): spring/timing values below stand in for tokens.motion.tactile.

export const TACTILE = {
  snap: { k: 420, c: 16 },
  open: { k: 300, c: 14 },
  settle: { k: 260, c: 18 },
  idleMs: 5000,
  stepStaggerMs: 380,
  fingerMs: 1500,
} as const;

/** Respect prefers-reduced-motion: springs jump, no bob/pop, no confetti. */
export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---------- springs ----------
type Spring = { x: number; v: number; target: number; k: number; c: number; set: (x: number) => void; done?: () => void };
const springs = new Map<string, Spring>();
const hooks = new Set<(dt: number) => void>();
let ticking = false;
let last = 0;

function frame(t: number) {
  const dt = Math.min(0.032, (t - last) / 1000);
  last = t;
  for (const [key, s] of springs) {
    const a = s.k * (s.target - s.x) - s.c * s.v;
    s.v += a * dt;
    s.x += s.v * dt;
    s.set(s.x);
    if (Math.abs(s.target - s.x) < 1e-3 && Math.abs(s.v) < 1e-3) {
      s.set(s.target);
      springs.delete(key);
      s.done?.();
    }
  }
  for (const h of hooks) h(dt);
  if (springs.size || hooks.size) requestAnimationFrame(frame);
  else ticking = false;
}

function kick() {
  if (ticking) return;
  ticking = true;
  last = performance.now();
  requestAnimationFrame(frame);
}

/** Spring `key` from `from` to `target`, calling `set` every frame (one spring per key). */
export function springTo(key: string, from: number, target: number, set: (x: number) => void, opts: { k: number; c: number; done?: () => void }) {
  if (reducedMotion()) {
    set(target);
    opts.done?.();
    return;
  }
  springs.set(key, { x: from, v: 0, target, k: opts.k, c: opts.c, set, done: opts.done });
  kick();
}

export function stopSprings(prefix = '') {
  for (const key of [...springs.keys()]) if (key.startsWith(prefix)) springs.delete(key);
}

/** Run `fn(dt)` every frame until the returned stop function is called. */
export function everyFrame(fn: (dt: number) => void): () => void {
  hooks.add(fn);
  kick();
  return () => hooks.delete(fn);
}

// ---------- sound + haptics ----------
let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!ctx && AC) ctx = new AC();
    if (ctx?.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
  return ctx;
}

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'sine', vol = 0.12) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + at);
  g.gain.linearRampToValueAtTime(vol, a.currentTime + at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + at);
  o.stop(a.currentTime + at + dur + 0.05);
}

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // No haptics here (iOS web): the motion carries the feel.
  }
}

export const sfx = {
  tap() {
    tone(880, 0, 0.05, 'triangle', 0.05);
    buzz(5);
  },
  snap() {
    tone(1320, 0, 0.07, 'triangle', 0.09);
    tone(1760, 0.04, 0.08, 'sine', 0.06);
    buzz(12);
  },
  soft() {
    tone(330, 0, 0.16, 'sine', 0.07);
  },
  tick(pitch: number) {
    tone(400 + pitch * 300, 0, 0.03, 'triangle', 0.03);
  },
  aha() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.085, 0.5, 'sine', 0.11));
    tone(2093, 0.34, 0.6, 'triangle', 0.04);
    buzz([15, 40, 25]);
  },
};

// ---------- aha burst ----------
/** Confetti over `host` in the given colours; cleans itself up. */
export function burst(host: HTMLElement, colours: string[]) {
  if (reducedMotion()) return;
  const cv = document.createElement('canvas');
  cv.className = 'fx';
  host.appendChild(cv);
  const r = host.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = r.width * dpr;
  cv.height = r.height * dpr;
  const g = cv.getContext('2d');
  if (!g) return cv.remove();
  g.scale(dpr, dpr);
  const ps = Array.from({ length: 90 }, (_, i) => {
    const a = Math.random() * Math.PI * 2;
    const sp = 3 + Math.random() * 7;
    return { x: r.width / 2, y: r.height * 0.45, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, s: 3 + Math.random() * 5, c: colours[i % colours.length]!, life: 1 };
  });
  const stop = everyFrame(() => {
    g.clearRect(0, 0, r.width, r.height);
    let alive = 0;
    for (const p of ps) {
      if (p.life <= 0) continue;
      alive++;
      p.vy += 0.25;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.016;
      g.globalAlpha = Math.max(0, p.life);
      g.fillStyle = p.c;
      g.fillRect(p.x, p.y, p.s, p.s * 0.6);
    }
    if (!alive) {
      stop();
      cv.remove();
    }
  });
}

// Unlock audio on the first touch (iOS needs a user gesture).
if (typeof document !== 'undefined') document.addEventListener('pointerdown', () => audio(), { once: true, capture: true });
