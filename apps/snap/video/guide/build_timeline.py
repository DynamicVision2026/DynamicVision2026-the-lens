#!/usr/bin/env python3
"""One source of truth for the v2 edit: narration line timings → scenes → src/timeline2.json, and the music
sections (energy per scene, snapped to bars by music.py) → music-sections.json.

  python3 build_timeline.py && python3 ../music.py public <total> music-sections.json
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
FPS = 30
dur = json.loads((HERE / "src" / "durations2.json").read_text())
narr = {l["id"]: l["text"] for l in json.loads((HERE.parent / "narration.json").read_text())["lines"]}

LEAD, GAP, SCENE_GAP, TAIL = 1.5, 0.75, 2.2, 5.5
# scene, lines, music energy (0 pad … 3 full), extra seconds after the scene's last line
SCENES = [
    ("hook", ["s01", "s02", "s03"], 1, 0.6),
    ("title", ["s04"], 3, 0.8),
    ("usecases", ["s05"], 2, 0.6),
    ("snap", ["s06", "s07", "s08", "s09"], 3, 0.8),
    ("map", ["s10"], 2, 0.4),
    ("ladder", ["s11", "s12"], 2, 0.4),
    ("roots", ["s13"], 1, 0.4),
    ("daily", ["s14"], 2, 0.4),
    ("exam", ["s15", "s16", "s17"], 3, 0.6),
    ("trust", ["s18"], 1, 0.4),
    ("plans", ["s19", "s20"], 3, 0.0),
]

t = LEAD
scenes, music = [], []
for i, (sid, ids, energy, extra) in enumerate(SCENES):
    start = 0.0 if i == 0 else t - SCENE_GAP / 2
    lines = []
    for j, lid in enumerate(ids):
        lines.append({"id": lid, "text": narr[lid], "from": round(t * FPS), "dur": round(dur[lid] * FPS)})
        t += dur[lid] + (GAP if j < len(ids) - 1 else 0)
    t += extra
    end = t + (TAIL if i == len(SCENES) - 1 else SCENE_GAP / 2)
    scenes.append({"id": sid, "from": round(start * FPS), "dur": round(end * FPS) - round(start * FPS), "lines": lines})
    music.append([round(start, 2), energy])
    t += SCENE_GAP
total = scenes[-1]["from"] + scenes[-1]["dur"]
music[0][1] = 0  # the very start: pad only, the hook builds into the title
music.insert(1, [round(scenes[0]["lines"][1]["from"] / FPS, 2), 1])
(HERE / "src" / "timeline2.json").write_text(json.dumps({"fps": FPS, "total": total, "scenes": scenes}, ensure_ascii=False, indent=1))
(HERE / "music-sections.json").write_text(json.dumps(music))
print("total", round(total / FPS, 1), "s")
for s in scenes:
    print(f"{s['id']:9s} {s['from'] / FPS:6.1f}  {s['dur'] / FPS:5.1f}s")
