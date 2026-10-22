#!/usr/bin/env python3
"""Voices for the つまずきマップ story film: one WAV per line of story.json, each line in its speaker's voice
(n = narrator, m = mother, c = child), from a running VOICEVOX engine (http://127.0.0.1:50021).
Run by .github/workflows/story-voice.yml. Standard library only.
Writes apps/snap/video/audio-story/<id>.wav and durations.json ({id: seconds})."""
import json, sys, urllib.parse, urllib.request, wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENGINE = "http://127.0.0.1:50021"
cfg = json.loads((HERE / "story.json").read_text(encoding="utf-8"))
out = HERE / "audio-story"
out.mkdir(exist_ok=True)


def http(method, path, body=None):
    req = urllib.request.Request(ENGINE + path, data=body, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


speakers = json.loads(http("GET", "/speakers"))
ids = {}
for key, v in cfg["voices"].items():
    sid = next((s["id"] for sp in speakers if sp["name"] == v["character"] for s in sp["styles"] if s["name"] == v["style"]), None)
    if sid is None:
        sys.exit(f"voice not found: {v['character']} {v['style']}")
    ids[key] = sid
    print("voice", key, v["character"], v["style"], sid)

durations = {}
for line in cfg["lines"]:
    v = cfg["voices"][line["v"]]
    q = json.loads(http("POST", f"/audio_query?speaker={ids[line['v']]}&text={urllib.parse.quote(line.get('say', line['text']))}"))
    for k in ("speedScale", "pitchScale", "intonationScale", "postPhonemeLength"):
        if k in v:
            q[k] = v[k]
    p = out / f"{line['id']}.wav"
    p.write_bytes(http("POST", f"/synthesis?speaker={ids[line['v']]}", json.dumps(q).encode()))
    with wave.open(str(p)) as w:
        durations[line["id"]] = round(w.getnframes() / w.getframerate(), 3)
    print(line["id"], durations[line["id"]])
(out / "durations.json").write_text(json.dumps(durations, indent=1), encoding="utf-8")
print("total", round(sum(durations.values()), 1), "s")
