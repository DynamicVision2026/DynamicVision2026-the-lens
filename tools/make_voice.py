#!/usr/bin/env python3
"""Generate the mascot voice clips for every masterclass `say` line (WO-022 §2). Run it on a Mac or PC.

One-time setup:
  1. Install the VOICEVOX app (https://voicevox.hiroshiba.jp/) and open it. While the app is open, it serves
     its engine at http://127.0.0.1:50021 (this script talks to that).
  2. pip3 install pyyaml          (the validator needs it too)

Then, from the repo root:
  python3 tools/make_voice.py            # only lines that are new or changed
  python3 tools/make_voice.py --all      # regenerate everything
  python3 tools/make_voice.py --lens freeze --key example1   # one clip, for listening
  python3 tools/make_voice.py --lens koukou_juken/freeze      # one lesson of another Pass

Writes apps/trainer/public/audio/mc/<lens>/<key>.m4a (chugaku_juken) or mc/<pass>/<lens>/<key>.m4a (other Passes) and apps/trainer/public/audio/mc/manifest.json.
WO-028: also the YouTube Shorts lines (apps/shorts/voice/lines.json, kept up to date by `pnpm --filter @lens/shorts voice:lines`)
into apps/shorts/public/voice/<cardId>/<key>.m4a and apps/shorts/public/voice/manifest.json (with each clip's length in ms).
  python3 tools/make_voice.py --shorts      # only the Shorts lines
The manifest records the exact text of each clip: the validator only ships a clip whose text still matches
the masterclass line (an edited line is reported as stale until you run this again), then
`pnpm bundle` adds masterclass.audio for the trainer.

Voice (Brian, Oct 14 10:17): VOICEVOX 春日部つむぎ, energetic pace (sample A). Credit 「VOICEVOX:春日部つむぎ」 in the app.
Only the Python standard library and PyYAML are used. AAC conversion uses ffmpeg if installed, otherwise the
afconvert tool built into macOS; if neither exists the clip is kept as .wav.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENGINE = "http://127.0.0.1:50021"
CHARACTER, STYLE = "春日部つむぎ", "ノーマル"
# Sample A (genki): a little faster and brighter than the default. VOICEVOX ranges: speed 0.5–2.0, pitch ±0.15.
TUNING = {"speedScale": 1.12, "pitchScale": 0.03, "intonationScale": 1.25, "volumeScale": 1.0,
          "prePhonemeLength": 0.05, "postPhonemeLength": 0.15}
CATALOGS = ["chugaku_juken", "koukou_juken", "daigaku_juken"]   # passes; those without a masterclass.yaml are skipped
OUT = ROOT / "apps" / "trainer" / "public" / "audio" / "mc"
MANIFEST = OUT / "manifest.json"
SHORTS_LINES = ROOT / "apps" / "shorts" / "voice" / "lines.json"
SHORTS_OUT = ROOT / "apps" / "shorts" / "public" / "voice"
SHORTS_MANIFEST = SHORTS_OUT / "manifest.json"


def http(method: str, path: str, body: bytes | None = None, ctype: str = "application/json") -> bytes:
    req = urllib.request.Request(ENGINE + path, data=body, method=method, headers={"Content-Type": ctype})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def speaker_id() -> int:
    try:
        speakers = json.loads(http("GET", "/speakers"))
    except OSError:
        sys.exit("VOICEVOX is not running. Open the VOICEVOX app, wait until it has loaded, then run this again.")
    for sp in speakers:
        if sp["name"] == CHARACTER:
            for st in sp["styles"]:
                if st["name"] == STYLE:
                    return st["id"]
    sys.exit(f"{CHARACTER}（{STYLE}） is not in this VOICEVOX. Update the app, or check the character list.")


def synth(text: str, sid: int) -> bytes:
    q = json.loads(http("POST", f"/audio_query?{urllib.parse.urlencode({'text': text, 'speaker': sid})}"))
    q.update(TUNING)
    return http("POST", f"/synthesis?speaker={sid}", json.dumps(q).encode("utf-8"))


def to_m4a(wav: bytes, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "clip.wav"
        src.write_bytes(wav)
        m4a = dest.with_suffix(".m4a")
        if shutil.which("ffmpeg"):
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-af", "loudnorm=I=-16:TP=-1.5",
                            "-c:a", "aac", "-b:a", "96k", str(m4a)], check=True)
            return m4a
        if shutil.which("afconvert"):
            subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "96000", str(src), str(m4a)], check=True)
            return m4a
    wavdest = dest.with_suffix(".wav")
    wavdest.write_bytes(wav)
    return wavdest


def lines():
    try:
        import yaml
    except ImportError:
        sys.exit("PyYAML is missing: run  pip3 install pyyaml  and try again.")
    for pid in CATALOGS:
        f = ROOT / "catalog" / pid / "masterclass.yaml"
        if not f.exists():
            continue
        mc = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
        for lens, m in mc.items():
            folder = lens if pid == "chugaku_juken" else f"{pid}/{lens}"   # same rule as validate.voice_dir
            for key, text in (m.get("say") or {}).items():
                yield folder, key, text


def wav_ms(wav: bytes) -> int:
    with wave.open(io.BytesIO(wav)) as w:
        return round(w.getnframes() * 1000 / w.getframerate())


def voice_meta() -> dict:
    return {"engine": "VOICEVOX", "character": CHARACTER, "style": STYLE, "tuning": TUNING, "credit": f"VOICEVOX:{CHARACTER}"}


def make_shorts(sid: int, regenerate: bool) -> None:
    """WO-028: one clip per Short line; the Short plays a clip only while its text still matches the line."""
    if not SHORTS_LINES.exists():
        return
    lines = json.loads(SHORTS_LINES.read_text(encoding="utf-8"))
    manifest = json.loads(SHORTS_MANIFEST.read_text(encoding="utf-8")) if SHORTS_MANIFEST.exists() else {}
    made = total = 0
    for card, keys in lines.items():
        for key, text in keys.items():
            total += 1
            old = manifest.get(card, {}).get(key)
            if old and old["text"] == text and (SHORTS_OUT / card / old["file"]).exists() and not regenerate:
                continue
            wav = synth(text, sid)
            f = to_m4a(wav, SHORTS_OUT / card / key)
            manifest.setdefault(card, {})[key] = {"text": text, "file": f.name, "ms": wav_ms(wav),
                                                  "sha1": hashlib.sha1(f.read_bytes()).hexdigest()[:12]}
            made += 1
            print(f"  shorts/{card}/{f.name}  {text}")
    # Drop clips of lines that no longer exist (the files stay until someone deletes them).
    for card in list(manifest):
        if card == "_voice":
            continue
        if card not in lines:
            del manifest[card]
            continue
        for key in list(manifest[card]):
            if key not in lines[card]:
                del manifest[card][key]
    manifest["_voice"] = voice_meta()
    SHORTS_OUT.mkdir(parents=True, exist_ok=True)
    SHORTS_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Shorts: {made} clip(s) written, {total - made} unchanged.")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--all", action="store_true", help="regenerate every clip")
    ap.add_argument("--lens")
    ap.add_argument("--key")
    ap.add_argument("--shorts", action="store_true", help="only the YouTube Shorts lines (WO-028)")
    a = ap.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    sid = speaker_id()
    if a.shorts:
        make_shorts(sid, a.all)
        return
    todo = [(l, k, t) for l, k, t in lines() if (not a.lens or l == a.lens) and (not a.key or k == a.key)]
    made = 0
    for lens, key, text in todo:
        old = manifest.get(lens, {}).get(key)
        if old and old["text"] == text and (OUT / lens / old["file"]).exists() and not (a.all or a.key):
            continue
        f = to_m4a(synth(text, sid), OUT / lens / key)
        manifest.setdefault(lens, {})[key] = {"text": text, "file": f.name,
                                               "sha1": hashlib.sha1(f.read_bytes()).hexdigest()[:12]}
        made += 1
        print(f"  {lens}/{f.name}  {text}")
    manifest["_voice"] = voice_meta()
    OUT.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{made} clip(s) written, {len(todo) - made} unchanged. Next: pnpm bundle, then commit apps/trainer/public/audio/mc.")
    if not (a.lens or a.key):
        make_shorts(sid, a.all)


if __name__ == "__main__":
    main()
