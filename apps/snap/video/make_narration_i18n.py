#!/usr/bin/env python3
"""English and 繁體中文 narration for the つまずきマップ marketing videos (guide, guide short, Short A), from
video/narration.<lang>.json, spoken by Google Cloud Text-to-Speech. The Japanese narration stays VOICEVOX
(make_narration.py). Run by .github/workflows/guide-voice-i18n.yml (Google sign-in through the repo's workload
identity, main only); locally it needs `gcloud auth print-access-token`. Standard library only.

  python3 video/make_narration_i18n.py [en zh-Hant]

Writes video/audio-i18n/<lang>/<id>.wav (24 kHz mono) and video/audio-i18n/<lang>/durations.json ({id: seconds}).
Google's terms allow commercial use of the audio; no credit line is needed.
"""
import base64
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = os.environ.get("TTS_PROJECT", "shiten-lens-511712")
# narrator voices: calm adult female (the Japanese guide uses the announcer voice No.7); first that works wins
VOICES = {
    "en": ("en-US", ["en-US-Neural2-F", "en-US-Wavenet-F"]),
    "zh-Hant": ("cmn-TW", ["cmn-TW-Wavenet-A"]),
}
AUDIO = {"audioEncoding": "LINEAR16", "sampleRateHertz": 24000, "speakingRate": 1.04, "pitch": 0.0}


def token() -> str:
    t = os.environ.get("GOOGLE_TOKEN") or subprocess.run(["gcloud", "auth", "print-access-token"], capture_output=True, text=True).stdout.strip()
    if not t:
        sys.exit("no Google access token (gcloud auth print-access-token)")
    return t


def synth(text: str, code: str, name: str, tok: str) -> bytes:
    body = json.dumps({"input": {"text": text}, "voice": {"languageCode": code, "name": name}, "audioConfig": AUDIO}).encode()
    req = urllib.request.Request("https://texttospeech.googleapis.com/v1/text:synthesize", data=body, method="POST",
                                 headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json", "x-goog-user-project": PROJECT})
    with urllib.request.urlopen(req, timeout=60) as r:
        return base64.b64decode(json.loads(r.read())["audioContent"])


def main():
    langs = sys.argv[1:] or list(VOICES)
    tok = token()
    for lang in langs:
        code, names = VOICES[lang]
        lines = json.loads((HERE / f"narration.{lang}.json").read_text(encoding="utf-8"))["lines"]
        out = HERE / "audio-i18n" / lang
        out.mkdir(parents=True, exist_ok=True)
        name = None
        for n in names:
            try:
                synth("test", code, n, tok)
                name = n
                break
            except urllib.error.HTTPError as e:
                print(f"{n}: {e.code}, trying the next voice")
        if not name:
            sys.exit(f"no {lang} voice works: {names}")
        durations = {}
        for line in lines:
            text = line.get("say", line["text"]).replace("\n", " ")
            p = out / f"{line['id']}.wav"
            p.write_bytes(synth(text, code, name, tok))  # LINEAR16 comes back as a WAV file
            with wave.open(str(p)) as w:
                durations[line["id"]] = round(w.getnframes() / w.getframerate(), 3)
            print(lang, line["id"], durations[line["id"]])
        (out / "durations.json").write_text(json.dumps(durations, indent=1))
        (out / "voice.txt").write_text(f"Google Cloud Text-to-Speech {name} {json.dumps(AUDIO)}\n")
        print(lang, name, "total", round(sum(durations.values()), 1), "s")


main()
