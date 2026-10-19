#!/usr/bin/env bash
# Lens Snap — make 1-year pass codes and put them live (Cloud Shell, repo root):
#
#   bash apps/snap/make-codes.sh <lens-project-id> <count> [note]
#   e.g. bash apps/snap/make-codes.sh shiten-lens-511712 20 "course buyers Nov"
#
# Prints the codes and appends them to ~/lens-snap-codes.csv (date, note, code). Each code works for
# 1 year from first use, on up to 3 devices of one family.
set -euo pipefail
PROJECT="${1:?usage: bash apps/snap/make-codes.sh <lens-project-id> <count> [note]}"
COUNT="${2:?how many codes?}"
NOTE="${3:-}"
BUCKET="${PROJECT}-lens-snap-waitlist"
TMP="$(mktemp -d)"
node apps/snap/scripts/make-codes.mjs "$COUNT" "$TMP" "$NOTE" > "$TMP/codes.txt"
gcloud storage cp --project "$PROJECT" "$TMP"/lic/*.json "gs://$BUCKET/plans/lic/" >/dev/null
while read -r code; do echo "$(date +%F),${NOTE},${code}" >> ~/lens-snap-codes.csv; done < "$TMP/codes.txt"
cat "$TMP/codes.txt"
echo "-- $(wc -l < "$TMP/codes.txt") codes are live (also saved in ~/lens-snap-codes.csv)"
rm -rf "$TMP"
