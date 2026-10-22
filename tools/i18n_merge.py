#!/usr/bin/env python3
"""Build i18n/content/{en,zh-Hans,zh-Hant}.json ({Japanese: translation}) from the translated chunks
(i18n/content/translated/*.json), the card-specific unit words (units-by-card.json, keys "<card id>|<ja>") and the few
display strings written in code (code-strings.json). Then: python3 tools/i18n_extract.py --check"""
import json
from pathlib import Path

D = Path(__file__).resolve().parent.parent / "i18n" / "content"
LANGS = ["en", "zh-Hans", "zh-Hant"]
merged: dict = {}
for f in sorted((D / "translated").glob("*.json")) + [D / "units-by-card.json", D / "code-strings.json"]:
    merged.update(json.loads(f.read_text()))
for lang in LANGS:
    t = {ja: v[lang] for ja, v in merged.items() if v.get(lang)}
    (D / f"{lang}.json").write_text(json.dumps(t, ensure_ascii=False, separators=(",", ":"), sort_keys=True))
    print(lang, len(t))
