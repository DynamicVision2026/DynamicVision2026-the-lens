#!/usr/bin/env python3
"""Extra sound effects for the story film (synthesised, no samples): pencil scratching, a page flip,
a fast flip-through, a mug set down, a soft sigh-like air swell.  python3 story_sfx.py <sfx-dir>"""
import sys
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
rng = np.random.default_rng(3)
out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)


def band(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x)


def save(name, x, gain=0.8):
    x = x / (np.max(np.abs(x)) + 1e-9) * gain
    st = np.stack([x, x], 1)
    wavfile.write(out / f"{name}.wav", SR, (st * 32767).astype(np.int16))


def env(n, a, r):
    e = np.ones(n); a = int(a * SR); r = int(r * SR)
    e[:a] = np.linspace(0, 1, a); e[-r:] = np.linspace(1, 0, r)
    return e


# pencil: 2.4 s of short strokes (grainy band noise, stroke envelope ~ 6 Hz with jitter)
n = int(2.4 * SR)
noise = band(rng.standard_normal(n), 2500, 9000)
t = np.arange(n) / SR
strokes = np.zeros(n)
pos = 0.0
while pos < 2.4:
    d = rng.uniform(0.08, 0.22)
    i0, i1 = int(pos * SR), min(n, int((pos + d) * SR))
    strokes[i0:i1] = np.sin(np.linspace(0, np.pi, i1 - i0)) * rng.uniform(0.5, 1.0)
    pos += d + rng.uniform(0.02, 0.09)
grain = 1 + 0.6 * band(rng.standard_normal(n), 30, 120) / 0.05
save("pencil", noise * strokes * np.clip(grain, 0.2, 2.5) * env(n, 0.05, 0.2), 0.55)

# page flip: rising then falling swish
n = int(0.45 * SR)
x = band(rng.standard_normal(n), 800, 6000)
e = np.concatenate([np.linspace(0, 1, int(n * 0.35)) ** 2, np.linspace(1, 0, n - int(n * 0.35)) ** 1.5])
save("flip", x * e, 0.6)

# flip-through: 14 quick flips
n = int(1.8 * SR)
x = np.zeros(n)
for k in range(14):
    i0 = int(k * 0.12 * SR); m = int(0.16 * SR)
    seg = band(rng.standard_normal(m), 1200, 7000) * np.sin(np.linspace(0, np.pi, m)) ** 2
    x[i0:i0 + m] += seg[: max(0, min(m, n - i0))] * rng.uniform(0.6, 1)
save("flipthrough", x * env(n, 0.02, 0.3), 0.6)

# mug down: low thud + a small ceramic ring
n = int(0.7 * SR); t = np.arange(n) / SR
thud = np.sin(2 * np.pi * 140 * t) * np.exp(-t * 30) + 0.4 * band(rng.standard_normal(n), 100, 600) * np.exp(-t * 40)
ring = 0.25 * (np.sin(2 * np.pi * 2100 * t) + 0.6 * np.sin(2 * np.pi * 3350 * t)) * np.exp(-t * 9)
save("mug", thud + ring, 0.6)

# air: soft swell for the turn ("もし…")
n = int(2.2 * SR)
x = band(rng.standard_normal(n), 300, 3000)
e = np.sin(np.linspace(0, np.pi, n)) ** 2
save("air", x * e, 0.35)
print("ok")
