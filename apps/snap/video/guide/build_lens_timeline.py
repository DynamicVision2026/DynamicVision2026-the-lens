#!/usr/bin/env python3
"""視点レンズ guide video: narration lengths (src/lens/durations.json, from ../audio-lens/durations.json) → scenes
→ src/lens/timeline.json, and music sections → lens-music-sections.json.

  python3 build_lens_timeline.py && python3 ../music.py public/lens <total> lens-music-sections.json
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
FPS = 30
dur = json.loads((HERE / "src" / "lens" / "durations.json").read_text())
narr = {l["id"]: l["text"] for l in json.loads((HERE.parent / "lens-narration.json").read_text())["lines"]}

LEAD, GAP, SCENE_GAP, TAIL = 1.2, 0.6, 1.6, 6.0
# scene, lines, music energy (0 pad … 3 full), extra seconds after the scene's last line (room for the visuals)
SCENES = [
    ("hook", ["g01", "g02"], 0, 1.2),
    ("thesis", ["g03", "g04"], 2, 0.8),
    ("lenses", ["g05"], 2, 0.8),
    ("ex1", ["g06", "g07", "g08"], 2, 1.6),
    ("ex2", ["g09", "g10", "g11"], 2, 1.8),
    ("ex3", ["g12", "g13", "g14"], 2, 1.6),
    ("steps", ["g15", "g16", "g17", "g18", "g19"], 3, 1.0),
    ("finish", ["g20", "g21"], 2, 1.0),
    ("benefits", ["g22"], 2, 1.0),
    ("offer", ["g23", "g24"], 3, 0.6),
    ("end", ["g25"], 1, 0.0),
]

t = LEAD
scenes, music = [], []
for i, (sid, ids, energy, extra) in enumerate(SCENES):
    start = 0.0 if i == 0 else t - SCENE_GAP / 2
    lines = []
    for j, lid in enumerate(ids):
        gap = GAP + (1.2 if sid in ("ex1", "ex2", "ex3") and j > 0 else 0)  # time to show the trap / the lens
        if j:
            t += gap
        lines.append({"id": lid, "text": narr[lid], "from": round(t * FPS), "dur": round(dur[lid] * FPS)})
        t += dur[lid]
    t += extra
    end = t + (TAIL if i == len(SCENES) - 1 else SCENE_GAP / 2)
    scenes.append({"id": sid, "from": round(start * FPS), "dur": round(end * FPS) - round(start * FPS), "lines": lines})
    music.append([round(start, 2), energy])
    t += SCENE_GAP
total = scenes[-1]["from"] + scenes[-1]["dur"]
(HERE / "src" / "lens" / "timeline.json").write_text(json.dumps({"fps": FPS, "total": total, "scenes": scenes}, ensure_ascii=False, indent=1))
(HERE / "lens-music-sections.json").write_text(json.dumps(music))
print("total", round(total / FPS, 1), "s")
for s in scenes:
    print(f"{s['id']:9s} {s['from'] / FPS:6.1f}  {s['dur'] / FPS:5.1f}s")
