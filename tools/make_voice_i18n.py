#!/usr/bin/env python3
"""Masterclass voice in English / 简体中文 / 繁體中文 / 廣東話 (Google Cloud Text-to-Speech).

Every Japanese clip in apps/trainer/public/audio/mc/manifest.json gets a clip in each language, spoken from that
line's translation in i18n/content/<lang>.json (the same text the subtitles show). Run by
.github/workflows/voice-i18n.yml (Google sign-in through the repo's workload identity); locally it needs
`gcloud auth print-access-token` to work and the Text-to-Speech API enabled on the project.

  python3 tools/make_voice_i18n.py              # only clips that are new or whose text changed
  python3 tools/make_voice_i18n.py --all        # regenerate everything
  python3 tools/make_voice_i18n.py --only yue   # one voice folder (en, zh-Hans, zh-Hant, yue)

Cantonese (yue, for Hong Kong / Macau) reads the 繁體中文 text (i18n/content/zh-Hant.json) aloud in Cantonese, the
way written Chinese is read in Hong Kong schools; its voice is the best female yue-HK voice Google lists.

Writes apps/trainer/public/audio/mc/<lang>/<lesson path>/<key>.m4a and mc/<lang>/manifest.json
({lesson: {key: {text, file, sha1}}}). The trainer plays mc/<lang>/… and falls back to the Japanese clip.
Google's terms allow commercial use of the generated audio; no credit line is needed (VOICEVOX's credit stays
for the Japanese voice). Standard library only; ffmpeg converts MP3 → AAC (.m4a).
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MC = ROOT / "apps" / "trainer" / "public" / "audio" / "mc"
PROJECT = os.environ.get("TTS_PROJECT", "shiten-lens-511712")
# Young, bright female voices (close to the Japanese mascot), a little faster than default.
VOICES = {
    "en": {"languageCode": "en-US", "name": "en-US-Wavenet-F"},
    "zh-Hans": {"languageCode": "cmn-CN", "name": "cmn-CN-Wavenet-A"},
    "zh-Hant": {"languageCode": "cmn-TW", "name": "cmn-TW-Wavenet-A"},
    "yue": {"languageCode": "yue-HK", "name": None},  # picked by best_voice()
}
TEXT_LANG = {"yue": "zh-Hant"}  # which translation table a voice folder reads
AUDIO = {"audioEncoding": "MP3", "speakingRate": 1.08, "pitch": 2.0, "sampleRateHertz": 24000}


def token() -> str:
    t = os.environ.get("GOOGLE_TOKEN") or subprocess.run(["gcloud", "auth", "print-access-token"], capture_output=True, text=True).stdout.strip()
    if not t:
        sys.exit("no Google access token (gcloud auth print-access-token)")
    return t


def best_voice(code: str, tok: str) -> str:
    """The best female voice Google lists for a language (WaveNet > Neural2 > Standard)."""
    req = urllib.request.Request(f"https://texttospeech.googleapis.com/v1/voices?languageCode={code}",
                                 headers={"Authorization": f"Bearer {tok}", "x-goog-user-project": PROJECT})
    with urllib.request.urlopen(req, timeout=60) as r:
        voices = [v for v in json.loads(r.read()).get("voices", []) if code in v["languageCodes"]]
    rank = {"Wavenet": 0, "Neural2": 1, "Standard": 2}
    ok = [v for v in voices if v.get("ssmlGender") == "FEMALE" and any(f"-{k}-" in v["name"] for k in rank)]
    if not ok:
        sys.exit(f"no usable {code} voice: {[v['name'] for v in voices]}")
    ok.sort(key=lambda v: (min(rank[k] for k in rank if f"-{k}-" in v["name"]), v["name"]))
    print(f"{code}: {ok[0]['name']} (of {[v['name'] for v in voices]})")
    return ok[0]["name"]


def spoken(text: str, lang: str) -> str:
    """What the voice reads: arrows and ellipses as pauses (the subtitle keeps the symbols)."""
    sep = ", " if lang == "en" else "，"
    t = re.sub(r"\s*[→⇒]\s*", sep, text)
    return t.strip()


def synth(text: str, lang: str, tok: str) -> bytes:
    body = json.dumps({"input": {"text": text}, "voice": VOICES[lang], "audioConfig": AUDIO}).encode()
    req = urllib.request.Request("https://texttospeech.googleapis.com/v1/text:synthesize", data=body, method="POST",
                                 headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json", "x-goog-user-project": PROJECT})
    with urllib.request.urlopen(req, timeout=60) as r:
        return base64.b64decode(json.loads(r.read())["audioContent"])


def main():
    regen = "--all" in sys.argv
    only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else list(VOICES)
    src = json.loads((MC / "manifest.json").read_text())
    tok = token()
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is needed")
    for lang in only:
        if not VOICES[lang]["name"]:
            VOICES[lang]["name"] = best_voice(VOICES[lang]["languageCode"], tok)
        table = json.loads((ROOT / "i18n" / "content" / f"{TEXT_LANG.get(lang, lang)}.json").read_text())
        out_dir = MC / lang
        man_path = out_dir / "manifest.json"
        man = json.loads(man_path.read_text()) if man_path.exists() else {}
        made = kept = missing = 0
        for lesson, clips in src.items():
            if lesson.startswith("_"):
                continue
            for key, c in clips.items():
                text = table.get(c["text"])
                if not text:
                    missing += 1
                    continue
                sha = hashlib.sha1(f"{VOICES[lang]['name']}|{AUDIO}|{text}".encode()).hexdigest()[:12]
                dest = out_dir / lesson / c["file"]
                if not regen and man.get(lesson, {}).get(key, {}).get("sha1") == sha and dest.exists():
                    kept += 1
                    continue
                mp3 = synth(spoken(text, lang), lang, tok)
                dest.parent.mkdir(parents=True, exist_ok=True)
                with tempfile.NamedTemporaryFile(suffix=".mp3") as f:
                    f.write(mp3)
                    f.flush()
                    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f.name, "-c:a", "aac", "-b:a", "64k", str(dest)], check=True)
                man.setdefault(lesson, {})[key] = {"text": text, "file": c["file"], "sha1": sha}
                made += 1
        man["_voice"] = {"engine": "Google Cloud Text-to-Speech", **VOICES[lang], **AUDIO}
        out_dir.mkdir(parents=True, exist_ok=True)
        man_path.write_text(json.dumps(man, ensure_ascii=False, indent=1) + "\n")
        print(f"{lang}: {made} made, {kept} unchanged, {missing} without a translation")


main()
