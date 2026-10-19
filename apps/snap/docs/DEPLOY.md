# Deploy Lens Snap to Cloud Run (snap.domo-ai.com)

Lens Snap runs as its own Cloud Run service, **lens-snap**, in the 視点レンズ GCP project. It shares
nothing with lens-web (lens.domo-ai.com) except the project and the domain name.

## What the service needs

| Piece | How deploy.sh sets it | Why |
|---|---|---|
| Image | Cloud Build, `apps/snap/Dockerfile`, repo root as context, workspace lockfile | Reproducible install of @lens/snap only |
| `ANTHROPIC_API_KEY` | Secret Manager `anthropic-api-key` (optional; added with `--set-key`) | Without it the practice (mock) reader runs |
| `PILOT_CODE` | Secret Manager `lens-snap-pilot-code` (generated once) | `/app` reads photos only for invited families; landing + waitlist stay public |
| `READER_MODEL` | `claude-haiku-5-5` (≈¥0.2 per photo) | `READER_MODEL=claude-sonnet-5-5 bash apps/snap/deploy.sh …` switches to Sonnet (≈¥3 per photo) |
| `READ_PER_IP_HOUR`, `READ_DAILY_CAP` | 20, 300 | Caps the AI bill; at ≈¥0.2 per photo (Haiku), 300/day ≈ ¥60/day at most (≈¥900 with Sonnet) |
| `WAITLIST_DIR` | `/data/waitlist` on bucket `<project>-lens-snap-waitlist` (Cloud Storage FUSE volume, uid 1000) | One small file per signup; survives restarts |
| `--max-instances 1` | set | Rate limits are counted in memory |

## Deploy (Google Cloud Shell)

1. Open <https://console.cloud.google.com/>, pick the 視点レンズ project, click the Cloud Shell icon (top right, `>_`).
2. In Cloud Shell:
   ```sh
   git clone https://github.com/DynamicVision2026/DynamicVision2026-the-lens.git && cd DynamicVision2026-the-lens
   bash apps/snap/deploy.sh <lens-project-id>             # first time, without the key
   bash apps/snap/deploy.sh <lens-project-id> --set-key   # when the key is ready (asks for it, hidden)
   ```
   Later releases: `git pull && bash apps/snap/deploy.sh <lens-project-id>`.
3. The script prints the service URL, `/api/health`, and the pilot code.

## Domain: snap.domo-ai.com (once)

```sh
gcloud beta run domain-mappings create --service lens-snap --domain snap.domo-ai.com \
  --region asia-northeast1 --project <lens-project-id>
```

At the DNS provider for domo-ai.com add one record: `CNAME snap → ghs.googlehosted.com.` On Cloudflare,
set it to **DNS only** (grey cloud) so Google can issue the certificate (15–60 min).

## Check

```sh
curl -s https://snap.domo-ai.com/api/health        # {"ok":true,"reader":"claude:claude-haiku-5-5","pilotGate":true}
```
Open `/`, `/?h=c`, `/privacy`; sign up once with a test address; then confirm a file appeared in the
bucket (`gcloud storage ls gs://<project>-lens-snap-waitlist/waitlist/`).

## Waitlist export

```sh
gcloud storage cp -r gs://<project>-lens-snap-waitlist/waitlist ./wl
node apps/snap/scripts/waitlist-export.mjs ./wl > waitlist.csv
```

## Rollback

```sh
gcloud run revisions list --service lens-snap --region asia-northeast1 --project <lens-project-id>
gcloud run services update-traffic lens-snap --to-revisions <REVISION>=100 --region asia-northeast1 --project <lens-project-id>
```
