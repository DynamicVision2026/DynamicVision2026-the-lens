#!/usr/bin/env python3
"""Original music + sound effects for the つまずきマップ guide video (no samples, no licences: everything is
synthesised here with numpy/scipy).

  python3 music.py <out-dir> <length-seconds> <sections.json>

sections.json: [[start_seconds, energy], ...] — energy 0 (pad only) … 3 (full groove). Section starts are
snapped to the bar. Writes <out-dir>/music.wav (stereo 44.1 kHz) and <out-dir>/sfx/*.wav.
Style: uplifting tech-pop, 100 BPM, vi–IV–I–V in C (Am9 – Fmaj9 – C(add9) – G6).
"""
import json
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

SR = 44100
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def lowpass(x, fc, order=2):
    sos = butter(order, min(fc, SR * 0.45), "low", fs=SR, output="sos")
    return sosfilt(sos, x, axis=0)


def highpass(x, fc, order=2):
    sos = butter(order, fc, "high", fs=SR, output="sos")
    return sosfilt(sos, x, axis=0)


def bandpass(x, lo, hi, order=2):
    sos = butter(order, [lo, hi], "band", fs=SR, output="sos")
    return sosfilt(sos, x, axis=0)


def saw(f, t, harmonics=14):
    out = np.zeros_like(t)
    for k in range(1, harmonics + 1):
        if f * k > SR * 0.45:
            break
        out += np.sin(2 * np.pi * f * k * t) / k
    return out * 0.6


def env_adsr(n, a, d, s, r, total):
    """Linear ADSR over `total` seconds (n samples); release after total - r."""
    t = np.arange(n) / SR
    e = np.ones(n) * s
    e[t < a] = t[t < a] / max(a, 1e-4)
    m = (t >= a) & (t < a + d)
    e[m] = 1 - (1 - s) * (t[m] - a) / max(d, 1e-4)
    rel = t >= total - r
    e[rel] *= np.clip((total - t[rel]) / max(r, 1e-4), 0, 1)
    return e


def smooth(sig, ms=3):
    """Short fades at both ends so no one-shot starts or stops with a click."""
    k = min(int(SR * ms / 1000), len(sig) // 2)
    if k < 2:
        return sig
    ramp = np.linspace(0, 1, k)
    sig = sig.copy()
    if sig.ndim == 1:
        sig[:k] *= ramp
        sig[-k:] *= ramp[::-1]
    else:
        sig[:k] *= ramp[:, None]
        sig[-k:] *= ramp[::-1][:, None]
    return sig


HAT_NOISE = None


def add(buf, sig, at):
    sig = smooth(sig)
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]


def reverb_ir(sec=2.4, decay=3.2):
    t = t_axis(sec)
    ir = rng.standard_normal((len(t), 2)) * np.exp(-decay * t)[:, None]
    ir = lowpass(ir, 6000)
    ir[0] = 0
    return ir / np.sqrt((ir**2).sum(axis=0))


CHORDS = [  # pad voicing, bass root, arpeggio tones
    ([57, 60, 64, 67, 71], 45, [69, 72, 76, 79, 71, 76]),  # Am9
    ([53, 57, 60, 64, 67], 41, [65, 69, 72, 76, 67, 72]),  # Fmaj9
    ([48, 55, 60, 62, 64], 36, [67, 72, 74, 76, 79, 74]),  # C(add9)
    ([55, 59, 62, 64, 67], 43, [67, 71, 74, 76, 79, 74]),  # G6
]


def build(length, sections):
    bars = int(np.ceil(length / BAR)) + 1
    energy = np.zeros(bars, dtype=int)
    for start, e in sections:
        b = int(round(start / BAR))
        energy[b:] = e
    n = int(bars * BAR * SR)
    pad = np.zeros((n, 2))
    pluck = np.zeros((n, 2))
    bass = np.zeros(n)
    drums = np.zeros((n, 2))
    side = np.ones(n)

    t_bar = t_axis(BAR + 1.2)
    for b in range(bars):
        notes, root, arp = CHORDS[b % 4]
        e = energy[b]
        at = b * BAR
        # pad: detuned saws, filter opens with energy
        p = np.zeros((len(t_bar), 2))
        for k, m in enumerate(notes):
            f = midi(m)
            for ch, cents in ((0, -7), (1, 7)):
                p[:, ch] += saw(f * 2 ** (cents / 1200), t_bar + rng.random())
        p *= env_adsr(len(t_bar), 0.5, 0.4, 0.85, 1.1, BAR + 1.2)[:, None]
        p = lowpass(p, [700, 1300, 2000, 2600][e]) * 0.05
        add(pad, p, at)
        # pluck arpeggio (16ths) from energy 1
        if e >= 1:
            step = BEAT / 4
            tt = t_axis(0.5)
            for i in range(16):
                m = arp[i % len(arp)] + (12 if (i % 8 == 7 and e >= 2) else 0)
                f = midi(m)
                s = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt * 11)
                vel = 0.10 if i % 4 == 0 else 0.065
                pan = 0.5 + 0.35 * np.sin(i * 0.9)
                add(pluck, np.stack([s * vel * (1 - pan), s * vel * pan], axis=1), at + i * step)
        # bass from energy 2: 8th pulses on the root
        if e >= 2:
            tt = t_axis(BEAT / 2)
            f = midi(root)
            for i in range(8):
                s = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(4 * np.pi * f * tt)) * env_adsr(len(tt), 0.005, 0.1, 0.7, 0.05, BEAT / 2)
                add(bass, s * (0.22 if i % 2 == 0 else 0.15), at + i * BEAT / 2)
        # drums
        if e >= 2:
            tt = t_axis(0.05)
            for i in range(8):  # hats on 8ths
                src = highpass(rng.standard_normal(len(tt) + 4000), 7000)[4000:]
                h = src * np.exp(-tt * 90) * (0.05 if i % 2 else 0.03)
                add(drums, np.stack([h * 0.8, h], axis=1), at + i * BEAT / 2 + (0.012 if i % 2 else 0))
        if e >= 3:
            tk = t_axis(0.35)
            freq = 45 + 75 * np.exp(-tk * 28)
            kick = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-tk * 9) * 0.55
            for i in range(4):
                add(drums, np.stack([kick, kick], axis=1), at + i * BEAT)
                dip = 1 - 0.55 * np.exp(-t_axis(BEAT) * 9)
                k0 = int((at + i * BEAT) * SR)
                side[k0 : k0 + len(dip)] = np.minimum(side[k0 : k0 + len(dip)], dip[: max(0, min(len(dip), n - k0))])
            tc = t_axis(0.25)
            for i in (1, 3):  # clap on 2 and 4
                c = np.zeros(len(tc))
                for off in (0, 0.012, 0.024):
                    k = int(off * SR)
                    c[k:] += rng.standard_normal(len(tc) - k) * np.exp(-(tc[: len(tc) - k]) * 30)
                c = bandpass(c, 900, 4500) * 0.16
                add(drums, np.stack([c, c * 0.9], axis=1), at + i * BEAT)
        # a soft crash where the energy rises
        if b > 0 and energy[b] > energy[b - 1]:
            tc = t_axis(2.5)
            cr = highpass(rng.standard_normal((len(tc), 2)), 5000) * np.exp(-tc * 1.6)[:, None] * 0.05
            add(drums, cr, at)

    # delay on the plucks (dotted 8th, ping-pong)
    d = int(BEAT * 0.75 * SR)
    for rep, g in ((1, 0.35), (2, 0.18), (3, 0.09)):
        sh = np.zeros_like(pluck)
        sh[d * rep :] = pluck[: -d * rep][:, ::-1] if rep % 2 else pluck[: -d * rep]
        pluck += sh * g
    pluck = lowpass(pluck, 5200)
    ir = reverb_ir()
    wet = np.stack([fftconvolve(pad[:, c] + pluck[:, c] * 0.8, ir[:, c])[:n] for c in range(2)], axis=1)
    mix = (pad + pluck + wet * 0.35) * side[:, None] + np.stack([bass * side, bass * side], axis=1) + drums
    mix = highpass(mix, 30)
    mix = np.tanh(mix * 1.6) / np.tanh(1.6)
    L = int(length * SR)
    mix = mix[:L]
    fade = int(4 * SR)
    mix[:int(1.5 * SR)] *= np.linspace(0, 1, int(1.5 * SR))[:, None]
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return mix / np.max(np.abs(mix)) * 0.89


def sfx(out):
    out.mkdir(parents=True, exist_ok=True)

    def save(name, x):
        x = np.atleast_2d(x.T).T if x.ndim == 1 else x
        if x.ndim == 1 or x.shape[1] == 1:
            x = np.stack([x.ravel(), x.ravel()], axis=1)
        x = x / (np.max(np.abs(x)) + 1e-9) * 0.9
        wavfile.write(out / f"{name}.wav", SR, (x * 32767).astype(np.int16))

    t = t_axis(0.9)  # whoosh: noise through a sweeping band, rising then falling
    noise = rng.standard_normal((len(t), 2))
    sweep = np.zeros_like(noise)
    seg = 64
    for i in range(0, len(t), len(t) // seg):
        k = i / len(t)
        fc = 300 + 5000 * np.sin(np.pi * k) ** 2
        sweep[i : i + len(t) // seg] = bandpass(noise[i : i + len(t) // seg + 2000], fc * 0.6, min(fc * 1.6, 18000))[: len(sweep[i : i + len(t) // seg])]
    save("whoosh", sweep * np.sin(np.pi * t / t[-1])[:, None] ** 2)
    t = t_axis(0.18)
    f = 520 + 900 * (t / t[-1])
    save("pop", np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 22))
    t = t_axis(0.06)
    save("tap", (np.sin(2 * np.pi * 1800 * t) * 0.6 + highpass(rng.standard_normal(len(t)), 3000) * 0.4) * np.exp(-t * 80))
    t = t_axis(1.4)
    ch = sum(np.sin(2 * np.pi * midi(m) * t) * np.exp(-t * 3.5) * (t >= d) for m, d in ((84, 0), (88, 0.09), (91, 0.18)))
    save("chime", ch)
    t = t_axis(0.25)
    sh = highpass(rng.standard_normal(len(t)), 1500) * (np.exp(-t * 60) + 0.7 * np.exp(-np.clip(t - 0.08, 0, None) * 50) * (t > 0.08))
    save("shutter", sh)
    t = t_axis(2.2)
    r = highpass(rng.standard_normal((len(t), 2)), 1200) * (t / t[-1])[:, None] ** 2 + np.sin(2 * np.pi * np.cumsum(200 + 900 * (t / t[-1]) ** 2) / SR)[:, None] * 0.25 * (t / t[-1])[:, None]
    r = r * np.clip((t[-1] - t) / 0.18, 0, 1)[:, None]  # no hard stop
    save("riser", r * 0.6)
    t = t_axis(2.0)
    boom = np.sin(2 * np.pi * np.cumsum(40 + 80 * np.exp(-t * 10)) / SR) * np.exp(-t * 2.2)
    shim = highpass(rng.standard_normal(len(t)), 4000) * np.exp(-t * 3) * 0.25
    save("hit", np.stack([boom + shim, boom + shim * 0.8], axis=1))
    t = t_axis(0.12)
    save("tick", np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 70) * 0.7)


if __name__ == "__main__":
    out = Path(sys.argv[1])
    length = float(sys.argv[2])
    sections = json.loads(Path(sys.argv[3]).read_text())
    out.mkdir(parents=True, exist_ok=True)
    m = build(length, sections)
    wavfile.write(out / "music.wav", SR, (m * 32767).astype(np.int16))
    sfx(out / "sfx")
    print("music", round(len(m) / SR, 1), "s; bar", round(BAR, 2), "s")
