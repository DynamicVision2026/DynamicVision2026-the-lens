#!/usr/bin/env python3
"""Original music and sound effects for the 視点レンズ YouTube Shorts (WO-028). No third-party audio:
everything here is synthesised from sine, saw and noise by this script, so the files are ours.

    python3 tools/make_short_music.py      # writes apps/shorts/public/music/*.m4a (needs numpy + ffmpeg)

Two stems on the same 100 BPM grid (A minor, i–VI–III–VII), each 57.6 s (24 bars) and loopable:
  bed.m4a    deep sub, warm pad, slow shimmer: "the depth of mathematics"
  drive.m4a  kick, hats, bright arpeggio: "the brightness"; the Short brings it in when the lens opens
Effects: whoosh (beat change), impact (lens / answer), tick (countdown), rise (before the pick),
shimmer (answer), glitch (the trap's habit).
"""
from __future__ import annotations

import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "apps" / "shorts" / "public" / "music"
SR = 44100
BPM = 100
BEAT = 60 / BPM
BARS = 24
LEN = BARS * 4 * BEAT
rng = np.random.default_rng(28)

# A minor: Am – F – C – G (one chord per bar)
CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]


def hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def t_of(seconds: float) -> np.ndarray:
    return np.arange(int(seconds * SR)) / SR


def env(n: int, a: float, d: float) -> np.ndarray:
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


def lowpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    k = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - k) * v + k * acc
        y[i] = acc
    return y


def saw(f: float, t: np.ndarray, detune: float = 0.0) -> np.ndarray:
    ph = (f * (1 + detune) * t) % 1
    return 2 * ph - 1


def add(buf: np.ndarray, at: float, x: np.ndarray, gain: float = 1.0) -> None:
    i = int(at * SR) % len(buf)
    n = min(len(x), len(buf) - i)
    buf[i : i + n] += gain * x[:n]
    if n < len(x):  # wrap so the stem loops cleanly
        buf[: len(x) - n] += gain * x[n:]


def bed() -> np.ndarray:
    n = int(LEN * SR)
    out = np.zeros(n)
    bar = 4 * BEAT
    for b in range(BARS):
        chord = CHORDS[b % 4]
        t = t_of(bar + 0.6)
        pad = sum(saw(hz(m), t, d) for m in chord for d in (-0.004, 0.004)) / 6
        pad = lowpass(pad, 900) * env(len(t), 0.5, 3.5)
        add(out, b * bar, pad, 0.22)
        sub = np.sin(2 * np.pi * hz(chord[0] - 24) * t) * env(len(t), 0.05, 2.5)
        add(out, b * bar, sub, 0.32)
    # slow shimmer: a high fifth that swells over 8 bars
    t = t_of(LEN)
    shimmer = (np.sin(2 * np.pi * hz(76) * t) + 0.6 * np.sin(2 * np.pi * hz(83) * t)) * (0.5 - 0.5 * np.cos(2 * np.pi * t / (8 * bar)))
    out += 0.025 * shimmer
    return out


def drive() -> np.ndarray:
    n = int(LEN * SR)
    out = np.zeros(n)
    kick_t = t_of(0.45)
    kick = np.sin(2 * np.pi * (45 + 90 * np.exp(-kick_t * 30)) * kick_t) * env(len(kick_t), 0.002, 0.16)
    hat = lowpass(rng.standard_normal(int(0.06 * SR)), 9000)
    hat = (rng.standard_normal(len(hat)) - hat) * env(len(hat), 0.001, 0.018)
    for beat in range(BARS * 4):
        add(out, beat * BEAT, kick, 0.55)
        add(out, beat * BEAT + BEAT / 2, hat, 0.12)
        add(out, beat * BEAT, hat, 0.05)
    # bright arpeggio in 16ths: chord tones up two octaves
    step = BEAT / 4
    pl = t_of(0.35)
    for i in range(BARS * 16):
        chord = CHORDS[(i // 16) % 4]
        m = chord[[0, 1, 2, 1][i % 4]] + 12 + (12 if (i // 4) % 2 else 0)
        note = (np.sin(2 * np.pi * hz(m) * pl) + 0.3 * np.sin(2 * np.pi * 2 * hz(m) * pl)) * env(len(pl), 0.003, 0.09)
        add(out, i * step, note, 0.085)
    return out


def sfx() -> dict[str, np.ndarray]:
    fx: dict[str, np.ndarray] = {}
    t = t_of(0.7)
    noise = rng.standard_normal(len(t))
    sweep = np.concatenate([lowpass(noise[i : i + 2205], 300 + 9000 * (i / len(t))) for i in range(0, len(t), 2205)])[: len(t)]
    fx["whoosh"] = sweep * np.sin(np.pi * t / t[-1]) ** 2 * 0.9
    t = t_of(1.4)
    boom = np.sin(2 * np.pi * (38 + 70 * np.exp(-t * 12)) * t) * env(len(t), 0.002, 0.45)
    click = lowpass(rng.standard_normal(len(t)), 5000) * env(len(t), 0.001, 0.02)
    fx["impact"] = 0.9 * boom + 0.5 * click
    t = t_of(0.18)
    fx["tick"] = (np.sin(2 * np.pi * 1760 * t) + 0.5 * np.sin(2 * np.pi * 880 * t)) * env(len(t), 0.001, 0.04) * 0.6
    t = t_of(1.0)
    fx["rise"] = saw(1, t) * 0 + lowpass(rng.standard_normal(len(t)), 4000) * (t / t[-1]) ** 2 * 0.5 + np.sin(2 * np.pi * (300 + 900 * t ** 2) * t) * (t / t[-1]) * 0.15
    t = t_of(1.6)
    sh = np.zeros(len(t))
    for k, m in enumerate([69, 72, 76, 81, 84, 88]):
        st = int(k * 0.07 * SR)
        tt = t[: len(t) - st]
        sh[st:] += np.sin(2 * np.pi * hz(m) * tt) * env(len(tt), 0.003, 0.5)
    fx["shimmer"] = sh * 0.25
    t = t_of(0.45)
    sq = np.sign(np.sin(2 * np.pi * 110 * t)) * (rng.random(len(t)) > 0.3)
    fx["glitch"] = lowpass(sq, 2500) * env(len(t), 0.002, 0.15) * 0.5
    return fx


def write(name: str, x: np.ndarray) -> None:
    x = x / max(1e-9, np.max(np.abs(x))) * 0.89
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "x.wav"
        with wave.open(str(wav), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((x * 32767).astype("<i2").tobytes())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "aac", "-b:a", "128k", str(OUT / f"{name}.m4a")], check=True)
    print(f"  music/{name}.m4a  {len(x) / SR:.1f} s")


def main() -> None:
    write("bed", bed())
    write("drive", drive())
    for name, x in sfx().items():
        write(name, x)


if __name__ == "__main__":
    main()
