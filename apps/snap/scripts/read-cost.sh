#!/usr/bin/env bash
# Average token use and cost per photo from Cloud Run logs (the read_usage lines).
#   bash apps/snap/scripts/read-cost.sh [N=50] [USD_JPY=150]
# Prices: Claude Haiku 5.5, $0.10 / MTok input, $0.50 / MTok output (prompts under 100k tokens).
set -euo pipefail
N="${1:-50}"; FX="${2:-150}"
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="lens-snap" AND jsonPayload.event="read_usage"' \
  --project shiten-lens-511712 --limit "$N" --format=json |
python3 -c '
import json, sys
fx = float(sys.argv[1]); rows = [e["jsonPayload"] for e in json.load(sys.stdin)]
if not rows: sys.exit("no read_usage lines yet: take a few photos first")
n = len(rows); avg = lambda k: sum(r.get(k, 0) for r in rows) / n
i, o = avg("input_tokens"), avg("output_tokens")
cw, cr = avg("cache_creation_input_tokens"), avg("cache_read_input_tokens")
usd = (i * 0.10 + cw * 0.125 + cr * 0.01 + o * 0.50) / 1e6
print(f"photos: {n}   model: {rows[0].get(\"model\")}")
print(f"avg input tokens:  {i:,.0f}   (cache write {cw:,.0f}, cache read {cr:,.0f})")
print(f"avg output tokens: {o:,.0f}   max {max(r[\"output_tokens\"] for r in rows):,}")
print(f"avg problems/page: {avg(\"problems\"):.1f}   avg seconds: {avg(\"ms\")/1000:.1f}")
print(f"cost per photo: ${usd:.5f}  = ¥{usd*fx:.3f}   per 1,000 photos: ¥{usd*fx*1000:,.0f}")
' "$FX"
