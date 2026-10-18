#!/usr/bin/env bash
# Lens Snap — one-command deploy to Cloud Run (run in Google Cloud Shell, from the repo root).
#
#   bash apps/snap/deploy.sh <lens-project-id>            # deploy / redeploy
#   bash apps/snap/deploy.sh <lens-project-id> --set-key  # also store (or replace) the Anthropic API key
#
# Safe to run again: every step checks first and only creates what is missing.
# Isolation: uses only the 視点レンズ project you pass; creates its own service (lens-snap), bucket,
# image repository and secrets. It never touches lens-web or any other service.
set -euo pipefail

PROJECT="${1:?usage: bash apps/snap/deploy.sh <lens-project-id> [--set-key]}"
SET_KEY="${2:-}"
REGION=asia-northeast1
SERVICE=lens-snap
BUCKET="${PROJECT}-lens-snap-waitlist"
REPO=lens-snap
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/app:$(date +%Y%m%d-%H%M%S)"
KEY_SECRET=anthropic-api-key
CODE_SECRET=lens-snap-pilot-code
g() { gcloud --project "$PROJECT" "$@"; }
has_secret() { g secrets describe "$1" >/dev/null 2>&1; }

[ -f apps/snap/Dockerfile ] || { echo "Run this from the repo root (the folder with pnpm-workspace.yaml)."; exit 1; }

echo "== 1/6 APIs"
g services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com storage.googleapis.com >/dev/null

echo "== 2/6 image repository, waitlist bucket"
g artifacts repositories describe "$REPO" --location "$REGION" >/dev/null 2>&1 ||
  g artifacts repositories create "$REPO" --repository-format docker --location "$REGION" >/dev/null
gcloud storage buckets describe "gs://$BUCKET" --project "$PROJECT" >/dev/null 2>&1 ||
  gcloud storage buckets create "gs://$BUCKET" --project "$PROJECT" --location "$REGION" --uniform-bucket-level-access >/dev/null

echo "== 3/6 secrets"
# Pilot code: the app (/app) only reads photos for people who have this code. The landing page and
# waitlist stay open to everyone.
if ! has_secret "$CODE_SECRET"; then
  CODE="$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 8)"
  printf '%s' "$CODE" | g secrets create "$CODE_SECRET" --data-file=- >/dev/null
fi
if [ "$SET_KEY" = "--set-key" ]; then
  read -r -s -p "Paste the Anthropic API key (input hidden), then press Enter: " KEY; echo
  if has_secret "$KEY_SECRET"; then printf '%s' "$KEY" | g secrets versions add "$KEY_SECRET" --data-file=- >/dev/null
  else printf '%s' "$KEY" | g secrets create "$KEY_SECRET" --data-file=- >/dev/null; fi
  unset KEY
fi

echo "== 4/6 permissions for the service account"
NUM="$(g projects describe "$PROJECT" --format 'value(projectNumber)')"
SA="${NUM}-compute@developer.gserviceaccount.com"
for s in "$CODE_SECRET" "$KEY_SECRET"; do
  has_secret "$s" && g secrets add-iam-policy-binding "$s" --member "serviceAccount:$SA" \
    --role roles/secretmanager.secretAccessor >/dev/null
done
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --project "$PROJECT" \
  --member "serviceAccount:$SA" --role roles/storage.objectAdmin >/dev/null

echo "== 5/6 build the image (Cloud Build, ~3-5 min)"
g builds submit --config apps/snap/cloudbuild.yaml --substitutions "_IMAGE=$IMAGE" .

echo "== 6/6 deploy"
SECRETS="PILOT_CODE=${CODE_SECRET}:latest"
if has_secret "$KEY_SECRET"; then SECRETS="${SECRETS},ANTHROPIC_API_KEY=${KEY_SECRET}:latest"
else echo "   (no API key yet: the app runs with the practice reader; add it later with --set-key)"; fi
# max-instances 1: the rate limits and the daily cap are counted in memory.
g run deploy "$SERVICE" --image "$IMAGE" --region "$REGION" --allow-unauthenticated \
  --execution-environment gen2 --max-instances 1 --memory 1Gi --cpu 1 \
  --set-secrets "$SECRETS" \
  --set-env-vars "READER_MODEL=claude-sonnet-5,READ_PER_IP_HOUR=20,READ_DAILY_CAP=300,WAITLIST_DIR=/data/waitlist" \
  --add-volume "name=waitlist,type=cloud-storage,bucket=${BUCKET},mount-options=uid=1000;gid=1000" \
  --add-volume-mount "volume=waitlist,mount-path=/data"

URL="$(g run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)')"
echo
echo "Done: $URL"
curl -s "$URL/api/health"; echo
echo "Pilot code: $(g secrets versions access latest --secret "$CODE_SECRET")"
echo "Waitlist export: gcloud storage cp -r gs://$BUCKET/waitlist ./wl && node apps/snap/scripts/waitlist-export.mjs ./wl > waitlist.csv"
