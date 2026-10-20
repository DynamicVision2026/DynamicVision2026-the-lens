#!/usr/bin/env python3
"""Narration for the つまずきマップ guide video: one WAV per line of narration.json, from a running VOICEVOX
engine (http://127.0.0.1:50021). Run by .github/workflows/guide-voice.yml on GitHub's runner (the engine runs
there as a service), or locally with the VOICEVOX app open. Standard library only.
Writes apps/snap/video/audio/<id>.wav and audio/durations.json ({id: seconds})."""
import json, sys, urllib.parse, urllib.request, wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENGINE = "http://127.0.0.1:50021"
cfg = json.loads((HERE / "narration.json").read_text(encoding="utf-8"))
out = HERE / "audio"
out.mkdir(exist_ok=True)


def http(method, path, body=None):
    req = urllib.request.Request(ENGINE + path, data=body, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


v = cfg["voice"]
speakers = json.loads(http("GET", "/speakers"))
sid = next((s["id"] for sp in speakers if sp["name"] == v["character"] for s in sp["styles"] if s["name"] == v["style"]), None)
if sid is None:
    sys.exit(f"speaker not found: {v['character']} {v['style']}")
durations = {}
for line in cfg["lines"]:
    text = line.get("say", line["text"])
    q = json.loads(http("POST", f"/audio_query?speaker={sid}&text={urllib.parse.quote(text)}"))
    for k in ("speedScale", "pitchScale", "intonationScale", "postPhonemeLength"):
        if k in v:
            q[k] = v[k]
    wav = http("POST", f"/synthesis?speaker={sid}", json.dumps(q).encode())
    p = out / f"{line['id']}.wav"
    p.write_bytes(wav)
    with wave.open(str(p)) as w:
        durations[line["id"]] = round(w.getnframes() / w.getframerate(), 3)
    print(line["id"], durations[line["id"]])
(out / "durations.json").write_text(json.dumps(durations, indent=1), encoding="utf-8")
print("total", round(sum(durations.values()), 1), "s")
