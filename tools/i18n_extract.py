#!/usr/bin/env python3
"""Course text for translation: every distinct Japanese string in build/bundle.json that the apps show.

  python3 tools/i18n_extract.py            → i18n/content/strings.json + i18n/content/chunks/NN.json
  python3 tools/i18n_extract.py --check    → report strings missing from i18n/content/{en,zh-Hans,zh-Hant}.json

Skipped (data, not display text): grades, provenance, ids and enum-like keys. packages/scenes/src/bundle.ts applies
the same rule at runtime (CONTENT_SKIP), so a translated table maps exactly what is extracted here.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JP = re.compile(r"[぀-ヿ一-鿿]")
SKIP = {"grades", "provenance", "id", "archetype", "lens", "stage", "kind", "op", "type", "best_move", "tags", "status", "checks"}
LANGS = ["en", "zh-Hans", "zh-Hant"]


def walk(o, path, out, ctx):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in SKIP:
                continue
            walk(v, path + [k], out, ctx)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            walk(v, path + [i], out, ctx)
    elif isinstance(o, str) and JP.search(o):
        if o not in out:
            out[o] = {"ja": o, "where": ".".join(str(p) for p in path[-3:]), **ctx}


def collect():
    b = json.loads((ROOT / "build" / "bundle.json").read_text())
    out: dict = {}
    for k in ("labels", "passes", "tokens"):
        walk(b.get(k), [k], out, {"card": k})
    for c in b["cards"]:
        walk(c, ["card"], out, {"card": c["id"], "problem": c.get("problem", {}).get("text_ja", "")})
    return list(out.values())


def main():
    items = collect()
    d = ROOT / "i18n" / "content"
    if "--check" in sys.argv:
        bad = 0
        for lang in LANGS:
            p = d / f"{lang}.json"
            t = json.loads(p.read_text()) if p.exists() else {}
            miss = [i["ja"] for i in items if i["ja"] not in t]
            bad += len(miss)
            print(f"{lang}: {len(items) - len(miss)}/{len(items)} translated" + (f" — first missing: {miss[0][:40]}" if miss else ""))
        sys.exit(1 if bad else 0)
    (d / "chunks").mkdir(parents=True, exist_ok=True)
    (d / "strings.json").write_text(json.dumps(items, ensure_ascii=False, indent=1))
    size = 300
    for n in range(0, len(items), size):
        (d / "chunks" / f"{n // size:02d}.json").write_text(json.dumps(items[n:n + size], ensure_ascii=False, indent=1))
    print(len(items), "strings,", sum(len(i["ja"]) for i in items), "chars,", (len(items) + size - 1) // size, "chunks")


main()
