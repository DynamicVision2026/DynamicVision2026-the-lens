#!/usr/bin/env bash
# Lens Snap — turn on auto-deploy (run ONCE in Google Cloud Shell, from the repo root):
#
#   bash apps/snap/setup-autodeploy.sh <lens-project-id>
#
# After this, every change merged into main on GitHub that touches apps/snap is deployed to Cloud Run by
# GitHub Actions (.github/workflows/deploy-snap.yml), but only after the CI checks pass.
#
# No keys are created or stored anywhere: GitHub proves who it is to Google with a short-lived token
# (Workload Identity Federation), and Google accepts it only from this repo's main branch.
# The deployer account can build and deploy lens-snap; it cannot read the secrets or the waitlist.
# Safe to run again.
set -euo pipefail

PROJECT="${1:?usage: bash apps/snap/setup-autodeploy.sh <lens-project-id>}"
REPO_FULL="DynamicVision2026/DynamicVision2026-the-lens"
SA_NAME=github-deployer
SA="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
POOL=github
PROVIDER=github-repo
g() { gcloud --project "$PROJECT" "$@"; }

[ -f apps/snap/Dockerfile ] || { echo "Run this from the repo root (cd ~/DynamicVision2026-the-lens)."; exit 1; }
NUM="$(g projects describe "$PROJECT" --format 'value(projectNumber)')"
RUNTIME_SA="${NUM}-compute@developer.gserviceaccount.com"

echo "== 1/5 APIs"
g services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  cloudresourcemanager.googleapis.com run.googleapis.com cloudbuild.googleapis.com >/dev/null

echo "== 2/5 deployer account"
g iam service-accounts describe "$SA" >/dev/null 2>&1 ||
  g iam service-accounts create "$SA_NAME" --display-name "GitHub auto-deploy (lens-snap)" >/dev/null
for role in roles/run.admin roles/cloudbuild.builds.editor roles/serviceusage.serviceUsageConsumer roles/viewer; do
  g projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA" --role "$role" --condition None >/dev/null
done
# act as the account the builds and the service run as
g iam service-accounts add-iam-policy-binding "$RUNTIME_SA" --member "serviceAccount:$SA" \
  --role roles/iam.serviceAccountUser >/dev/null
# upload the source for Cloud Build (its staging bucket only)
gcloud storage buckets describe "gs://${PROJECT}_cloudbuild" --project "$PROJECT" >/dev/null 2>&1 ||
  gcloud storage buckets create "gs://${PROJECT}_cloudbuild" --project "$PROJECT" --uniform-bucket-level-access >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://${PROJECT}_cloudbuild" --project "$PROJECT" \
  --member "serviceAccount:$SA" --role roles/storage.admin >/dev/null

echo "== 3/5 trust GitHub (this repo, main branch only)"
g iam workload-identity-pools describe "$POOL" --location global >/dev/null 2>&1 ||
  g iam workload-identity-pools create "$POOL" --location global --display-name "GitHub" >/dev/null
g iam workload-identity-pools providers describe "$PROVIDER" --location global --workload-identity-pool "$POOL" >/dev/null 2>&1 ||
  g iam workload-identity-pools providers create-oidc "$PROVIDER" --location global --workload-identity-pool "$POOL" \
    --display-name "the-lens repo" --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository=='${REPO_FULL}' && assertion.ref=='refs/heads/main'" >/dev/null

echo "== 4/5 let that repo use the deployer account"
g iam service-accounts add-iam-policy-binding "$SA" --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/${NUM}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO_FULL}" >/dev/null

echo "== 5/5 check"
WANT_PROVIDER="projects/${NUM}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
if grep -q "$WANT_PROVIDER" .github/workflows/deploy-snap.yml && grep -q "$SA" .github/workflows/deploy-snap.yml; then
  echo "Auto-deploy is on. The next change merged into main (after CI) goes to Cloud Run by itself."
else
  echo "Set up, but .github/workflows/deploy-snap.yml expects a different project. Tell Claude:"
  echo "  provider: $WANT_PROVIDER"
  echo "  account:  $SA"
fi
