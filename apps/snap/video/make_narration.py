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
(out / "speakers.json").write_text(json.dumps([{"name": sp["name"], "styles": [s["name"] for s in sp["styles"]]} for sp in speakers], ensure_ascii=False, indent=1), encoding="utf-8")


def find(name, style):
    return next((s["id"] for sp in speakers if sp["name"] == name for s in sp["styles"] if s["name"] == style), None)


cands = v.get("candidates") or [[v["character"], v["style"]]]
picked = next(((n, st, find(n, st)) for n, st in cands if find(n, st) is not None), None)
if not picked:
    sys.exit(f"none of the voices found: {cands}")
name, style, sid = picked
print("voice:", name, style)
(out / "voice.txt").write_text(f"{name} {style}", encoding="utf-8")


def tune(q):
    for k in ("speedScale", "pitchScale", "intonationScale", "postPhonemeLength"):
        if k in v:
            q[k] = v[k]
    return q


# short samples of other voices (the same line), so another voice can be chosen by ear
for n, st in cfg.get("samples", []):
    i = find(n, st)
    if i is None:
        continue
    t = cfg["lines"][3].get("say", cfg["lines"][3]["text"])
    q = tune(json.loads(http("POST", f"/audio_query?speaker={i}&text={urllib.parse.quote(t)}")))
    (out / f"sample_{n}_{st}.wav".replace("/", "_")).write_bytes(http("POST", f"/synthesis?speaker={i}", json.dumps(q).encode()))
durations = {}
for line in cfg["lines"]:
    text = line.get("say", line["text"])
    q = tune(json.loads(http("POST", f"/audio_query?speaker={sid}&text={urllib.parse.quote(text)}")))
    wav = http("POST", f"/synthesis?speaker={sid}", json.dumps(q).encode())
    p = out / f"{line['id']}.wav"
    p.write_bytes(wav)
    with wave.open(str(p)) as w:
        durations[line["id"]] = round(w.getnframes() / w.getframerate(), 3)
    print(line["id"], durations[line["id"]])
(out / "durations.json").write_text(json.dumps(durations, indent=1), encoding="utf-8")
print("total", round(sum(durations.values()), 1), "s")
