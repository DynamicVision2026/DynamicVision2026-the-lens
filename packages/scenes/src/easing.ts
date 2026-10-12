// Evaluates the `motion.easing` token (a CSS cubic-bezier) as a pure function of t.

export type Easing = (t: number) => number;

export const clamp01 = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : Number.isFinite(t) ? t : 0);

export function parseEasing(css: string): Easing {
  const m = /cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(css);
  if (!m) return clamp01;
  const [x1, y1, x2, y2] = m.slice(1).map(Number) as [number, number, number, number];
  const bez = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  return (input: number) => {
    const x = clamp01(input);
    if (x === 0 || x === 1) return x;
    // Bisection on the x curve: fixed iteration count keeps it deterministic.
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (bez(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return bez(y1, y2, (lo + hi) / 2);
  };
}

/** Progress of item `i` of `n` when n items play one after another across t. */
export function stagger(t: number, i: number, n: number): number {
  return n <= 0 ? 0 : clamp01(t * n - i);
}
